<?php

namespace App\Services;

use App\Exceptions\DeliverySlotException;
use App\Jobs\BroadcastOrderTracking;
use App\Models\AppSetting;
use App\Models\DeliverySlot;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Store;
use App\Models\Vendor;
use App\Services\Integration\WebhookNotifier;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Grocery delivery slots: publishing, customer availability, and the
 * single row-locked path that books and releases slot capacity.
 *
 * Every time comparison happens in PHP against the slot's own timezone, so the
 * UTC application clock and the store's local wall-clock slots can never drift
 * apart. Capacity is mutated only under `lockForUpdate()`.
 */
class DeliverySlotService
{
    public const MODE_ASAP = 'asap';

    public const MODE_SCHEDULED = 'scheduled';

    public function __construct(
        private WebhookNotifier $webhookNotifier,
    ) {}

    public function timezone(): string
    {
        return (string) config('delivery_slots.timezone', 'UTC');
    }

    public function bookingWindowDays(): int
    {
        return max(1, (int) config('delivery_slots.booking_window_days', 7));
    }

    /**
     * Centrally defined grocery delivery shifts (stable identifiers).
     *
     * @return array<string, array{start: string, end: string}>
     */
    public function shifts(): array
    {
        $configured = config('delivery_slots.shifts', []);

        $shifts = [];
        foreach ($configured as $key => $value) {
            $shifts[$key] = [
                'start' => $this->formatTime($value['start'] ?? '08:00'),
                'end' => $this->formatTime($value['end'] ?? '12:00'),
            ];
        }

        if ($shifts === []) {
            $shifts = [
                'morning' => ['start' => '08:00:00', 'end' => '12:00:00'],
                'evening' => ['start' => '17:00:00', 'end' => '21:00:00'],
            ];
        }

        return $shifts;
    }

    public function horizonDays(): int
    {
        return max($this->bookingWindowDays(), (int) config('delivery_slots.horizon_days', 30));
    }

    /**
     * First bookable local date, inclusive.
     */
    public function firstBookableDate(): Carbon
    {
        return Carbon::now($this->timezone())->startOfDay();
    }

    /**
     * Last local date a customer may book, inclusive.
     */
    public function lastBookableDate(): Carbon
    {
        return $this->firstBookableDate()->copy()->addDays($this->bookingWindowDays() - 1);
    }

    public function defaultLeadTimeMin(): int
    {
        return (int) config('delivery_slots.default_lead_time_min', 60);
    }

    // ---------------------------------------------------------------------
    // Scheduled dispatch eligibility
    // ---------------------------------------------------------------------

    /**
     * First instant a scheduled grocery order may be offered to delivery
     * partners: the start of the booked delivery window.
     *
     * The slot start is resolved through the slot's own timezone (or, for an
     * order whose slot was later removed, the `scheduled_at` instant frozen on
     * the order at booking time) and compared in UTC, so the decision never
     * depends on the browser or the host clock's local zone.
     *
     * There is deliberately no configurable lead subtracted from the slot
     * start. A scheduled order is dispatched by its vendor once the order is
     * packed, and the booked window is the only hard boundary.
     *
     * Returns null for ASAP grocery orders and for every non-grocery order:
     * they are not scheduled and have no gate.
     */
    public function dispatchEligibleAt(Order $order): ?Carbon
    {
        if ($order->order_type !== 'grocery') {
            return null;
        }

        $slot = $order->delivery_slot_id ? DeliverySlot::find($order->delivery_slot_id) : null;
        $slotStart = $slot?->slot_date ? $slot->startsAt() : $order->scheduled_at;

        if ($slotStart === null) {
            return null;
        }

        return $slotStart->copy();
    }

    /**
     * Start of the window the order was booked into, resolved the same way as
     * `dispatchEligibleAt`: the live slot when it still exists, otherwise the
     * instants frozen on the order at booking time. Returns null for ASAP.
     */
    public function slotStartFor(Order $order): ?Carbon
    {
        $slot = $order->delivery_slot_id ? DeliverySlot::find($order->delivery_slot_id) : null;

        if ($slot?->slot_date) {
            return $slot->startsAt();
        }

        return $this->frozenScheduleTime($order, 'starts_at') ?? $order->scheduled_at;
    }

    /**
     * End of the booked window, resolved like `slotStartFor()`.
     */
    public function slotEndFor(Order $order): ?Carbon
    {
        $slot = $order->delivery_slot_id ? DeliverySlot::find($order->delivery_slot_id) : null;

        if ($slot?->slot_date) {
            return $slot->endsAt();
        }

        return $this->frozenScheduleTime($order, 'ends_at');
    }

