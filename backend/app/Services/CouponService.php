<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\CouponUsage;
use App\Models\Order;
use App\Models\User;
use App\Support\Money;
use RuntimeException;

/**
 * Server-authoritative coupon engine.
 *
 * Discounts are always computed from the current database state using the
 * exact integer paise arithmetic in App\Support\Money. Values supplied by
 * clients (discount amount, percentage, final total) are never trusted.
 */
class CouponService
{
    /** Coupon usage statuses that count against limits / redemption counts. */
    private const ACTIVE_REDEEMED_STATUSES = ['applied', 'used'];

    public function calculateDiscount(Coupon $coupon, Money $subtotal): Money
    {
        if (! $subtotal->isPositive()) {
            return Money::zero();
        }

        $discount = match ($coupon->type) {
            'percentage' => $subtotal->percent((string) $coupon->value),
            default => Money::fromMajor($coupon->value),
        };

        if ($coupon->type === 'percentage' && $coupon->max_discount !== null) {
            $max = Money::fromMajor($coupon->max_discount);
            if ($max->isPositive() && $discount->compareTo($max) > 0) {
                $discount = $max;
            }
        }

        if ($discount->compareTo($subtotal) > 0) {
            $discount = $subtotal;
        }

        return $discount;
    }

    /**
     * Validate a coupon against the current database/user state.
     *
     * @throws RuntimeException with a customer-safe message on any failure
     */
    public function validateForUser(Coupon $coupon, User $user, Money $subtotal, array $context = []): void
    {
        $now = now();

        if (! $coupon->is_active) {
            throw new RuntimeException('This coupon is not active');
        }

        if ($coupon->status !== 'active') {
            throw new RuntimeException('This coupon is not available');
        }

        if ($coupon->starts_at && $coupon->starts_at->gt($now)) {
            throw new RuntimeException('This coupon is not yet active');
        }

        if ($coupon->expires_at && $coupon->expires_at->lt($now)) {
            throw new RuntimeException('This coupon has expired');
        }

        $this->validateTimeWindow($coupon, $now);
        $this->validateDayOfWeek($coupon, $now);

        $service = $context['service'] ?? null;
        if ($service !== null && $coupon->service && $coupon->service !== 'all' && $coupon->service !== $service) {
            throw new RuntimeException('This coupon is not valid for this service');
        }

        if ($coupon->vendor_id && isset($context['vendor_id']) && (int) $coupon->vendor_id !== (int) $context['vendor_id']) {
            throw new RuntimeException('This coupon is not valid for this store');
        }

        if ($subtotal->compareTo(Money::fromMajor($coupon->min_order_amount)) < 0) {
            throw new RuntimeException('Minimum order amount of '.$coupon->min_order_amount.' required');
        }

        $this->validateCsvRestriction($coupon->category_ids, $context['category_ids'] ?? [], 'This coupon is not valid for items in your cart');
        $this->validateCsvRestriction($coupon->product_ids, $context['product_ids'] ?? [], 'This coupon is not valid for items in your cart');

        $this->validatePaymentMethod($coupon, $context['payment_method'] ?? null);
        $this->validateUserEligibility($coupon, $user);

        $this->assertUsageRemaining($coupon, $user);
    }

    /**
     * Server-authoritative resolve used only when a coupon is actually being
     * redeemed (order creation): loads the coupon with a row lock so that
     * concurrent checkouts serialize and usage limits cannot be exceeded.
     *
     * @return array{0: ?Coupon, 1: Money}
     */
    public function resolveForRedemption(?string $code, Money $subtotal, User $user, array $context = []): array
    {
        if (! $code) {
            return [null, Money::zero()];
        }

        $coupon = Coupon::where('code', $code)->lockForUpdate()->first();

        if (! $coupon) {
            throw new RuntimeException('Invalid coupon code');
        }

        $this->validateForUser($coupon, $user, $subtotal, $context);

        return [$coupon, $this->calculateDiscount($coupon, $subtotal)];
    }

