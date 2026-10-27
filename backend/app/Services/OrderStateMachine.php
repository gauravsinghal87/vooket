<?php

namespace App\Services;

use App\Exceptions\InvalidOrderTransitionException;
use App\Models\Order;

/**
 * Server-authoritative legal transition map for orders.
 *
 * Food chain:
 *   PENDING -> PLACED -> ACCEPTED/CONFIRMED -> PREPARING -> READY
 * Grocery chain:
 *   PENDING -> PLACED -> ACCEPTED/CONFIRMED -> (PICKING | PROCESSING)
 *     -> PACKED -> READY
 * Scheduled grocery chain:
 *   SCHEDULED -> PENDING (only when the booked slot starts)
 *     or SCHEDULED -> ACCEPTED -> (PICKING | PROCESSING | PREPARING) -> PACKED
 *     -> READY, with partner dispatch held until the slot's dispatch lead time
 * Dispatch chain (both services):
 *   READY -> PARTNER_ASSIGNED -> PICKED_UP -> OUT_FOR_DELIVERY
 *     -> ARRIVED -> DELIVERED
 *
 * DELIVERED and CANCELLED are terminal. Cancellation is only legal from
 * pre-dispatch states.
 */
class OrderStateMachine
{
    private const PRE_DELIVERY_SHARED = [
        'PLACED' => ['PENDING'],
        'ACCEPTED' => ['PENDING', 'PLACED'],
        'CONFIRMED' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED'],
    ];

    private const FOOD_PRE_DELIVERY = [
        'PREPARING' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PARTNER_ASSIGNED'],
        'READY' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PREPARING', 'PARTNER_ASSIGNED'],
    ];

    private const GROCERY_PRE_DELIVERY = [
        'PICKING' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PARTNER_ASSIGNED'],
        'PROCESSING' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PICKING', 'PARTNER_ASSIGNED'],
        'PACKED' => ['PICKING', 'PROCESSING', 'ACCEPTED', 'CONFIRMED', 'PLACED', 'PARTNER_ASSIGNED'],
        'PREPARING' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PARTNER_ASSIGNED'],
        'READY' => ['PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PREPARING', 'PICKING', 'PROCESSING', 'PACKED', 'PARTNER_ASSIGNED'],
    ];

    private const DISPATCH_CHAIN = [
        'PARTNER_ASSIGNED' => ['READY'],
        'PICKED_UP' => ['PARTNER_ASSIGNED', 'READY'],
        'OUT_FOR_DELIVERY' => ['PICKED_UP', 'READY'],
        'ARRIVED' => ['OUT_FOR_DELIVERY'],
        'DELIVERED' => ['OUT_FOR_DELIVERY', 'ARRIVED', 'PICKED_UP'],
    ];

    private const DISPATCH_STATUSES = [
        'PARTNER_ASSIGNED',
        'PICKED_UP',
        'OUT_FOR_DELIVERY',
        'ARRIVED',
        'DELIVERED',
        'CANCELLED',
    ];

    private const CANCELABLE_BEFORE_READY = [
        'PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'SCHEDULED',
    ];

    private const GROCERY_ONLY_STATUSES = ['PICKING', 'PROCESSING', 'PACKED', 'SCHEDULED'];

    /**
     * A scheduled grocery order leaves its inert state either when its slot
     * starts (`PENDING`, by the activation command) or when the vendor
     * accepts it early and prepares it ahead of the slot (`ACCEPTED`).
     *
     * Dispatch statuses are deliberately absent: a scheduled order can only
     * reach a partner through the normal `READY -> PARTNER_ASSIGNED` offer
     * flow, never by a direct status change.
     */
    private const SCHEDULED_TRANSITIONS = [
        'PENDING' => ['SCHEDULED'],
        'ACCEPTED' => ['SCHEDULED'],
        'CONFIRMED' => ['SCHEDULED'],
    ];

    public static function canTransition(Order $order, string $target): bool
    {
        $current = strtoupper($order->status);
        $target = strtoupper($target);

        if ($current === $target) {
            return true;
        }

        if (in_array($current, ['DELIVERED', 'CANCELLED'], true)) {
            return false;
        }

        if ($target === 'CANCELLED') {
            if (in_array($current, self::DISPATCH_STATUSES, true)) {
                return false;
            }

            if (in_array($current, self::CANCELABLE_BEFORE_READY, true)) {
                return true;
            }

            return self::isCancelableAfterAccept($order, $current);
        }

        if (in_array($target, self::DISPATCH_STATUSES, true)) {
            if ($target === 'DELIVERED' && in_array($current, ['PICKED_UP', 'OUT_FOR_DELIVERY'], true)) {
                return true;
            }

            return in_array($current, self::DISPATCH_CHAIN[$target] ?? [], true);
        }

        if (in_array($target, self::GROCERY_ONLY_STATUSES, true) && $order->order_type !== 'grocery') {
            return false;
        }

        if ($current === 'SCHEDULED') {
            return in_array($current, self::SCHEDULED_TRANSITIONS[$target] ?? [], true);
        }

        $preDelivery = $order->order_type === 'grocery'
            ? self::PRE_DELIVERY_SHARED + self::GROCERY_PRE_DELIVERY
            : self::PRE_DELIVERY_SHARED + self::FOOD_PRE_DELIVERY;

        return in_array($current, $preDelivery[$target] ?? [], true);
    }

    /**
     * @throws InvalidOrderTransitionException
     */
    public static function assertCanTransition(Order $order, string $target): void
    {
        if (! self::canTransition($order, $target)) {
            throw new InvalidOrderTransitionException(
                "Cannot move order {$order->order_number} from {$order->status} to ".strtoupper($target),
                (string) $order->status,
                strtoupper($target),
                (int) $order->id
            );
        }
    }

    private static function isCancelableAfterAccept(Order $order, string $current): bool
    {
        if ($order->order_type === 'grocery') {
            return in_array($current, ['PREPARING', 'PICKING', 'PROCESSING', 'PACKED', 'READY'], true);
        }

        return in_array($current, ['PREPARING', 'READY'], true);
    }
}
