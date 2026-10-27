<?php

namespace Database\Factories;

use App\Models\VehicleType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<VehicleType>
 */
class VehicleTypeFactory extends Factory
{
    protected $model = VehicleType::class;

    public function definition(): array
    {
        return [
            'name' => fake()->unique()->randomElement(['Bike', 'Auto', 'Cab Mini', 'Cab Sedan', 'Cab SUV']),
            'code' => fn (array $attributes) => strtolower(str_replace([' ', '(', ')'], '_', $attributes['name'])),
            'icon' => 'vehicle-bike',
            'description' => fake()->sentence(4),
            'capacity' => fake()->numberBetween(1, 6),
            'ac' => fake()->boolean(),
            'is_active' => true,
            'sort_order' => 0,
            'meta' => null,
        ];
    }
}
