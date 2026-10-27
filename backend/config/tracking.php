<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Live order tracking settings
    |--------------------------------------------------------------------------
    |
    | Controls the customer-facing live tracking endpoint, partner location
    | updates, freshness rules, and the realtime/polling contract.
    |
    */

    /**
     * Partner-location updates per minute allowed from the delivery partner
     * app (server-side throttle).
     */
    'location_updates_per_minute' => (int) env('TRACKING_LOCATION_UPDATES_PER_MINUTE', 30),

    /**
     * A partner location older than this many seconds is considered stale.
     * Stale partners are excluded from new dispatch and the customer UI must
     * surface "Location updating..." instead of pretending the position is
     * live.
     */
    'location_freshness_seconds' => (int) env('LOCATION_FRESHNESS_SECONDS', 30),

    /**
     * Minimum interval enforced between two accepted partner location pings
     * (seconds), measured from the server-accepted timestamp. Set to 0 to
     * disable the cooldown. The partner fleet app is expected to report every
     * ~10s, so a value around 3 protects the feed from sub-second floods.
     */
    'location_min_interval_seconds' => (int) env('PARTNER_LOCATION_MIN_INTERVAL_SECONDS', 3),

    /**
     * Maximum plausible travel between two consecutive partner location
     * pings (kilometres). Larger jumps are rejected as client errors to
     * prevent garbage coordinates entering the live feed.
     */
    'max_location_jump_km' => (float) env('TRACKING_MAX_LOCATION_JUMP_KM', 1.5),

    /**
     * Minimum distance (metres) a partner must move for a tracking route /
     * ETA recalculation to be attempted at all (helps throttle route API
     * calls for marker-only movement).
     */
    'route_recalc_min_movement_m' => (float) env('TRACKING_ROUTE_RECALC_MIN_MOVEMENT_M', 150),

    /**
     * How often the backend may recompute a partner route/ETA from the map
     * provider (seconds). Marker-only updates never trigger a recalc.
     */
    'route_recalc_interval_seconds' => (int) env('TRACKING_ROUTE_RECALC_INTERVAL', 30),

    /**
     * Private broadcast channel prefix for order tracking events.
     */
    'channel_prefix' => env('TRACKING_CHANNEL_PREFIX', 'private-orders'),

    /**
     * Average travel speed (km/h) used for the simple ETA heuristic when no
     * provider route is available.
     */
    'eta_average_speed_kmh' => (float) env('TRACKING_ETA_AVERAGE_SPEED_KMH', 25),
];
