<?php

namespace Database\Seeders;

use App\Models\City;
use App\Models\Country;
use App\Models\FareRule;
use App\Models\ServiceArea;
use App\Models\State;
use App\Models\VehicleType;
use App\Models\Zone;
use Illuminate\Database\Seeder;

class ZoneSeeder extends Seeder
{
    public function run(): void
    {
        $india = Country::updateOrCreate(
            ['code' => 'IN'],
            ['name' => 'India', 'phone_code' => '+91', 'currency' => 'INR', 'is_active' => true]
        );

        $rajasthan = State::updateOrCreate(
            ['country_id' => $india->id, 'code' => 'RJ'],
            ['name' => 'Rajasthan']
        );

        $jaipurCity = City::updateOrCreate(
            ['state_id' => $rajasthan->id, 'name' => 'Jaipur'],
            ['is_active' => true]
        );

        // Demo zones covering Jaipur city, split into three adjacent bands.
        // All three verticals are enabled so the whole Jaipur demo flow works.
        $zones = [
            [
                'name' => 'Jaipur Central Zone',
                'code' => 'JAI-CENTRAL',
                'priority' => 30,
                'bounds' => [26.8650, 75.7200, 26.9250, 75.9000],
            ],
            [
                'name' => 'Jaipur North Zone',
                'code' => 'JAI-NORTH',
                'priority' => 20,
                'bounds' => [26.9250, 75.7200, 27.0200, 75.9000],
            ],
            [
                'name' => 'Jaipur South Zone',
                'code' => 'JAI-SOUTH',
                'priority' => 10,
                'bounds' => [26.7800, 75.7200, 26.8650, 75.9000],
            ],
        ];

        foreach ($zones as $definition) {
            [$minLat, $minLng, $maxLat, $maxLng] = $definition['bounds'];

            Zone::updateOrCreate(
                ['name' => $definition['name']],
                [
                    'code' => $definition['code'],
                    'type' => 'multi',
                    'city' => 'Jaipur',
                    'state' => 'Rajasthan',
                    'country' => 'IN',
                    'center_latitude' => round(($minLat + $maxLat) / 2, 7),
                    'center_longitude' => round(($minLng + $maxLng) / 2, 7),
                    'radius_km' => 15,
                    'polygon' => $this->rectangle($minLat, $minLng, $maxLat, $maxLng),
                    'food_enabled' => true,
                    'grocery_enabled' => true,
                    'ride_enabled' => true,
                    'priority' => $definition['priority'],
                    'is_active' => true,
                ]
            );
        }

        // Service areas (within the Jaipur Central zone)
        $central = Zone::where('code', 'JAI-CENTRAL')->first();

        foreach ([
            ['C-Scheme', 26.9124, 75.7873],
            ['Vaishali Nagar', 26.9040, 75.7400],
            ['Malviya Nagar', 26.8550, 75.8100],
        ] as [$areaName, $latitude, $longitude]) {
            ServiceArea::updateOrCreate(
                ['name' => $areaName],
                [
                    'zone_id' => $central?->id,
                    'city' => 'Jaipur',
                    'state' => 'Rajasthan',
                    'country' => 'India',
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'radius_km' => 5,
                    'is_active' => true,
                ]
            );
        }

        // Vehicle types
        $vehicleTypes = [
            ['name' => 'Bike', 'code' => 'bike', 'capacity' => 1, 'description' => '1 passenger'],
            ['name' => 'Auto', 'code' => 'auto', 'capacity' => 3, 'description' => '3 passengers'],
            ['name' => 'Cab Mini', 'code' => 'cab_mini', 'capacity' => 4, 'description' => '4 passengers', 'ac' => true],
            ['name' => 'Cab Sedan', 'code' => 'cab_sedan', 'capacity' => 4, 'description' => '4 passengers', 'ac' => true],
            ['name' => 'Cab SUV', 'code' => 'cab_suv', 'capacity' => 6, 'description' => '6 passengers', 'ac' => true],
        ];

        foreach ($vehicleTypes as $vt) {
            VehicleType::updateOrCreate(['code' => $vt['code']], array_merge($vt, ['is_active' => true]));
        }

        // Fare rules
        $bike = VehicleType::where('code', 'bike')->first();
        $auto = VehicleType::where('code', 'auto')->first();
        $mini = VehicleType::where('code', 'cab_mini')->first();
        $sedan = VehicleType::where('code', 'cab_sedan')->first();
        $suv = VehicleType::where('code', 'cab_suv')->first();

        $fareRules = [
            [$bike, 30, 6, 1, 30, 10, 5, 5, 2.0, 1, 40, 75],
            [$auto, 40, 10, 1.5, 40, 10, 5, 5, 2.0, 1, 50, 70],
            [$mini, 80, 15, 2, 80, 15, 10, 5, 2.0, 1, 60, 70],
            [$sedan, 100, 18, 2, 100, 20, 10, 5, 2.0, 1, 75, 70],
            [$suv, 150, 22, 2.5, 150, 25, 15, 5, 2.0, 1, 100, 65],
        ];

        foreach ($fareRules as $rule) {
            [$vt, $base, $perKm, $perMin, $minFare, $booking, $platform, $tax, $surgeMax, $wait, $cancel, $driver] = $rule;

            FareRule::updateOrCreate(
                ['vehicle_type_id' => $vt->id],
                [
                    'base_fare' => $base,
                    'per_km' => $perKm,
                    'per_minute' => $perMin,
                    'minimum_fare' => $minFare,
                    'booking_fee' => $booking,
                    'platform_fee' => $platform,
                    'tax_rate' => $tax,
                    'surge_multiplier_max' => $surgeMax,
                    'waiting_charge_per_min' => $wait,
                    'cancellation_fee' => $cancel,
                    'driver_earn_percentage' => $driver,
                    'is_active' => true,
                ]
            );
        }
    }

    /**
     * Build a GeoJSON [longitude, latitude] ring for a lat/lng bounding box.
     *
     * @return array<int, array{longitude: float, latitude: float}>
     */
    protected function rectangle(float $minLat, float $minLng, float $maxLat, float $maxLng): array
    {
        return [
            ['longitude' => $minLng, 'latitude' => $minLat],
            ['longitude' => $maxLng, 'latitude' => $minLat],
            ['longitude' => $maxLng, 'latitude' => $maxLat],
            ['longitude' => $minLng, 'latitude' => $maxLat],
        ];
    }
}
