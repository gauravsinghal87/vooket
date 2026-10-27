<?php

namespace App\Http\Controllers\API;

use App\Exceptions\DeliveryGateException;
use App\Exceptions\InvalidOrderTransitionException;
use App\Exceptions\OtpCooldownException;
use App\Exceptions\PartnerWalletBalanceException;
use App\Jobs\BroadcastOrderTracking;
use App\Jobs\BroadcastPartnerLocation;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\WalletTransaction;
use App\Services\DeliveryOtpService;
use App\Services\DeliveryService;
use App\Services\Dispatch\GroceryBatchService;
use App\Services\Dispatch\OrderDispatchService;
use App\Services\Dispatch\OrderServiceTypeResolver;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\Integration\WebhookNotifier;
use App\Services\PaymentService;
use App\Services\Tracking\PartnerLocationService;
use App\Services\WalletService;
use App\Services\WithdrawalService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class DeliveryPartnerController extends BaseController
{
    public function profile(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        return $this->success($partner);
    }

    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'vehicle_type' => 'sometimes|string|max:50',
            'vehicle_number' => 'sometimes|string|max:20',
            'vehicle_model' => 'sometimes|string|max:100',
            'vehicle_color' => 'sometimes|string|max:50',
            'license_number' => 'sometimes|string|max:50',
            'license_expiry' => 'sometimes|date|after:today',
            'aadhar_number' => 'sometimes|string|max:20',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $partner->update($validator->validated());

            return $this->success($partner->fresh(), 'Profile updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function uploadDocuments(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'documents' => 'required|array|min:1',
            'documents.*.type' => 'required|string|in:license,insurance,rc,profile_photo,aadhar',
            'documents.*.file' => 'required|file|max:5120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $currentDocs = $partner->documents ?? [];

            foreach ($request->documents as $doc) {
                $path = $doc['file']->store('delivery-partner-documents', 'public');
                $currentDocs[] = [
                    'type' => $doc['type'],
                    'file_path' => $path,
                    'filename' => $doc['file']->getClientOriginalName(),
                    'status' => 'pending',
                ];
            }

            $partner->update(['documents' => $currentDocs]);

            return $this->success($partner->fresh()->documents, 'Documents uploaded', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateBank(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'bank_account_name' => 'required|string|max:255',
            'bank_account_number' => 'required|string|max:30',
            'bank_ifsc' => 'required|string|max:20',
            'bank_name' => 'sometimes|string|max:100',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $partner->update($validator->validated());

            return $this->success($partner->fresh(), 'Bank details updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function toggleAvailability(Request $request)
    {
        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            if (in_array($partner->status, ['pending', 'rejected', 'suspended'])) {
                return $this->error(
                    'Your application is '.$partner->status.'. You can go online only after it is approved.',
                    null,
                    422
                );
            }

            $partner->update(['is_online' => ! $partner->is_online]);

            if ($partner->fresh()->is_online) {
                $this->dispatchNearbyOrders($partner->fresh());
            }

            return $this->success([
                'is_online' => $partner->fresh()->is_online,
            ], 'Availability updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateLocation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'heading' => 'sometimes|numeric|between:0,360',
            'speed' => 'sometimes|numeric|between:0,180',
            'accuracy' => 'sometimes|numeric|between:0,5000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            try {
                $partner = app(PartnerLocationService::class)->update($partner, $request->only([
                    'latitude',
                    'longitude',
                    'heading',
                    'speed',
                    'accuracy',
                ]));
            } catch (\InvalidArgumentException $e) {
                return $this->error($e->getMessage(), null, 422);
            }

            if ($partner->is_online) {
                $this->dispatchNearbyOrders($partner);
            }

            BroadcastPartnerLocation::dispatch($partner->id);

            return $this->success([
                'is_stale' => app(PartnerLocationService::class)->isStale($partner),
                'last_location_at' => $partner->last_location_at?->toISOString(),
            ], 'Location updated');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    private function dispatchNearbyOrders(DeliveryPartner $partner): void
    {
        try {
            app(OrderDispatchService::class)->dispatchForArea($partner);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    public function incomingOrders(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        $dispatchService = app(OrderDispatchService::class);

        $expiredLogs = DispatchLog::where('candidate_id', $partner->id)
            ->where('candidate_type', DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER)
            ->where('status', DispatchLog::STATUS_PENDING)
            ->where('expires_at', '<', now())
            ->get();

        foreach ($expiredLogs as $log) {
            $log->update(['status' => DispatchLog::STATUS_EXPIRED]);
            $dispatchService->announceOfferExpired($log);
            $order = $log->order;
            if ($order) {
                $dispatchService->promoteNext($order);
            }
        }

        $dispatchLogs = DispatchLog::where('candidate_id', $partner->id)
            ->where('candidate_type', DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER)
            ->where('status', DispatchLog::STATUS_PENDING)
            ->where('expires_at', '>', now())
            ->whereHas('order', fn ($q) => $q->where('order_type', $partner->service_type))
            ->with(['order' => fn ($q) => $q->with('items', 'vendor', 'address')])
            ->latest()
            ->get();

        // Tell the partner up front whether taking an offer opens a new trip or
        // extends the one they are already on, and why it may be refused.
        $batchService = app(GroceryBatchService::class);
        $openBatch = $batchService->activeBatch($partner);

        $dispatchLogs->each(function (DispatchLog $log) use ($batchService, $openBatch, $partner) {
            $order = $log->order;

            $meta = (array) $log->meta;

            if (! $order || ! $batchService->isBatchableOrder($order)) {
                $meta['trip'] = ['mode' => 'single'];

                $log->meta = $meta;
                $log->save();

                return;
            }

            $evaluation = $batchService->evaluateAdd($partner, $order, $openBatch);

            $meta['trip'] = [
                'mode' => $openBatch ? 'extend' : 'open',
                'current_stops' => $openBatch ? (int) $openBatch->stop_count : 0,
                'max_stops' => GroceryBatchService::maxOrdersPerBatch(),
                'can_accept' => $openBatch ? $evaluation['eligible'] : true,
                'reasons' => $evaluation['reasons'],
            ];

            $log->meta = $meta;
            $log->save();
        });

        return $this->success($dispatchLogs);
    }

    public function activeJob(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        // The assigned partner needs the customer's name and phone to complete
        // the hand-off, so expose only those two user columns (never email or
        // other account fields) alongside the rest of the order payload.
        $orders = Order::with('items', 'vendor', 'address', 'user:id,name,phone')
            ->where('delivery_partner_id', $partner->id)
            ->whereIn('status', GroceryBatchService::ACTIVE_ORDER_STATUSES)
            ->oldest('id')
            ->get();

        if ($orders->isEmpty()) {
            return $this->success(null, 'No active order');
        }

        $batchService = app(GroceryBatchService::class);
        $batch = $batchService->activeBatch($partner);

        // No grocery batch: keep the original flat single-order payload so
        // Food, Ride and ASAP grocery clients are entirely unaffected.
        if (! $batch) {
            $order = $orders->first();

            return $this->success($order, 'Active order');
        }

        $memberships = $batch->batchOrders()->get()->keyBy('order_id');

        // Sequence comes from the batch when there is one; otherwise preserve
        // assignment order so a single-order trip looks exactly as before.
        $ordered = $batch
            ? $memberships->sortBy('sequence')->pluck('order_id')
            : $orders->pluck('id');
        $byId = $orders->keyBy('id');
        $sequence = $ordered->map(fn ($id) => $byId->get($id))->filter()->values();

        $stops = $sequence->map(function (Order $order) use ($memberships) {
            $membership = $memberships->get($order->id);

            return [
                'sequence' => $membership?->sequence,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'order' => $order,
            ];
        })->values();

        // Trip progress, derived from server state. A stop leaves the batch once
        // it is delivered or cancelled, so completed stops are counted from the
        // partner's own deliveries since this trip opened. Without a known trip
        // start the count would span the partner's whole history, so report 0
        // rather than a number we cannot stand behind.
        $completedStops = $batch?->started_at
            ? Order::where('delivery_partner_id', $partner->id)
                ->where('status', 'DELIVERED')
                ->where('delivered_at', '>=', $batch->started_at)
                ->count()
            : 0;

        // The next actionable stop is the first live one that is not finished.
        $currentStop = $stops->first(
            fn (array $stop) => ! in_array($stop['status'], ['DELIVERED', 'CANCELLED'], true)
        );

        return $this->success([
            'batch_id' => $batch?->id,
            'batch_number' => $batch?->batch_number,
            'order_type' => $batch?->order_type ?? $orders->first()->order_type,
            'status' => $batch?->status,
            'stop_count' => $stops->count(),
            'remaining_stops' => $stops->count(),
            'completed_stops' => $completedStops,
            'current_stop' => $currentStop ? [
                'sequence' => $currentStop['sequence'],
                'order_id' => $currentStop['order_id'],
                'order_number' => $currentStop['order_number'],
                'status' => $currentStop['status'],
            ] : null,
            'max_stops' => GroceryBatchService::maxOrdersPerBatch(),
            'window_start' => $batch?->window_start?->toIso8601String(),
            'window_end' => $batch?->window_end?->toIso8601String(),
            'route' => $batch?->route,
            'stops' => $stops,
            // `order` keeps the previous single-order payload available so
            // existing partner clients keep working unchanged.
            'order' => $stops->first()['order'] ?? null,
            'orders' => $sequence->values(),
        ], 'Active order');
    }

    public function acceptOrder(Request $request, $dispatchLogId)
    {
        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $dispatchService = app(OrderDispatchService::class);
            $outcome = null;
            $dispatchLog = null;
            $assignedOrder = null;
            $rejectedOfferIds = collect();
            $serviceMismatchLabel = null;
            $lockedPartner = null;

            DB::transaction(function () use ($dispatchLogId, $partner, $dispatchService, &$outcome, &$dispatchLog, &$assignedOrder, &$rejectedOfferIds, &$serviceMismatchLabel, &$lockedPartner) {
                // Two offers for the same partner can be accepted at the same
                // moment. The trip capacity check below must be serialised, so
                // take the partner row lock first.
                $lockedPartner = DeliveryPartner::whereKey($partner->id)->lockForUpdate()->first();

                $dispatchLog = DispatchLog::where('id', $dispatchLogId)
                    ->where('candidate_id', $partner->id)
                    ->where('candidate_type', DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER)
                    ->where('status', DispatchLog::STATUS_PENDING)
                    ->lockForUpdate()
                    ->first();

                if (! $dispatchLog) {
                    $outcome = 'not_found';

                    return;
                }

                $order = Order::whereKey($dispatchLog->order_id)->lockForUpdate()->first();

                if (! $order) {
                    $outcome = 'not_found';

                    return;
                }

                if ($dispatchService->isOfferExpired($dispatchLog)) {
                    $dispatchLog->update(['status' => DispatchLog::STATUS_EXPIRED]);
                    $dispatchService->promoteNext($order);
                    $outcome = 'expired';

                    return;
                }

                $assignableStatuses = ['PENDING', 'READY', 'PLACED', 'CONFIRMED', 'PREPARING', 'PACKED', 'ACCEPTED'];
                if ($order->delivery_partner_id !== null || ! in_array($order->status, $assignableStatuses, true)) {
                    $meta = (array) $dispatchLog->meta;
                    $meta['expired_reason'] = 'order_no_longer_available';
                    $dispatchLog->update(['status' => DispatchLog::STATUS_EXPIRED, 'meta' => $meta]);
                    $dispatchService->promoteNext($order);
                    $outcome = 'unavailable';

                    return;
                }

                $serviceType = app(OrderServiceTypeResolver::class)->resolve($order);

                if ((string) $partner->service_type !== $serviceType) {
                    $outcome = 'service_mismatch';
                    $serviceMismatchLabel = app(OrderServiceTypeResolver::class)->label($serviceType);

                    return;
                }

                if (! $dispatchService->isEligiblePartner($lockedPartner, $order)) {
                    $outcome = 'ineligible';

                    return;
                }

                // A partner already on a grocery trip may still take a
                // compatible order, but only while the trip has room and the
                // merged route still fits the shared slot window. This runs
                // before any assignment so a full trip leaves the offer
                // pending for the next candidate instead of over-committing.
                $batchService = app(GroceryBatchService::class);
                $openBatch = $batchService->activeBatch($lockedPartner);

                if ($openBatch && $batchService->isBatchableOrder($order)) {
                    $verdict = $batchService->evaluateAdd($lockedPartner, $order, $openBatch);

                    if (! $verdict['eligible']) {
                        $meta = (array) $dispatchLog->meta;
                        $meta['batch_declined_reason'] = $verdict['reasons'];
                        $dispatchLog->update(['meta' => $meta]);
                        $outcome = 'trip_full';

                        return;
                    }
                }

                $dispatchLog->update(['status' => DispatchLog::STATUS_ACCEPTED]);

                $rejectedOfferIds = DispatchLog::where('order_id', $dispatchLog->order_id)
                    ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
                    ->where('id', '!=', $dispatchLog->id)
                    ->pluck('id');

                DispatchLog::where('order_id', $dispatchLog->order_id)
                    ->whereIn('status', [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_SENT])
                    ->where('id', '!=', $dispatchLog->id)
                    ->update(['status' => DispatchLog::STATUS_REJECTED]);

                $order->update([
                    'delivery_partner_id' => $partner->id,
                    'status' => 'PARTNER_ASSIGNED',
                    'partner_assigned_at' => now(),
                ]);

                // Freeze the earning carried by the accepted offer, so the figure
                // the partner agreed to is the figure credited on completion even
                // if an Admin changes the per-km rate mid-delivery.
                app(DeliveryService::class)->snapshotAcceptedOfferEarning($order);

                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'status' => 'PARTNER_ASSIGNED',
                    'notes' => 'Delivery partner accepted order',
                    'changed_by' => $partner->user_id,
                    'changed_by_type' => 'delivery_partner',
                ]);

                $lockedPartner->update(['is_busy' => true]);

                // Grocery batching: fold the newly accepted order into this
                // partner's trip, or open the trip if it is their first. Each
                // order keeps its own status/payment/OTP; the batch only groups
                // them and records the stop sequence. The partner row is locked
                // for this transaction, so the trip cannot be over-filled.
                $batchService->attach($lockedPartner, $order);

                $assignedOrder = $order;
                $outcome = 'assigned';
            });

            if ($outcome === 'not_found') {
                return $this->error('Dispatch not found', null, 404);
            }

            if ($outcome === 'expired') {
                app(OrderDispatchService::class)->announceOfferExpired($dispatchLog);

                return $this->error('Dispatch offer has expired', null, 410);
            }

            if ($outcome === 'unavailable') {
                app(OrderDispatchService::class)->announceOfferExpired($dispatchLog);

                return $this->error('Order is no longer available for dispatch', null, 409);
            }

            if ($outcome === 'ineligible') {
                return $this->error('You are no longer eligible to accept this delivery', null, 403);
            }

            if ($outcome === 'trip_full') {
                return $this->error('Your current trip is already full or cannot take this order', null, 409);
            }

            if ($outcome === 'service_mismatch') {
                return $this->error(
                    $serviceMismatchLabel.' requests cannot be accepted by a '.$partner->service_type.' delivery partner.',
                    null,
                    403
                );
            }

            app(WebhookNotifier::class)->deliveryAssigned($assignedOrder);

            BroadcastOrderTracking::dispatch($assignedOrder->id, [
                ['type' => 'order_updated'],
                ['type' => 'vendor_order_updated'],
                ['type' => 'assignment_confirmed', 'partner_id' => $partner->id],
            ]);

            foreach ($rejectedOfferIds as $offerId) {
                $offer = DispatchLog::find($offerId);

                if ($offer) {
                    app(OrderDispatchService::class)->announceOfferRejected($offer);
                }
            }

            $acceptance = DispatchLog::with(['order' => fn ($q) => $q->with('items', 'vendor', 'address')])
                ->where('id', $dispatchLogId)
                ->first();

            return $this->success($acceptance, 'Order accepted');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function rejectOrder(Request $request, $dispatchLogId)
    {
        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $dispatchLog = DispatchLog::where('id', $dispatchLogId)
                ->where('candidate_id', $partner->id)
                ->where('candidate_type', DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER)
                ->where('status', DispatchLog::STATUS_PENDING)
                ->first();

            if (! $dispatchLog) {
                return $this->error('Dispatch not found', null, 404);
            }

            $dispatchLog->update(['status' => DispatchLog::STATUS_REJECTED]);
            $partner->increment('rejected_orders');

            app(OrderDispatchService::class)->announceOfferRejected($dispatchLog);

            $order = $dispatchLog->order;
            if ($order) {
                app(OrderDispatchService::class)->promoteNext($order);
            }

            return $this->success(null, 'Order rejected');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function updateOrderStatus(Request $request, $orderId)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:picked_up,out_for_delivery,arrived,delivered',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $deliveryService = app(DeliveryService::class);

            $updated = match ($request->input('status')) {
                'picked_up' => $deliveryService->markPickedUp($order, $partner),
                'out_for_delivery' => $deliveryService->markOutForDelivery($order, $partner),
                'arrived' => $deliveryService->markArrived($order, $partner),
                'delivered' => $deliveryService->markDelivered($order, $partner),
            };

            // Generate and SMS the customer delivery OTP the moment the
            // partner reaches the door (best effort — a cooldown or already
            // sent code must not fail an otherwise valid arrival).
            if ($request->input('status') === 'arrived' && $updated->status === 'ARRIVED') {
                try {
                    app(DeliveryOtpService::class)->issue($updated);
                } catch (\Throwable $e) {
                    // Best-effort; the partner can always request it explicitly.
                }
            }

            return $this->success(
                $updated->refresh()->loadMissing(['vendor', 'items', 'address']),
                'Status updated'
            );
        } catch (InvalidOrderTransitionException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (OtpCooldownException $e) {
            return $this->error($e->getMessage(), null, 429);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function confirmPaymentCollection(Request $request, $orderId)
    {
        $validator = Validator::make($request->all(), [
            'method' => 'required|in:cash',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::with('items', 'vendor', 'address')
                ->where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $result = app(DeliveryService::class)->confirmPaymentCollection($order, $partner, $request->input('method'));

            $payment = $result['payment'];

            return $this->success([
                'order' => $result['order']->loadMissing(['vendor', 'items', 'address']),
                'payment' => $payment,
            ], 'Cash collected — settle the amount in your wallet');
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function settleCash(Request $request, $orderId)
    {
        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::with('items', 'vendor', 'address')
                ->where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $result = app(DeliveryService::class)->settleCashCollection($order, $partner);

            return $this->success([
                'order' => $result['order']->loadMissing(['vendor', 'items', 'address']),
                'payment' => $result['payment'],
                'settled' => $result['settled'],
            ], $result['settled'] ? 'Cash settlement complete' : 'Wallet balance is short of the settlement amount');
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function walletTopup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|gt:0',
            'payment_method' => 'required|in:upi,card,net_banking,wallet',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $payment = app(PaymentService::class)->initiateWalletTopup(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('payment_method'),
                $request->input('idempotency_key')
            );

            return $this->success($this->walletCheckoutPayload($payment), 'Top-up initiated', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function verifyWalletTopup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_number' => 'required|string',
            'provider_payment_id' => 'required|string',
            'provider_order_id' => 'required|string',
            'signature' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = app(PaymentService::class)->verifyPayment(
                $request->user(),
                $request->input('payment_number'),
                $request->input('provider_order_id'),
                $request->input('provider_payment_id'),
                $request->input('signature'),
                $request->ip(),
                $request->userAgent()
            );

            $walletService = app(WalletService::class);
            $wallet = $walletService->ensureWallet($request->user(), 'delivery_partner');

            return $this->success([
                'status' => $result['status'],
                'already_processed' => $result['already_processed'] ?? false,
                'payment_number' => $result['payment']->payment_number,
                'wallet' => [
                    'wallet_type' => $wallet->wallet_type,
                    'currency' => $wallet->currency,
                    'balance' => (float) $wallet->balance,
                    'pending_balance' => (float) $wallet->pending_balance,
                    'available_balance' => (float) $walletService->available($request->user(), 'delivery_partner')->major(),
                    'total_earned' => (float) $walletService->totalEarned($request->user(), 'delivery_partner')->major(),
                    'total_credited' => (float) $wallet->total_credited,
                    'total_debited' => (float) $wallet->total_debited,
                    'status' => $wallet->status,
                ],
            ], 'Wallet credited');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    private function walletCheckoutPayload(Payment $payment): array
    {
        $gateway = app(PaymentService::class)->gateway();
        $isMock = str_contains(get_class($gateway), 'MockPaymentProvider');

        return [
            'payment_number' => $payment->payment_number,
            'provider_order_id' => $payment->provider_order_id,
            'amount_paise' => (int) $payment->amount_paise,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency ?: 'INR',
            'method' => $payment->method,
            'key_id' => $isMock ? 'mock' : (app(IntegrationConfigResolver::class)->credentials('payments')['key_id'] ?? null),
            'mock' => $isMock,
        ];
    }

    public function requestDeliveryOtp(Request $request, $orderId)
    {
        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $result = app(DeliveryOtpService::class)->issue($order);

            return $this->success($result, 'Delivery OTP sent to the customer');
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (OtpCooldownException $e) {
            return $this->error($e->getMessage(), null, 429);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function verifyDeliveryOtp(Request $request, $orderId)
    {
        $validator = Validator::make($request->all(), [
            'otp' => 'required|digits:6',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::with('items', 'vendor', 'address')
                ->where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $updated = app(DeliveryOtpService::class)->verify($order, $request->input('otp'));

            return $this->success(
                $updated->refresh()->loadMissing(['vendor', 'items', 'address']),
                'Customer delivery OTP verified'
            );
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function uploadProof(Request $request, $orderId)
    {
        $validator = Validator::make($request->all(), [
            'proof_image' => 'required|image|mimes:jpeg,png,webp|max:5120',
            'notes' => 'sometimes|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            $order = Order::where('id', $orderId)
                ->where('delivery_partner_id', $partner->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $path = $request->file('proof_image')->store('delivery-proofs', 'public');

            $meta = $order->meta ?? [];
            $meta['delivery_proof'] = [
                'image_path' => $path,
                'notes' => $request->notes,
                'uploaded_at' => now()->toISOString(),
                'uploaded_by' => $partner->id,
            ];

            $order->update(['meta' => $meta]);

            return $this->success(['proof_path' => $path], 'Proof uploaded');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function earnings(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        $earnings = DeliveryPartnerEarning::where('delivery_partner_id', $partner->id)
            ->where('status', '!=', 'reversed');

        $todayEarnings = (clone $earnings)->whereDate('created_at', today())->sum('amount');

        $weekEarnings = (clone $earnings)->where('created_at', '>=', now()->startOfWeek())->sum('amount');

        $monthEarnings = (clone $earnings)->where('created_at', '>=', now()->startOfMonth())->sum('amount');

        $period = $request->string('period')->toString();
        $entries = (clone $earnings)
            ->with(['order.vendor'])
            ->when($period === 'today', fn ($q) => $q->whereDate('created_at', today()))
            ->when($period === 'week', fn ($q) => $q->where('created_at', '>=', now()->startOfWeek()))
            ->when($period === 'month', fn ($q) => $q->where('created_at', '>=', now()->startOfMonth()))
            ->latest('created_at')
            ->paginate(min($request->integer('per_page', 20), 50));

        return $this->success([
            'today' => round((float) $todayEarnings, 2),
            'this_week' => round((float) $weekEarnings, 2),
            'this_month' => round((float) $monthEarnings, 2),
            'total' => round((float) (clone $earnings)->sum('amount'), 2),
            'total_deliveries' => $partner->total_deliveries,
            'earnings' => $entries->through(fn (DeliveryPartnerEarning $earning) => $this->earningEntry($earning)),
            'payout' => $this->payoutOverview($request, 'delivery_partner'),
        ]);
    }

    /**
     * Wallet figures for the payout panel.
     *
     * Read through the withdrawal service so the ceiling shown to the partner is
     * the exact one `requestPartnerWithdrawal` enforces, floor included. Nothing
     * here is trusted by the payout path; it exists so the UI never offers an
     * amount the server will refuse.
     *
     * @return array{wallet_balance: float, minimum_wallet_balance: float, available_withdrawable_amount: float}
     */
    private function payoutOverview(Request $request, string $walletType): array
    {
        $withdrawalService = app(WithdrawalService::class);

        return [
            'wallet_balance' => (float) app(WalletService::class)->available($request->user(), $walletType)->major(),
            'minimum_wallet_balance' => (float) $withdrawalService->partnerMinimumWalletBalance()->major(),
            'available_withdrawable_amount' => (float) $withdrawalService->partnerMaximumPayout($request->user(), $walletType)->major(),
        ];
    }

    private function earningEntry(DeliveryPartnerEarning $earning): array
    {
        $order = $earning->order;
        $snapshot = $order?->delivery_address_snapshot;

        return [
            'id' => $earning->id,
            'earning_number' => $earning->earning_number,
            'amount' => (float) $earning->amount,
            'currency' => $earning->currency,
            'status' => $earning->status,
            'paid_at' => $earning->paid_at?->toISOString(),
            'created_at' => $earning->created_at?->toISOString(),
            'delivered_at' => $order?->delivered_at?->toISOString(),
            'order_id' => $order?->id,
            'order_number' => $order?->order_number,
            'order_type' => $order?->order_type,
            'vendor_name' => $order?->vendor?->business_name,
            'delivered_to' => is_array($snapshot) ? ($snapshot['city'] ?? null) : null,
            'breakdown' => $earning->meta['earning_breakdown'] ?? null,
        ];
    }

    public function withdrawals(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        $withdrawals = Payout::where('delivery_partner_id', $partner->id)
            ->latest()
            ->paginate($request->get('per_page', 15));

        return $this->success($withdrawals);
    }

    public function wallet(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        $walletService = app(WalletService::class);
        $walletService->reconcileFinalizedEarnings($request->user());

        $wallet = $walletService->ensureWallet($request->user(), 'delivery_partner');

        return $this->success([
            'wallet_type' => $wallet->wallet_type,
            'currency' => $wallet->currency,
            'balance' => (float) $wallet->balance,
            'pending_balance' => (float) $wallet->pending_balance,
            'available_balance' => (float) $walletService->available($request->user(), 'delivery_partner')->major(),
            'total_earned' => (float) $walletService->totalEarned($request->user(), 'delivery_partner')->major(),
            'total_credited' => (float) $wallet->total_credited,
            'total_debited' => (float) $wallet->total_debited,
            'status' => $wallet->status,
        ]);
    }

    public function walletTransactions(Request $request)
    {
        $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

        if (! $partner) {
            return $this->error('Delivery partner profile not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'service' => 'sometimes|string|max:30',
            'direction' => 'sometimes|in:credit,debit',
            'type' => 'sometimes|string|max:30',
            'from' => 'sometimes|date',
            'to' => 'sometimes|date',
            'per_page' => 'sometimes|integer|min:1|max:50',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $walletService = app(WalletService::class);
        $walletService->reconcileFinalizedEarnings($request->user());

        $transactions = $walletService->getTransactions(
            $request->user(),
            'delivery_partner',
            $validator->validated(),
            $request->integer('per_page', 15)
        );

        return $this->success($transactions->through(fn (WalletTransaction $transaction) => $this->walletTransactionEntry($transaction)));
    }

    private function walletTransactionEntry(WalletTransaction $transaction): array
    {
        return [
            'transaction_id' => $transaction->transaction_id,
            'type' => $transaction->type,
            'service' => $transaction->service,
            'direction' => $transaction->direction,
            'amount' => (float) $transaction->amount,
            'balance_before' => (float) $transaction->balance_before,
            'balance_after' => (float) $transaction->balance_after,
            'currency' => $transaction->currency,
            'status' => $transaction->status,
            'reference' => $transaction->reference_type ? $transaction->reference_id : null,
            'description' => $transaction->description,
            'created_at' => $transaction->created_at?->toISOString(),
        ];
    }

    public function requestWithdrawal(Request $request)
    {
        $validator = Validator::make($request->all(), [
            // Positivity only. Any real threshold is the configured
            // `partner_min_wallet_balance` floor, enforced server-side, so a
            // small payout is still allowed when the balance stays above it.
            'amount' => 'required|numeric|min:0.01',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $partner = DeliveryPartner::where('user_id', $request->user()->id)->first();

            if (! $partner) {
                return $this->error('Delivery partner profile not found', null, 404);
            }

            if (! $partner->bank_account_number || ! $partner->bank_ifsc) {
                return $this->error('Please add bank details first', null, 400);
            }

            $payout = app(WithdrawalService::class)->requestPartnerWithdrawal(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('idempotency_key')
            );

            return $this->success($payout, 'Withdrawal request submitted', 201);
        } catch (PartnerWalletBalanceException $e) {
            // Surface the field so the client can attach the message to the
            // amount input rather than showing a bare toast.
            return $this->error($e->getMessage(), ['amount' => [$e->getMessage()]], 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }
}