    /**
     * Atomically record a redemption. Must be called while the coupon row is
     * locked inside the same transaction as order creation.
     */
    public function recordRedemption(Coupon $coupon, User $user, int $orderId, Money $discount, string $status = 'applied'): CouponUsage
    {
        $usage = CouponUsage::create([
            'coupon_id' => $coupon->id,
            'user_id' => $user->id,
            'order_id' => $orderId,
            'discount_amount' => $discount->major(),
            'status' => $status,
        ]);

        $coupon->increment('total_uses');

        return $usage;
    }

    private function validateTimeWindow(Coupon $coupon, \DateTimeInterface $now): void
    {
        if (! $coupon->time_start || ! $coupon->time_end) {
            return;
        }

        $current = $now->format('H:i:s');
        $start = (string) $coupon->time_start;
        $end = (string) $coupon->time_end;

        $inside = $start <= $end
            ? ($current >= $start && $current <= $end)
            : ($current >= $start || $current <= $end);

        if (! $inside) {
            throw new RuntimeException('This coupon is not valid at this time');
        }
    }

    private function validateDayOfWeek(Coupon $coupon, \DateTimeInterface $now): void
    {
        if (! $coupon->day_of_week || $coupon->day_of_week === 'all') {
            return;
        }

        if ((string) $now->format('w') !== $coupon->day_of_week) {
            throw new RuntimeException('This coupon is not valid today');
        }
    }

    private function validateCsvRestriction(?string $restrictions, array $present, string $message): void
    {
        if (! $restrictions) {
            return;
        }

        $allowed = array_map('intval', explode(',', $restrictions));
        $present = array_map('intval', $present);

        if (! array_intersect($allowed, $present)) {
            throw new RuntimeException($message);
        }
    }

    private function validatePaymentMethod(Coupon $coupon, ?string $paymentMethod): void
    {
        if (! $coupon->payment_methods || $coupon->payment_methods === 'all' || $paymentMethod === null) {
            return;
        }

        $allowed = match ($coupon->payment_methods) {
            'wallet' => ['wallet'],
            'online' => ['online', 'upi', 'card', 'net_banking'],
            'cod' => ['cash_on_delivery'],
            default => [],
        };

        if (! in_array(strtolower((string) $paymentMethod), $allowed, true)) {
            throw new RuntimeException('This coupon is not valid for the selected payment method');
        }
    }

    private function validateUserEligibility(Coupon $coupon, User $user): void
    {
        $hasOrders = Order::where('user_id', $user->id)->exists();

        if ($coupon->user_eligibility === 'new' && $hasOrders) {
            throw new RuntimeException('This coupon is valid for new customers only');
        }

        if ($coupon->user_eligibility === 'existing' && ! $hasOrders) {
            throw new RuntimeException('This coupon is valid for existing customers only');
        }

        if ($coupon->first_order_only && $hasOrders) {
            throw new RuntimeException('This coupon is valid for first orders only');
        }
    }

    private function assertUsageRemaining(Coupon $coupon, User $user): void
    {
        if ($coupon->usage_limit !== null) {
            $used = max((int) $coupon->total_uses, $this->redeemedCount($coupon, null));

            if ($used >= (int) $coupon->usage_limit) {
                throw new RuntimeException('Coupon usage limit reached');
            }
        }

        $perUserLimit = (int) ($coupon->per_user_limit ?? 1);
        $userCount = $this->redeemedCount($coupon, $user->id);

        if ($userCount >= $perUserLimit) {
            throw new RuntimeException('You have reached the usage limit for this coupon');
        }
    }

    public function redeemedCount(Coupon $coupon, ?int $userId): int
    {
        $query = CouponUsage::where('coupon_id', $coupon->id)
            ->whereIn('status', self::ACTIVE_REDEEMED_STATUSES);

        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        return $query->count();
    }

    /**
     * @return int[]
     */
    public function normalizeIds(array|string|null $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return array_values(array_map('intval', $value));
        }

        return array_values(array_filter(array_map('intval', explode(',', $value)), fn ($id) => $id > 0));
    }
}
