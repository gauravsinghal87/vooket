<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'order_number',
        'idempotency_key',
        'idempotency_fingerprint',
        'user_id',
        'vendor_id',
        'restaurant_id',
        'store_id',
        'order_type',
        'status',
        'payment_status',
        'payment_method',
        'address_id',
        'pickup_zone_id',
        'drop_zone_id',
        'delivery_address_snapshot',
        'subtotal',
        'discount_amount',
        'tax_amount',
        'delivery_fee',
        'delivery_gst_percent',
        'delivery_gst_amount',
        'packaging_fee',
        'handling_fee',
        'platform_fee',
        'total_amount',
        'wallet_used',
        'coupon_discount',
        'coupon_code',
        'tip_amount',
        'round_off',
        'delivery_partner_id',
        'preparation_time_min',
        'timing_type',
        'scheduled_at',
        'delivery_slot_id',
        'slot_released_at',
        'confirmed_at',
        'preparing_at',
        'picking_at',
        'packed_at',
        'ready_at',
        'partner_assigned_at',
        'picked_up_at',
        'out_for_delivery_at',
        'arrived_at',
        'delivered_at',
        'delivery_payment_collected_at',
        'delivery_payment_collected_via',
        'delivery_payment_settled_at',
        'delivery_otp_verified_at',
        'delivery_otp_resend_count',
        'cancelled_at',
        'cancel_reason',
        'cancelled_by_type',
        'cancelled_by',
        'customer_note',
        'substitution_preference',
        'original_subtotal',
        'original_delivery_fee',
        'original_total',
        'commission_fee',
        'net_vendor_payout',
        'vendor_payout_status',
        'vendor_payout_at',
        'partner_payout',
        'partner_payout_status',
        'partner_payout_at',
        'refund_amount',
        'refund_status',
        'refunded_at',
        'delivered_via',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'delivery_address_snapshot' => 'array',
            'discount_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
            'delivery_gst_amount' => 'decimal:2',
            'packaging_fee' => 'decimal:2',
            'handling_fee' => 'decimal:2',
            'platform_fee' => 'decimal:2',
            'total_amount' => 'decimal:2',
            'wallet_used' => 'decimal:2',
            'coupon_discount' => 'decimal:2',
            'tip_amount' => 'decimal:2',
            'round_off' => 'decimal:2',
            'scheduled_at' => 'datetime',
            'slot_released_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'preparing_at' => 'datetime',
            'picking_at' => 'datetime',
            'packed_at' => 'datetime',
            'ready_at' => 'datetime',
            'partner_assigned_at' => 'datetime',
            'picked_up_at' => 'datetime',
            'out_for_delivery_at' => 'datetime',
            'arrived_at' => 'datetime',
            'delivered_at' => 'datetime',
            'delivery_payment_collected_at' => 'datetime',
            'delivery_payment_settled_at' => 'datetime',
            'delivery_otp_verified_at' => 'datetime',
            'delivery_otp_resend_count' => 'integer',
            'cancelled_at' => 'datetime',
            'commission_fee' => 'decimal:2',
            'net_vendor_payout' => 'decimal:2',
            'partner_payout' => 'decimal:2',
            'vendor_payout_at' => 'datetime',
            'partner_payout_at' => 'datetime',
            'refund_amount' => 'decimal:2',
            'refunded_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    /**
     * The grocery delivery slot this order was booked into, if any.
     */
    public function deliverySlot(): BelongsTo
    {
        return $this->belongsTo(DeliverySlot::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function restaurant()
    {
        return $this->belongsTo(Restaurant::class);
    }

    public function store()
    {
        return $this->belongsTo(Store::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusHistory()
    {
        return $this->hasMany(OrderStatusHistory::class);
    }

    public function deliveryPartner()
    {
        return $this->belongsTo(DeliveryPartner::class);
    }

    public function address()
    {
        return $this->belongsTo(Address::class);
    }

    public function pickupZone()
    {
        return $this->belongsTo(Zone::class, 'pickup_zone_id');
    }

    public function dropZone()
    {
        return $this->belongsTo(Zone::class, 'drop_zone_id');
    }

    public function dispatchLogs()
    {
        return $this->hasMany(DispatchLog::class);
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }

    public function refunds(): MorphMany
    {
        return $this->morphMany(Refund::class, 'refundable');
    }

    public function deliveryPartnerEarnings(): HasMany
    {
        return $this->hasMany(DeliveryPartnerEarning::class);
    }

    public function settlementItems(): HasMany
    {
        return $this->hasMany(SettlementItem::class, 'source_id')
            ->where('source_type', 'order');
    }

    public function walletTransactions(): HasMany
    {
        return $this->hasMany(WalletTransaction::class, 'reference_id')
            ->whereIn('reference_type', ['order', self::class]);
    }

    /**
     * Fields of `meta.delivery_pricing` that are safe to show a customer.
     *
     * The Admin-funded delivery cost and the raw setting keys/values are
     * commercial internals, so they are stripped from every customer-facing
     * response while remaining on the order for settlement and audit.
     *
     * @var array<int, string>
     */
    private const CUSTOMER_PRICING_FIELDS = [
        'delivery_mode',
        'scheduled_delivery_type',
        'distance_km',
        'customer_delivery_fee',
        'delivery_gst_percent',
        'delivery_gst_amount',
        'packaging_charge',
        'handling_fee',
    ];

    /**
     * Replace the in-memory pricing snapshot with its customer-safe subset.
     *
     * Deliberately mutates only the loaded model, never the database, so the
     * full snapshot still drives partner earnings and settlement. Call it on the
     * model instance just before returning it from a customer endpoint.
     */
    public function hideInternalPricingSnapshot(): self
    {
        $meta = $this->meta;
        $snapshot = is_array($meta['delivery_pricing'] ?? null) ? $meta['delivery_pricing'] : null;

        if ($snapshot === null) {
            return $this;
        }

        $meta['delivery_pricing'] = array_intersect_key($snapshot, array_flip(self::CUSTOMER_PRICING_FIELDS));
        $this->setAttribute('meta', $meta);

        return $this;
    }
}
