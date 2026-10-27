<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ride extends Model
{
    use HasFactory;

    public const STATUS_REQUESTING = 'REQUESTING';

    public const STATUS_DRIVER_ASSIGNED = 'DRIVER_ASSIGNED';

    public const STATUS_DRIVER_ARRIVING = 'DRIVER_ARRIVING';

    public const STATUS_DRIVER_ARRIVED = 'DRIVER_ARRIVED';

    public const STATUS_IN_PROGRESS = 'IN_PROGRESS';

    public const STATUS_COMPLETED = 'COMPLETED';

    public const STATUS_CANCELLED = 'CANCELLED';

    public const STATUS_NO_DRIVER_FOUND = 'NO_DRIVER_FOUND';

    public const PAYMENT_STATUS_PENDING = 'PENDING';

    public const PAYMENT_STATUS_PAID = 'PAID';

    public const PAYMENT_STATUS_FAILED = 'FAILED';

    public const PAYMENT_METHOD_CASH = 'cash';

    public const PAYMENT_METHOD_WALLET = 'wallet';

    public const PAYMENT_METHOD_ONLINE = 'online';

    protected $fillable = [
        'ride_number',
        'idempotency_key',
        'idempotency_fingerprint',
        'user_id',
        'driver_id',
        'vehicle_id',
        'vehicle_type_id',
        'status',
        'pickup_address',
        'pickup_latitude',
        'pickup_longitude',
        'destination_address',
        'destination_latitude',
        'destination_longitude',
        'pickup_zone_id',
        'destination_zone_id',
        'pickup_latitude_actual',
        'pickup_longitude_actual',
        'destination_latitude_actual',
        'destination_longitude_actual',
        'distance_km',
        'duration_min',
        'base_fare',
        'distance_charge',
        'time_charge',
        'booking_fee',
        'platform_fee',
        'surge_multiplier',
        'surge_amount',
        'waiting_charge',
        'tip_amount',
        'discount_amount',
        'tax_amount',
        'estimated_fare',
        'final_fare',
        'coupon_code',
        'wallet_used',
        'payment_method',
        'payment_status',
        'cash_collected',
        'cash_collected_amount',
        'cash_collected_at',
        'cash_collected_via',
        'cash_settled',
        'cash_settled_at',
        'otp',
        'otp_verified',
        'otp_verified_at',
        'is_scheduled',
        'scheduled_at',
        'driver_assigned_at',
        'driver_arriving_at',
        'driver_arrived_at',
        'trip_started_at',
        'trip_completed_at',
        'cancelled_at',
        'cancel_reason',
        'cancelled_by_type',
        'cancelled_by',
        'route',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'pickup_latitude' => 'decimal:7',
            'pickup_longitude' => 'decimal:7',
            'destination_latitude' => 'decimal:7',
            'destination_longitude' => 'decimal:7',
            'pickup_latitude_actual' => 'decimal:7',
            'pickup_longitude_actual' => 'decimal:7',
            'destination_latitude_actual' => 'decimal:7',
            'destination_longitude_actual' => 'decimal:7',
            'distance_km' => 'decimal:2',
            'base_fare' => 'decimal:2',
            'distance_charge' => 'decimal:2',
            'time_charge' => 'decimal:2',
            'booking_fee' => 'decimal:2',
            'platform_fee' => 'decimal:2',
            'surge_multiplier' => 'decimal:2',
            'surge_amount' => 'decimal:2',
            'waiting_charge' => 'decimal:2',
            'tip_amount' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'estimated_fare' => 'decimal:2',
            'final_fare' => 'decimal:2',
            'wallet_used' => 'decimal:2',
            'otp_verified' => 'boolean',
            'otp_verified_at' => 'datetime',
            'is_scheduled' => 'boolean',
            'cash_collected' => 'boolean',
            'cash_collected_amount' => 'decimal:2',
            'cash_collected_at' => 'datetime',
            'cash_settled' => 'boolean',
            'cash_settled_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'driver_assigned_at' => 'datetime',
            'driver_arriving_at' => 'datetime',
            'driver_arrived_at' => 'datetime',
            'trip_started_at' => 'datetime',
            'trip_completed_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'route' => 'array',
            'meta' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function pickupZone()
    {
        return $this->belongsTo(Zone::class, 'pickup_zone_id');
    }

    public function destinationZone()
    {
        return $this->belongsTo(Zone::class, 'destination_zone_id');
    }

    public function statusHistory()
    {
        return $this->hasMany(RideStatusHistory::class);
    }

    public function rideRequests()
    {
        return $this->hasMany(RideRequest::class);
    }

    public function earning()
    {
        return $this->hasOne(DriverEarning::class);
    }

    public function payments()
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    /**
     * Total amount the customer owes for this ride. Online and wallet
     * payments are reconciled against this figure; a driver's cash
     * collection records the shortfall remaining at collection time.
     */
    public function payableAmount(): float
    {
        return round((float) ($this->final_fare ?? $this->estimated_fare ?? 0), 2);
    }

    /**
     * True when the customer's side of the payment is settled: an online or
     * wallet capture that fully covers the fare, or collected cash that has
     * been settled against the driver wallet. Accepts both the legacy
     * lowercase 'paid' written by the shared payment pipeline and the
     * uppercase ride constants.
     */
    public function isPaymentSettled(): bool
    {
        $paid = in_array((string) $this->payment_status, [self::PAYMENT_STATUS_PAID, 'paid'], true);

        if ($this->cash_collected) {
            return $paid && $this->cash_settled;
        }

        return $paid;
    }

    public function isCashCollected(): bool
    {
        return (bool) $this->cash_collected;
    }

    public function isCashSettled(): bool
    {
        return (bool) $this->cash_settled;
    }
}
