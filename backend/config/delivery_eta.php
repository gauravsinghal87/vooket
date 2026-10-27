<?php

/*
 * Food delivery ETA estimation.
 *
 * The customer-facing restaurant estimate is a browsing estimate: it combines
 * the kitchen's preparation time with the rider's estimated arrival at the
 * restaurant (they overlap), plus the routed driving time to the customer's
 * delivery location, plus an operational buffer. Nothing here is hardcoded in
 * the frontends — every assumption lives in this config.
 *
 * `DL`-prefixed env keys are looked up only, never logged; the Google Maps key
 * itself stays in IntegrationConfigResolver.
 */
return [
    /**
     * Extra minutes added to every estimate for pickup, handoff and normal
     * delivery uncertainty.
     */
    'buffer_minutes' => (int) env('DELIVERY_ETA_BUFFER_MINUTES', 5),

    /**
     * Width of the returned ETA range (min → min + spread). The lower bound is
     * the computed estimate and the upper bound allows for normal variance.
     */
    'range_spread_minutes' => (int) env('DELIVERY_ETA_RANGE_SPREAD_MINUTES', 5),

    /**
     * Pickup wait assumed when no nearby/available delivery partner can be
     * identified for the restaurant. Deliberately conservative.
     */
    'fallback_pickup_minutes' => (int) env('DELIVERY_ETA_FALLBACK_PICKUP_MINUTES', 12),

    /**
     * How far from a restaurant an available partner may be to count as a
     * rider-arrival input.
     */
    'rider_radius_km' => (float) env('DELIVERY_ETA_RIDER_RADIUS_KM', 4),

    /**
     * Hard ceiling on how many candidate partners are scored per request.
     */
    'rider_candidate_limit' => (int) env('DELIVERY_ETA_RIDER_CANDIDATE_LIMIT', 500),

    /**
     * Average vehicle speed used only when the configured maps provider is not
     * a live routing provider (e.g. mock/development). Marked `approximate` on
     * the response; a real provider is never replaced by this.
     */
    'approx_speed_kmh' => (float) env('DELIVERY_ETA_APPROX_SPEED_KMH', 22),

    /**
     * TTL for a freshly measured restaurant→customer route. Cached separately
     * from the (dynamic) rider availability.
     */
    'cache_ttl_seconds' => (int) env('DELIVERY_ETA_CACHE_TTL_SECONDS', 900),

    /**
     * TTL for keeping a last-known-good route to serve when the live map
     * provider fails. Never invents a route: only reuses a measured one.
     */
    'stale_cache_ttl_seconds' => (int) env('DELIVERY_ETA_STALE_CACHE_TTL_SECONDS', 86400),

    /**
     * Decimal places kept in a cached coordinate pair. 4 places ~= 11 m.
     */
    'coordinate_precision' => (int) env('DELIVERY_ETA_COORDINATE_PRECISION', 4),

    /**
     * Maximum origins per Distance Matrix call.
     */
    'matrix_chunk_size' => (int) env('DELIVERY_ETA_MATRIX_CHUNK_SIZE', 25),

    /**
     * Whether an unavailable route may fall back to a plain straight-line
     * (approximate) duration. Off by default so we never present a straight
     * line as a driving estimate; on for environments with no routing
     * provider so cards are not permanently blank.
     */
    'allow_approx_routes' => filter_var(env('DELIVERY_ETA_ALLOW_APPROX_ROUTES', true), FILTER_VALIDATE_BOOL),
];
