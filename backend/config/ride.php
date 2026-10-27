<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Ride dispatch settings
    |--------------------------------------------------------------------------
    |
    | Controls how ride offers are pushed to drivers once a customer books a
    | ride. Offers are created sequentially: the nearest eligible driver
    | receives a "pending" offer while the remaining candidates are queued as
    | "sent" and promoted one-by-one as each active offer is declined or
    | expires.
    |
    */

    /**
     * How long an active ride offer stays valid before it is auto-expired.
     * Expired offers are promoted lazily when the customer or driver polls,
     * and by the "rides:dispatch-requeue" scheduled command.
     */
    'offer_timeout_seconds' => (int) env('RIDE_OFFER_TIMEOUT', 45),

    /**
     * Search radius around the pickup point used when ranking candidate
     * drivers for a ride.
     */
    'initial_radius_km' => (float) env('RIDE_INITIAL_RADIUS_KM', 4),

    /**
     * Hard ceiling distance for a driver to be considered a candidate.
     */
    'max_radius_km' => (float) env('RIDE_MAX_RADIUS_KM', 10),

    /**
     * Maximum number of drivers to create offers for per ride.
     */
    'max_candidates' => (int) env('RIDE_MAX_CANDIDATES', 8),

    /**
     * Minimum gap between automatic re-dispatch attempts for unassigned
     * rides, used by the "rides:dispatch-requeue" scheduled command.
     */
    'requeue_interval_seconds' => (int) env('RIDE_REQUEUE_INTERVAL', 180),

    /**
     * If set, drivers whose location is older than this many minutes are
     * excluded. Set to null to accept any driver with coordinates.
     */
    'location_freshness_minutes' => env('RIDE_LOCATION_FRESHNESS_MINUTES') !== null
        ? (int) env('RIDE_LOCATION_FRESHNESS_MINUTES')
        : null,

    /**
     * ISO-4217 code returned on fare estimates and previews.
     */
    'currency' => env('RIDE_CURRENCY', 'INR'),
];
