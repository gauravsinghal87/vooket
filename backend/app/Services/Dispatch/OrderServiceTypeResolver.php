<?php

namespace App\Services\Dispatch;

use App\Models\Order;

/**
 * Resolves the delivery service type (food|grocery) an order belongs to.
 *
 * The authoritative source is `orders.order_type`. A source-based fallback is
 * applied so older records created before the field became consistent still
 * resolve correctly (restaurant -> food, store -> grocery).
 */
class OrderServiceTypeResolver
{
    public const FOOD = 'food';

    public const GROCERY = 'grocery';

    public function resolve(Order $order): string
    {
        $orderType = strtolower((string) $order->order_type);

        if (in_array($orderType, [self::FOOD, self::GROCERY], true)) {
            return $orderType;
        }

        if ($order->restaurant_id) {
            return self::FOOD;
        }

        if ($order->store_id) {
            return self::GROCERY;
        }

        return $orderType === '' ? self::FOOD : $orderType;
    }

    /**
     * Whether a delivery service supports at-door cash collection against the
     * partner wallet (food and grocery do; ride has its own payment model).
     */
    public function supportsCashCollection(string $serviceType): bool
    {
        return in_array($serviceType, [self::FOOD, self::GROCERY], true);
    }

    /**
     * Label used in audit logs / dispatch meta (e.g. "Food delivery").
     */
    public function label(string $serviceType): string
    {
        return $serviceType === self::GROCERY ? 'Grocery delivery' : 'Food delivery';
    }
}
