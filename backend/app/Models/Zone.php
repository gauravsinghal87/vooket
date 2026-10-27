<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Zone extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'country',
        'state',
        'city',
        'type',
        'food_enabled',
        'grocery_enabled',
        'ride_enabled',
        'priority',
        'center_latitude',
        'center_longitude',
        'radius_km',
        'food_partner_search_radius_km',
        'grocery_partner_search_radius_km',
        'ride_driver_search_radius_km',
        'polygon',
        'allow_cross_zone_food_delivery',
        'allow_cross_zone_grocery_delivery',
        'allow_ride_drop_outside_zone',
        'is_active',
        'meta',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'center_latitude' => 'decimal:7',
            'center_longitude' => 'decimal:7',
            'radius_km' => 'decimal:2',
            'food_partner_search_radius_km' => 'decimal:2',
            'grocery_partner_search_radius_km' => 'decimal:2',
            'ride_driver_search_radius_km' => 'decimal:2',
            'food_enabled' => 'boolean',
            'grocery_enabled' => 'boolean',
            'ride_enabled' => 'boolean',
            'priority' => 'integer',
            'allow_cross_zone_food_delivery' => 'boolean',
            'allow_cross_zone_grocery_delivery' => 'boolean',
            'allow_ride_drop_outside_zone' => 'boolean',
            'polygon' => 'array',
            'is_active' => 'boolean',
            'meta' => 'array',
        ];
    }

    /**
     * Normalised, GeoJSON-order [longitude, latitude] tuples for the boundary.
     * Returns an empty array when no polygon has been drawn.
     *
     * @return array<int, array{longitude: float, latitude: float}>
     */
    public function getBoundaryAttribute(): array
    {
        $polygon = $this->polygon;

        if (! is_array($polygon) || count($polygon) < 3) {
            return [];
        }

        return array_map(function (array $point): array {
            if (array_key_exists('longitude', $point) && array_key_exists('latitude', $point)) {
                return [
                    'longitude' => (float) $point['longitude'],
                    'latitude' => (float) $point['latitude'],
                ];
            }

            // Accept [lat, lng] / [latitude, longitude] tuples authored by the
            // map editor and normalise them into GeoJSON [lng, lat] order.
            if (is_numeric($point[0] ?? null) && is_numeric($point[1] ?? null)) {
                return [
                    'longitude' => (float) $point[1],
                    'latitude' => (float) $point[0],
                ];
            }

            return [
                'longitude' => (float) ($point['lng'] ?? $point['lon'] ?? 0),
                'latitude' => (float) ($point['lat'] ?? 0),
            ];
        }, array_values($polygon));
    }

    /**
     * Per-zone delivery pricing rows. Every active zone needs one complete row
     * for Food, Grocery Instant and Grocery Scheduled; a missing row is a setup
     * error, not a global fallback.
     */
    public function deliveryConfigs(): HasMany
    {
        return $this->hasMany(ZoneDeliveryConfig::class);
    }

    public function serviceEnabled(string $service): bool
    {
        return match ($service) {
            'food' => (bool) $this->food_enabled,
            'grocery' => (bool) $this->grocery_enabled,
            'ride' => (bool) $this->ride_enabled,
            default => false,
        };
    }

    public function searchRadiusKm(?string $service = null): ?float
    {
        $radius = match ($service) {
            'food' => $this->food_partner_search_radius_km,
            'grocery' => $this->grocery_partner_search_radius_km,
            'ride' => $this->ride_driver_search_radius_km,
            default => null,
        };

        if ($radius !== null) {
            return (float) $radius;
        }

        return $this->radius_km !== null ? (float) $this->radius_km : null;
    }
}