    /**
     * Whether the platform is in vendor-manual dispatch for scheduled grocery
     * orders (the default). Read from the admin "grocery_delivery" settings so
     * operations can switch between manual and automatic dispatch without a
     * deploy.
     */
    public function manualVendorDispatchEnabled(): bool
    {
        $value = AppSetting::where('key', 'grocery_vendor_manual_dispatch')->value('value');

        if ($value === null || $value === '') {
            return (bool) config('delivery_slots.grocery_vendor_manual_dispatch', true);
        }

        return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * Whether the order is dispatched manually by its vendor.
     *
     * Only SCHEDULED Grocery orders are ever manual — the automatic scheduler
     * never offers those to a partner. ASAP Grocery, Food and Ride are never
     * manual and keep the automatic dispatch behaviour untouched.
     */
    public function isManualVendorDispatch(Order $order): bool
    {
        if ($order->order_type !== 'grocery') {
            return false;
        }

        $scheduled = $order->delivery_slot_id !== null
            || $order->timing_type === 'scheduled'
            || ($order->meta['delivery_schedule']['delivery_mode'] ?? null) === 'scheduled';

        if (! $scheduled) {
            return false;
        }

        return $this->manualVendorDispatchEnabled();
    }

    /**
     * Read one ISO instant out of the booking snapshot stored on the order.
     */
    private function frozenScheduleTime(Order $order, string $key): ?Carbon
    {
        $value = $order->meta['delivery_schedule'][$key] ?? null;

        if (! is_string($value) || $value === '') {
            return null;
        }

        try {
            return Carbon::parse($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Whether a scheduled grocery order may be offered to delivery partners
     * right now, and if not, the instant it becomes eligible.
     *
     * @return array{eligible: bool, dispatch_eligible_at: string|null, slot_start_at: string|null}
     */
    public function dispatchEligibility(Order $order, ?Carbon $now = null): array
    {
        $eligibleAt = $this->dispatchEligibleAt($order);

        if ($eligibleAt === null) {
            return ['eligible' => true, 'dispatch_eligible_at' => null, 'slot_start_at' => null];
        }

        $now ??= Carbon::now('UTC');

        return [
            'eligible' => $eligibleAt->lessThanOrEqualTo($now),
            'dispatch_eligible_at' => $eligibleAt->toIso8601String(),
            'slot_start_at' => $eligibleAt->copy()->toIso8601String(),
        ];
    }

    // ---------------------------------------------------------------------
    // Vendor management
    // ---------------------------------------------------------------------

    public function vendorSlots(Vendor $vendor, ?string $from, ?string $to): Collection
    {
        $query = DeliverySlot::query()
            ->forVendor($vendor->id)
            ->orderBy('slot_date')
            ->orderBy('start_time');

        if ($from) {
            $query->whereDate('slot_date', '>=', $from);
        }

        if ($to) {
            $query->whereDate('slot_date', '<=', $to);
        }

        return $query->get();
    }

    /**
     * @param  array{store_id?: int, slot_date: string, start_time: string, end_time: string, max_orders?: int, lead_time_min?: int, is_active?: bool}  $data
     */
    public function createForVendor(Vendor $vendor, Store $store, array $data): DeliverySlot
    {
        $attributes = $this->slotAttributes($data);
        $this->assertDateWithinHorizon($attributes['slot_date']);
        $this->assertWithinDailyLimit($vendor, $attributes['slot_date'], null);

        try {
            return DeliverySlot::create($attributes + [
                'vendor_id' => $vendor->id,
                'store_id' => $store->id,
                'booked_orders' => 0,
            ]);
        } catch (QueryException $e) {
            if ($this->isDuplicateSlot($e)) {
                throw new DeliverySlotException('This store already has a slot starting at that time on that date.', 'duplicate_slot');
            }

            throw $e;
        }
    }

    /**
     * Bulk-create slots for a date range and a set of predefined shifts.
     *
     * @param  array{from_date: string, to_date: string, shifts: array<int, string>, max_orders?: int, lead_time_min?: int}  $data
     * @return array{created: array<int, DeliverySlot>, skipped: array<int, array{date: string, shift: string, reason: string}>, created_count: int, skipped_count: int}
     */
    public function bulkCreateForVendor(Vendor $vendor, Store $store, array $data): array
    {
        $shiftKeys = array_values(array_unique($data['shifts']));
        $shiftDefs = $this->shifts();

        foreach ($shiftKeys as $shift) {
            if (! isset($shiftDefs[$shift])) {
                throw new DeliverySlotException("Unknown shift: {$shift}", 'invalid_shift');
            }
        }

        $timezone = $this->timezone();
        $from = Carbon::parse($data['from_date'], $timezone)->startOfDay();
        $to = Carbon::parse($data['to_date'], $timezone)->startOfDay();

        if ($to->lt($from)) {
            throw new DeliverySlotException('To date must be on or after from date.', 'invalid_date_range');
        }

        $today = $this->firstBookableDate();
        if ($from->lt($today)) {
            throw new DeliverySlotException('Slots cannot be created in the past.', 'past_date');
        }

        $lastHorizon = $today->copy()->addDays($this->horizonDays() - 1);
        if ($to->gt($lastHorizon)) {
            throw new DeliverySlotException(
                "Slots can only be published between today and {$lastHorizon->format('Y-m-d')}.",
                'slot_out_of_horizon'
            );
        }

        $dates = [];
        $cursor = $from->copy();
        while ($cursor->lte($to)) {
            $dates[] = $cursor->format('Y-m-d');
            $cursor->addDay();
        }

        $maxSlots = count($dates) * count($shiftKeys);
        $limit = (int) config('delivery_slots.max_bulk_slots', 200);
        if ($maxSlots > $limit) {
            throw new DeliverySlotException("A single request may create at most {$limit} slots.", 'too_many_slots');
        }

        $created = [];
        $skipped = [];
        $maxOrders = (int) ($data['max_orders'] ?? 10);
        $leadTime = (int) ($data['lead_time_min'] ?? $this->defaultLeadTimeMin());

        DB::transaction(function () use ($vendor, $store, $dates, $shiftKeys, $shiftDefs, $maxOrders, $leadTime, &$created, &$skipped) {
            foreach ($dates as $date) {
                foreach ($shiftKeys as $shift) {
                    $def = $shiftDefs[$shift];

                    $existing = DeliverySlot::query()
                        ->forStore($store->id)
                        ->whereDate('slot_date', $date)
                        ->where('start_time', $def['start'])
                        ->first();

                    if ($existing) {
                        $skipped[] = ['date' => $date, 'shift' => $shift, 'reason' => 'duplicate_slot'];

                        continue;
                    }

                    // Daily limit check (per vendor, across stores).
                    $dailyCount = DeliverySlot::query()
                        ->forVendor($vendor->id)
                        ->whereDate('slot_date', $date)
                        ->count();

                    if ($dailyCount >= (int) config('delivery_slots.max_slots_per_day', 12)) {
                        $skipped[] = ['date' => $date, 'shift' => $shift, 'reason' => 'daily_limit_reached'];

                        continue;
                    }

                    try {
                        $slot = DeliverySlot::create([
                            'vendor_id' => $vendor->id,
                            'store_id' => $store->id,
                            'slot_date' => $date,
                            'start_time' => $def['start'],
                            'end_time' => $def['end'],
                            'shift' => $shift,
                            'slot_timezone' => $this->timezone(),
                            'max_orders' => max(1, $maxOrders),
                            'booked_orders' => 0,
                            'lead_time_min' => max((int) config('delivery_slots.min_lead_time_min', 0), $leadTime),
                            'is_active' => true,
                        ]);
                        $created[] = $slot;
                    } catch (QueryException $e) {
                        if ($this->isDuplicateSlot($e)) {
                            $skipped[] = ['date' => $date, 'shift' => $shift, 'reason' => 'duplicate_slot'];

                            continue;
                        }

                        throw $e;
                    }
                }
            }
        });

        return [
            'created' => $created,
            'skipped' => $skipped,
            'created_count' => count($created),
            'skipped_count' => count($skipped),
        ];
    }

    /**
     * @param  array{slot_date?: string, start_time?: string, end_time?: string, max_orders?: int, lead_time_min?: int, is_active?: bool}  $data
     */
    public function updateForVendor(Vendor $vendor, DeliverySlot $slot, array $data): DeliverySlot
    {
        $attributes = $this->slotAttributes(array_merge([
            'slot_date' => $slot->slot_date->format('Y-m-d'),
            'start_time' => $this->formatTime($slot->start_time),
            'end_time' => $this->formatTime($slot->end_time),
        ], $data));

        $this->assertDateWithinHorizon($attributes['slot_date']);

        $dateChanged = $attributes['slot_date'] !== $slot->slot_date->format('Y-m-d');
        $this->assertWithinDailyLimit($vendor, $attributes['slot_date'], $dateChanged ? $slot : null);

        if (isset($data['max_orders']) && (int) $data['max_orders'] < (int) $slot->booked_orders) {
            throw new DeliverySlotException(
                "Capacity cannot be lower than the {$slot->booked_orders} order(s) already booked.",
                'capacity_below_booked'
            );
        }

        if (isset($data['is_active']) && ! $data['is_active'] && (int) $slot->booked_orders > 0) {
            throw new DeliverySlotException(
                'This slot has booked orders. Move or cancel them before disabling it.',
                'slot_has_bookings'
            );
        }

        try {
            $slot->update($attributes);
        } catch (QueryException $e) {
            if ($this->isDuplicateSlot($e)) {
                throw new DeliverySlotException('This store already has a slot starting at that time on that date.', 'duplicate_slot');
            }

            throw $e;
        }

        return $slot->refresh();
    }

    public function deleteForVendor(Vendor $vendor, DeliverySlot $slot): void
    {
        if ((int) $slot->booked_orders > 0) {
            throw new DeliverySlotException(
                "This slot has {$slot->booked_orders} booked order(s) and cannot be deleted.",
                'slot_has_bookings'
            );
        }

        $slot->delete();
    }

    // ---------------------------------------------------------------------
    // Customer availability
    // ---------------------------------------------------------------------

    /**
     * Bookable slots for a store, grouped by local date order.
     *
     * @return Collection<int, DeliverySlot>
     */
    public function availabilityForStore(Store $store, ?int $days = null): Collection
    {
        if (! $store->supports_scheduled_delivery) {
            return new Collection;
        }

        $window = $days ? max(1, min($days, $this->bookingWindowDays())) : $this->bookingWindowDays();
        $today = $this->firstBookableDate();
        $last = $today->copy()->addDays($window - 1);
        $now = Carbon::now('UTC');

        return DeliverySlot::query()
            ->forStore($store->id)
            ->where('is_active', true)
            ->whereNotNull('slot_date')
            ->whereDate('slot_date', '>=', $today->format('Y-m-d'))
            ->whereDate('slot_date', '<=', $last->format('Y-m-d'))
            ->orderBy('slot_date')
            ->orderBy('start_time')
            ->get()
            ->filter(fn (DeliverySlot $slot) => $slot->isBookableAt($now))
            ->values();
    }

    // ---------------------------------------------------------------------
    // Booking
    // ---------------------------------------------------------------------

    /**
     * Reserve one place in a slot for an order.
     *
     * MUST be called inside the order creation transaction: the slot row is
     * locked for the rest of the transaction, so a rollback also rolls back the
     * capacity, and two concurrent checkouts cannot both take the last place.
     *
     * @return array{slot: DeliverySlot, starts_at: Carbon, snapshot: array<string, mixed>}
     */
    public function book(int $slotId, int $vendorId, ?int $storeId): array
    {
        $slot = DeliverySlot::whereKey($slotId)->lockForUpdate()->first();

        if (! $slot) {
            throw new DeliverySlotException('This delivery slot is no longer available.', 'slot_not_found');
        }

        if (! $slot->is_active) {
            throw new DeliverySlotException('This delivery slot is no longer available.', 'slot_disabled');
        }

        if (! $slot->slot_date) {
            throw new DeliverySlotException('This delivery slot is no longer available.', 'slot_not_found');
        }

        if ((int) $slot->vendor_id !== $vendorId) {
            throw new DeliverySlotException('This delivery slot belongs to another store.', 'slot_foreign_vendor');
        }

        if ($storeId !== null && (int) $slot->store_id !== $storeId) {
            throw new DeliverySlotException('This delivery slot belongs to another store.', 'slot_foreign_store');
        }

        $store = $slot->store_id === null ? null : Store::find($slot->store_id);

        if (! $store || ! $store->supports_scheduled_delivery) {
            throw new DeliverySlotException('This store does not accept scheduled delivery.', 'store_scheduling_disabled');
        }

        if (! $this->isWithinBookingWindow($slot->slot_date->format('Y-m-d'))) {
            throw new DeliverySlotException('This delivery slot is outside the booking window.', 'slot_out_of_window');
        }

        $now = Carbon::now('UTC');

        if ($slot->bookableUntil()->lessThanOrEqualTo($now)) {
            throw new DeliverySlotException('This delivery slot can no longer be booked.', 'slot_closed');
        }

        if (! $slot->hasCapacity()) {
            throw new DeliverySlotException('This delivery slot is fully booked.', 'slot_full');
        }

        $slot->increment('booked_orders');
        $slot->refresh();

        $startsAt = $slot->startsAt();

        return [
            'slot' => $slot,
            'starts_at' => $startsAt,
            'snapshot' => $this->snapshot($slot, $startsAt),
        ];
    }

    /**
     * Hand a booked place back when an order is cancelled.
     *
     * The `slot_released_at` compare-and-set makes this exactly-once even if
     * the cancellation path runs twice.
     */
    /**
     * Give a slot's capacity back to the vendor.
     *
     * Only an order that was cancelled before it ran holds capacity hostage, so
     * anything else (including a delivered order) keeps its booked seat. The
     * compare-and-set on `slot_released_at` keeps this exactly-once even when
     * cancellation and slot cleanup race.
     */
    public function releaseForOrder(Order $order): bool
    {
        if (! $order->delivery_slot_id || $order->slot_released_at) {
            return false;
        }

        if ($order->status !== 'CANCELLED') {
            return false;
        }

        $claimed = Order::whereKey($order->id)
            ->whereNull('slot_released_at')
            ->update(['slot_released_at' => Carbon::now('UTC')]);

        if ($claimed === 0) {
            return false;
        }

        $slot = DeliverySlot::whereKey($order->delivery_slot_id)->lockForUpdate()->first();

        if ($slot && (int) $slot->booked_orders > 0) {
            $slot->decrement('booked_orders');
        }

        return true;
    }

    /**
     * Immutable record of the slot the customer chose, stored on the order so
     * later slot edits cannot rewrite history.
     *
     * @return array<string, mixed>
     */
    public function snapshot(DeliverySlot $slot, ?Carbon $startsAt = null): array
    {
        $startsAt ??= $slot->startsAt();

        return [
            'delivery_mode' => self::MODE_SCHEDULED,
            'slot_id' => (int) $slot->id,
            'store_id' => $slot->store_id === null ? null : (int) $slot->store_id,
            'vendor_id' => $slot->vendor_id === null ? null : (int) $slot->vendor_id,
            'slot_date' => $slot->slot_date->format('Y-m-d'),
            'start_time' => $this->formatTime($slot->start_time),
            'end_time' => $this->formatTime($slot->end_time),
            'label' => $slot->label,
            'timezone' => $slot->timezone(),
            'lead_time_min' => (int) $slot->lead_time_min,
            'starts_at' => $startsAt->toIso8601String(),
            'ends_at' => $slot->endsAt()->toIso8601String(),
            'booked_at' => Carbon::now('UTC')->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function asapSnapshot(): array
    {
        return ['delivery_mode' => self::MODE_ASAP];
    }

    // ---------------------------------------------------------------------
    // Activation
    // ---------------------------------------------------------------------

    /**
     * Release SCHEDULED grocery orders whose slot has started into the normal
     * PENDING flow, where the vendor picks them up like any other order.
     */
    /**
     * Move due scheduled grocery orders into the normal vendor queue.
     *
     * A slot booking is due when its slot has started, which lives in the
     * timezone-aware slot start rather than `scheduled_at`. The candidate query
     * only pre-filters on the local date so the precise comparison happens in
     * PHP against the real instant, and the batch stays meaningful.
     */
    public function activateDueOrders(int $limit = 200): int
    {
        $today = Carbon::now($this->timezone())->format('Y-m-d');

        $candidates = Order::query()
            ->where('order_type', 'grocery')
            ->where('status', 'SCHEDULED')
            ->where(function ($query) use ($today) {
                $query->whereHas('deliverySlot', fn ($slot) => $slot->whereDate('slot_date', '<=', $today))
                    ->orWhere('scheduled_at', '<=', Carbon::now('UTC'));
            })
            ->orderBy('id')
            ->limit(max(1, $limit))
            ->get(['id', 'delivery_slot_id', 'scheduled_at']);

        $now = Carbon::now('UTC');
        $activated = 0;

        foreach ($candidates as $order) {
            if (! $this->isDue($order, $now)) {
                continue;
            }

            try {
                if ($this->activateOrder((int) $order->id)) {
                    $activated++;
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return $activated;
    }

    /**
     * Whether a scheduled order's booked slot has already started.
     */
    private function isDue(Order $order, Carbon $now): bool
    {
        if ($order->delivery_slot_id) {
            $slot = DeliverySlot::find($order->delivery_slot_id);

            if ($slot && $slot->slot_date) {
                return $slot->startsAt()->lessThanOrEqualTo($now);
            }
        }

        return $order->scheduled_at !== null && $order->scheduled_at->lessThanOrEqualTo($now);
    }

    public function activateOrder(int $orderId): bool
    {
        $activated = DB::transaction(function () use ($orderId) {
            $order = Order::whereKey($orderId)->lockForUpdate()->first();

            if (! $order || $order->status !== 'SCHEDULED') {
                return false;
            }

            OrderStateMachine::assertCanTransition($order, 'PENDING');

            $meta = $order->meta ?? [];
            $schedule = is_array($meta['delivery_schedule'] ?? null) ? $meta['delivery_schedule'] : [];
            $schedule['activated_at'] = Carbon::now('UTC')->toIso8601String();
            $meta['delivery_schedule'] = $schedule;

            $order->update(['status' => 'PENDING', 'meta' => $meta]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => 'PENDING',
                'old_status' => 'SCHEDULED',
                'new_status' => 'PENDING',
                'changed_at' => Carbon::now('UTC'),
                'notes' => 'Scheduled delivery slot started',
                'changed_by_type' => 'system',
            ]);

            return true;
        });

        if ($activated) {
            $fresh = Order::find($orderId);

            if ($fresh) {
                $this->webhookNotifier->orderUpdated($fresh);

                DB::afterCommit(function () use ($fresh) {
                    BroadcastOrderTracking::dispatch($fresh->id, [
                        ['type' => 'order_updated'],
                        ['type' => 'vendor_order_updated'],
                    ]);
                });
            }
        }

        return $activated;
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function slotAttributes(array $data): array
    {
        $date = Carbon::parse($data['slot_date'])->format('Y-m-d');
        $start = $this->formatTime($data['start_time']);
        $end = $this->formatTime($data['end_time']);

        if ($end === $start) {
            throw new DeliverySlotException('The slot end time must be different from its start time.', 'invalid_window');
        }

        $leadTime = (int) ($data['lead_time_min'] ?? $this->defaultLeadTimeMin());

        return [
            'slot_date' => $date,
            'start_time' => $start,
            'end_time' => $end,
            'slot_timezone' => $this->timezone(),
            'max_orders' => max(1, (int) ($data['max_orders'] ?? 10)),
            'lead_time_min' => max((int) config('delivery_slots.min_lead_time_min', 0), $leadTime),
            'is_active' => (bool) ($data['is_active'] ?? true),
        ];
    }

    private function formatTime(mixed $time): string
    {
        if ($time instanceof \DateTimeInterface) {
            return $time->format('H:i:s');
        }

        return Carbon::parse((string) $time)->format('H:i:s');
    }

    private function isWithinBookingWindow(string $date): bool
    {
        $today = $this->firstBookableDate();

        return Carbon::parse($date)->betweenIncluded($today, $this->lastBookableDate());
    }

    private function assertDateWithinHorizon(string $date): void
    {
        $last = $this->firstBookableDate()->copy()->addDays($this->horizonDays() - 1);

        if (Carbon::parse($date)->greaterThan($last) || Carbon::parse($date)->lessThan($this->firstBookableDate())) {
            throw new DeliverySlotException(
                "Slots can only be published between today and {$last->format('Y-m-d')}.",
                'slot_out_of_horizon'
            );
        }
    }

    private function assertWithinDailyLimit(Vendor $vendor, string $date, ?DeliverySlot $ignore): void
    {
        $limit = (int) config('delivery_slots.max_slots_per_day', 12);
        $query = DeliverySlot::query()->forVendor($vendor->id)->whereDate('slot_date', $date);

        if ($ignore) {
            $query->whereKeyNot($ignore->id);
        }

        if ($query->count() >= $limit) {
            throw new DeliverySlotException("A store can publish at most {$limit} slots per day.", 'daily_limit_reached');
        }
    }

    private function isDuplicateSlot(QueryException $e): bool
    {
        $driverCode = (int) ($e->errorInfo[1] ?? 0);

        if ($driverCode === 1062 || $driverCode === 19 || (int) $e->getCode() === 19) {
            return true;
        }

        $message = $e->getMessage();

        return str_contains($message, 'delivery_slots_vendor_store_date_start_unique')
            || (str_contains($message, 'delivery_slots') && str_contains($message, 'UNIQUE constraint failed'));
    }
}
