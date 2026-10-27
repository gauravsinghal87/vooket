<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Client map display defaults
    |--------------------------------------------------------------------------
    |
    | Safe, non-secret defaults served to the public bootstrap config. These
    | values can be overridden per-environment from the admin Integrations hub,
    | which persists them on the integration_settings row for the "maps"
    | service.
    |
    */

    /**
     * Google Maps "map id" for styled/advanced map types (optional).
     */
    'map_id' => env('MAPS_MAP_ID') ?: null,

    /**
     * Default map center used when the customer's geolocation is unavailable.
     */
    'default_center' => [
        'latitude' => (float) env('MAPS_DEFAULT_LAT', 26.9124),
        'longitude' => (float) env('MAPS_DEFAULT_LNG', 75.7873),
    ],

    /**
     * Default zoom level.
     */
    'default_zoom' => (int) env('MAPS_DEFAULT_ZOOM', 13),
];
