<?php

namespace Database\Factories;

use App\Models\FareRule;
use App\Models\VehicleType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<FareRule>
 */
class FareRuleFactory extends Factory
{
    protected $model = FareRule::class;

    public function definition(): array
    {
        return [
            'vehicle_type_id' => VehicleType::factory(),
            'zone_id' => null,
            'city' => null,
            'base_fare' => fake()->randomFloat(2, 20, 100),
            'per_km' => fake()->randomFloat(2, 5, 20),
            'per_minute' => fake()->randomFloat(2, 0.5, 3),
            'minimum_fare' => 30,
            'booking_fee' => 10,
            'platform_fee' => 5,
            'tax_rate' => 5,
            'surge_multiplier_max' => 2.00,
            'waiting_charge_per_min' => 1,
            'cancellation_fee' => 20,
            'driver_earn_percentage' => 75,
            'is_active' => true,
            'meta' => null,
        ];
    }
}
