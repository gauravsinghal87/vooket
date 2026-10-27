<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A dated grocery delivery slot published by a grocery vendor for one of its
 * stores.
 *
 * `slot_date`, `start_time` and `end_time` are local wall-clock values in
 * `slot_timezone`. Use `startsAt()` / `endsAt()` for any comparison against
 * the current time, never `now()` in SQL.
 */
class DeliverySlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'store_id',
        'vendor_id',
        'slot_date',
        'start_time',
        'end_time',
        'shift',
        'slot_timezone',
        'max_orders',
        'booked_orders',
        'lead_time_min',
        'is_active',
    ];

    protected $appends = ['label', 'availability', 'starts_at', 'ends_at', 'is_bookable'];

    public function timezone(): string
    {
        return $this->slot_timezone ?: (string) config('delivery_slots.timezone', 'UTC');
    }

    /**
     * Local calendar date of the slot as `Y-m-d`, independent of the cast.
     */
    public function localDate(): string
    {
        $date = $this->slot_date;

        return $date instanceof \DateTimeInterface
            ? $date->format('Y-m-d')
            : (string) $date;
    }

    /**
     * Slot start as an absolute UTC instant.
     */
    public function startsAt(): Carbon
    {
        return Carbon::parse(
            $this->localDate().' '.$this->localTime($this->start_time),
            $this->timezone()
        )->utc();
    }

    /**
     * Slot end as an absolute UTC instant. A slot whose end time is not after
     * its start time is treated as running past midnight.
     */
    public function endsAt(): Carbon
    {
        $start = $this->startsAt();
        $end = Carbon::parse(
            $this->localDate().' '.$this->localTime($this->end_time),
            $this->timezone()
        )->utc();

        return $end->lessThanOrEqualTo($start) ? $end->addDay() : $end;
    }

    /**
     * Latest instant at which this slot may still be booked: the slot start
     * minus the slot's lead time.
     */
    public function bookableUntil(): Carbon
    {
        return $this->startsAt()->subMinutes(max(0, (int) $this->lead_time_min));
    }

    public function hasCapacity(): bool
    {
        return (int) $this->booked_orders < (int) $this->max_orders;
    }

    public function isBookableAt(?Carbon $moment = null): bool
    {
        $moment ??= Carbon::now('UTC');

        return (bool) $this->is_active
            && $this->hasCapacity()
            && $this->bookableUntil()->greaterThan($moment);
    }

    public function getLabelAttribute(): string
    {
        $fmt = fn ($time) => Carbon::parse($time)->format('g:i A');

        return "{$fmt($this->start_time)} – {$fmt($this->end_time)}";
    }

    /**
     * Local wall-clock time as `H:i:s`, whatever the driver hands back.
     */
    private function localTime(mixed $time): string
    {
        if ($time instanceof \DateTimeInterface) {
            return $time->format('H:i:s');
        }

        return Carbon::parse((string) $time)->format('H:i:s');
    }

    public function getAvailabilityAttribute(): int
    {
        return max(0, (int) $this->max_orders - (int) $this->booked_orders);
    }

    public function getStartsAtAttribute(): ?string
    {
        return $this->slot_date ? $this->startsAt()->toIso8601String() : null;
    }

    public function getEndsAtAttribute(): ?string
    {
        return $this->slot_date ? $this->endsAt()->toIso8601String() : null;
    }

    public function getIsBookableAttribute(): bool
    {
        return $this->isBookableAt();
    }

    protected function casts(): array
    {
        return [
            'slot_date' => 'date:Y-m-d',
            'max_orders' => 'integer',
            'booked_orders' => 'integer',
            'lead_time_min' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function scopeForVendor(Builder $query, int $vendorId): Builder
    {
        return $query->where('vendor_id', $vendorId);
    }

    public function scopeForStore(Builder $query, int $storeId): Builder
    {
        return $query->where('store_id', $storeId);
    }
}
