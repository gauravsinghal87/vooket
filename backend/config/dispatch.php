<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Delivery dispatch settings
    |--------------------------------------------------------------------------
    |
    | Controls how delivery offers are pushed to delivery partners once an
    | order is marked READY by the vendor. Offers are created sequentially:
    | the nearest eligible partner receives a "pending" offer while the
    | remaining candidates are queued as "sent" and promoted one-by-one as
    | each active offer is declined or expires.
    |
    */

    'dispatch_type' => 'delivery',

    'candidate_type' => 'delivery_partner',

    /**
     * How long an active offer stays valid before it is auto-expired.
     * Expired offers are promoted lazily when the partner polls.
     */
    'offer_timeout_seconds' => (int) env('DISPATCH_OFFER_TIMEOUT', 45),

    /**
     * Search radius around the pickup point used when ranking candidates.
     */
    'initial_radius_km' => (float) env('DISPATCH_INITIAL_RADIUS_KM', 4),

    /**
     * Hard ceiling distance for a partner to be considered a candidate.
     */
    'max_radius_km' => (float) env('DISPATCH_MAX_RADIUS_KM', 10),

    /**
     * Maximum number of partners to create offers for per order.
     */
    'max_candidates' => (int) env('DISPATCH_MAX_CANDIDATES', 8),

    /**
     * Minimum gap between automatic re-dispatch attempts for unassigned
     * orders, used by the "dispatch:requeue" scheduled command.
     */
    'requeue_interval_seconds' => (int) env('DISPATCH_REQUEUE_INTERVAL', 180),

    /**
     * If set, partners whose location is older than this many minutes are
     * excluded during candidate ranking. Defaults to 10 minutes; set to null
     * to accept any partner with coordinates.
     */
    'location_freshness_minutes' => env('DISPATCH_LOCATION_FRESHNESS_MINUTES') !== null
        ? (int) env('DISPATCH_LOCATION_FRESHNESS_MINUTES')
        : 10,

    /**
     * Slack, in minutes, left between the measured end of a grocery batch
     * route and the end of the shared slot window. Keeps a batch from being
     * accepted when the last drop would land at or after the window closes.
     */
    'batch_window_buffer_minutes' => (int) env('DISPATCH_BATCH_WINDOW_BUFFER_MINUTES', 10),
];
