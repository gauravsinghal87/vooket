<?php

namespace Database\Seeders;

use App\Models\DeliveryPartner;
use App\Models\Driver;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Zone;
use App\Services\Maps\ZoneService;
use App\Services\WalletService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds an online fleet for every Jaipur zone: food delivery partners,
 * grocery delivery partners and ride drivers. Each partner/driver is placed
 * at coordinates inside their zone and tagged with the matching
 * current_zone_id so zone-filtered dispatch finds them.
 *
 * Every record uses updateOrCreate and is safe to re-run.
 */
class JaipurFleetSeeder extends Seeder
{
    /**
     * Fleet blueprint per zone. Coordinates cycle through the zone's spread
     * points; every point sits safely inside the zone polygon.
     */
    private const FLEET = [
        'JAI-CENTRAL' => [
            'food' => 3,
            'grocery' => 2,
            'ride' => 3,
            'points' => [
                [26.9124, 75.7873],
                [26.9080, 75.8000],
                [26.9180, 75.8260],
                [26.9150, 75.7800],
            ],
        ],
        'JAI-NORTH' => [
            'food' => 3,
            'grocery' => 2,
            'ride' => 3,
            'points' => [
                [26.9600, 75.7900],
                [26.9450, 75.7450],
                [26.9550, 75.7700],
                [26.9350, 75.7600],
            ],
        ],
        'JAI-SOUTH' => [
            'food' => 3,
            'grocery' => 2,
            'ride' => 3,
            'points' => [
                [26.8457, 75.8048],
                [26.8300, 75.7500],
                [26.8400, 75.7600],
                [26.8550, 75.8100],
            ],
        ],
    ];

    private const DELIVERY_VEHICLES = ['bike', 'scooter'];

    private const RIDE_VEHICLES = ['bike', 'auto', 'cab_mini'];

    public function run(): void
    {
        $wallet = app(WalletService::class);
        $zoneService = app(ZoneService::class);

        $roleIds = [
            'delivery_partner' => Role::where('slug', 'delivery_partner')->first()->id,
            'driver' => Role::where('slug', 'driver')->first()->id,
        ];

        $vehicleTypeIds = VehicleType::query()->pluck('id', 'code');

        foreach (self::FLEET as $zoneCode => $fleet) {
            $zone = Zone::where('code', $zoneCode)->first();

            if (! $zone) {
                $this->command->warn("Zone {$zoneCode} not found — run ZoneSeeder first.");

                continue;
            }

            $points = $fleet['points'];
            $slot = 0;

            foreach (['food', 'grocery'] as $service) {
                for ($i = 1; $i <= $fleet[$service]; $i++) {
                    [$lat, $lng] = $points[$slot++ % count($points)];
                    $this->seedDeliveryPartner(
                        $wallet, $zoneService, $roleIds['delivery_partner'], $zone,
                        $service, $i, $lat, $lng,
                    );
                }
            }

            for ($i = 1; $i <= $fleet['ride']; $i++) {
                [$lat, $lng] = $points[$slot++ % count($points)];
                $this->seedDriver(
                    $wallet, $zoneService, $roleIds['driver'], $vehicleTypeIds, $zone, $i, $lat, $lng,
                );
            }
        }

        $this->command->info('Jaipur fleet seeded: food + grocery delivery partners and ride drivers per zone.');
    }

    private function seedDeliveryPartner(
        WalletService $wallet,
        ZoneService $zoneService,
        int $roleId,
        Zone $zone,
        string $service,
        int $index,
        float $lat,
        float $lng,
    ): void {
        $label = $service === 'grocery' ? 'Grocery' : 'Food';
        $slug = $zone->code.'.'.$service.'.'.$index;
        $name = "Jaipur {$label} Partner {$zone->code} #{$index}";
        $email = 'partner.jaipur.'.strtolower($slug).'@superapp.com';
        $phone = $this->phone('partner', $slug);
        $vehicle = self::DELIVERY_VEHICLES[$index % count(self::DELIVERY_VEHICLES)];

        $user = $this->user($name, $email, $phone, 'delivery_partner', $roleId);
        $wallet->ensureWallet($user, 'delivery_partner');

        DeliveryPartner::updateOrCreate(
            ['user_id' => $user->id],
            [
                'status' => 'approved',
                'service_type' => $service,
                'vehicle_type' => $vehicle,
                'vehicle_number' => 'RJ-27-'.$zone->priority.$index.'-'.strtoupper(substr(md5($slug), 0, 4)),
                'is_online' => true,
                'is_busy' => false,
                'latitude' => $lat,
                'longitude' => $lng,
                'current_zone_id' => $zoneService->resolve($lat, $lng, $service)?->id,
                'last_location_at' => now(),
                'rating' => round(random_int(42, 49) / 10, 1),
                'rating_count' => random_int(30, 250),
                'total_deliveries' => random_int(20, 400),
            ]
        );
    }

    private function seedDriver(
        WalletService $wallet,
        ZoneService $zoneService,
        int $roleId,
        Collection $vehicleTypeIds,
        Zone $zone,
        int $index,
        float $lat,
        float $lng,
    ): void {
        $slug = $zone->code.'.ride.'.$index;
        $name = "Jaipur Driver {$zone->code} #{$index}";
        $email = 'driver.jaipur.'.strtolower($slug).'@superapp.com';
        $phone = $this->phone('driver', $slug);
        $vehicleCode = self::RIDE_VEHICLES[$index % count(self::RIDE_VEHICLES)];

        $user = $this->user($name, $email, $phone, 'driver', $roleId);
        $wallet->ensureWallet($user, 'driver');

        Driver::updateOrCreate(
            ['user_id' => $user->id],
            [
                'vehicle_type_id' => $vehicleTypeIds[$vehicleCode],
                'status' => 'approved',
                'vehicle_number' => 'RJ-27-'.$zone->priority.$index.'-'.strtoupper(substr(md5($slug), 0, 4)),
                'vehicle_model' => $vehicleCode === 'auto' ? 'Bajaj RE' : 'Maruti Alto',
                'vehicle_color' => 'White',
                'license_number' => 'RJ-'.strtoupper(substr(md5($slug), 0, 10)),
                'license_expiry' => now()->addYears(3),
                'is_online' => true,
                'is_busy' => false,
                'is_verified' => true,
                'verified_at' => now(),
                'latitude' => $lat,
                'longitude' => $lng,
                'current_zone_id' => $zoneService->resolve($lat, $lng, ZoneService::SERVICE_RIDE)?->id,
                'last_location_at' => now(),
                'rating' => round(random_int(42, 49) / 10, 1),
                'rating_count' => random_int(30, 250),
                'total_trips' => random_int(20, 500),
            ]
        );
    }

    private function user(string $name, string $email, string $phone, string $userType, int $roleId): User
    {
        $user = User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'phone' => $phone,
                'country_code' => '+91',
                'password' => Hash::make('password'),
                'user_type' => $userType,
                'is_active' => true,
                'is_verified' => true,
                'email_verified_at' => now(),
                'phone_verified_at' => now(),
            ]
        );
        $user->roles()->sync([$roleId]);

        return $user;
    }

    /**
     * Deterministic, collision-resistant 10-digit phone number from a slug.
     */
    private function phone(string $prefix, string $slug): string
    {
        $base = $prefix === 'driver' ? 9740000000 : 9730000000;

        return (string) ($base + (crc32($slug) % 999999));
    }
}
