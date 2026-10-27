<?php

/*
 * Grocery scheduled delivery (delivery slots).
 *
 * Slots are stored as local wall-clock values (slot_date + start/end time) in
 * a business timezone, and converted to UTC in PHP before any comparison with
 * now(). The application itself runs in UTC, so raw SQL NOW()/CURDATE() is
 * never used for slot decisions.
 */
return [
    'timezone' => env('DELIVERY_SLOT_TIMEZONE', 'Asia/Kolkata'),

    // How many days ahead a customer may book, starting today.
    'booking_window_days' => (int) env('DELIVERY_SLOT_BOOKING_WINDOW_DAYS', 7),

    // How far ahead a grocery vendor may publish slots.
    'horizon_days' => (int) env('DELIVERY_SLOT_HORIZON_DAYS', 30),

    // Lead time applied when a vendor does not set one on the slot itself.
    'default_lead_time_min' => (int) env('DELIVERY_SLOT_DEFAULT_LEAD_TIME_MIN', 60),

    'min_lead_time_min' => (int) env('DELIVERY_SLOT_MIN_LEAD_TIME_MIN', 0),

    'max_slots_per_day' => (int) env('DELIVERY_SLOT_MAX_PER_DAY', 12),

    /**
     * Maximum number of Grocery orders a single delivery partner may carry in
     * one physical trip (delivery batch).
     *
     * This is a deployment value, deliberately not an admin setting: an order
     * is only batched onto an existing trip when that trip still fits the
     * shared delivery window. 1 disables batching entirely and restores strict
     * one-order-per-partner behaviour. The hard ceiling is
     * GROCERY_MAX_BATCH_ORDERS (5).
     */
    'grocery_max_scheduled_orders_per_batch' => (int) env('GROCERY_MAX_SCHEDULED_ORDERS_PER_BATCH', 3),
    'grocery_batch_max_orders' => (int) env('GROCERY_MAX_BATCH_ORDERS', 5),

    /**
     * Scheduled Grocery dispatch model.
     *
     * `true` (default): a scheduled Grocery order is dispatched MANUALLY by the
     * vendor after it has been packed — the vendor picks a partner and only the
     * selected partner receives the request. The scheduler never auto-offers a
     * scheduled Grocery order in this mode.
     *
     * `false`: legacy behaviour — scheduled Grocery orders are offered
     * automatically once the booked delivery window has opened and the order
     * has been packed.
     *
     * ASAP Grocery, Food and Ride are never affected by this flag.
     */
    'grocery_vendor_manual_dispatch' => (bool) env('GROCERY_VENDOR_MANUAL_DISPATCH', true),

    /**
     * Centrally defined grocery delivery shifts. Vendors choose a shift key
     * (morning/evening) and the backend derives start/end wall-clock times
     * from here. These are provisional defaults; change them in one place.
     */
    'shifts' => [
        'morning' => [
            'start' => env('DELIVERY_SLOT_MORNING_START', '08:00'),
            'end' => env('DELIVERY_SLOT_MORNING_END', '12:00'),
        ],
        'evening' => [
            'start' => env('DELIVERY_SLOT_EVENING_START', '17:00'),
            'end' => env('DELIVERY_SLOT_EVENING_END', '21:00'),
        ],
    ],

    'max_bulk_slots' => (int) env('DELIVERY_SLOT_MAX_BULK_SLOTS', 200),
];
