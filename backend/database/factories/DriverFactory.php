<?php

namespace Database\Factories;

use App\Models\Driver;
use App\Models\User;
use App\Models\VehicleType;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Driver>
 */
class DriverFactory extends Factory
{
    protected $model = Driver::class;

    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'vehicle_type_id' => VehicleType::factory(),
            'status' => 'approved',
            'vehicle_number' => strtoupper('RJ'.fake()->randomNumber(6, true)),
            'vehicle_model' => fake()->randomElement(['Maruti Alto', 'Honda City', 'Bajaj RE', 'Honda Activa']),
            'vehicle_color' => fake()->safeColorName(),
            'license_number' => strtoupper(fake()->bothify('RJ##2018#######')),
            'license_expiry' => now()->addYears(3),
            'is_online' => true,
            'is_busy' => false,
            'is_verified' => true,
            'latitude' => fake()->latitude(26, 27),
            'longitude' => fake()->longitude(75, 76),
            'last_location_at' => now(),
            'rating' => 4.5,
            'rating_count' => 0,
            'total_trips' => 0,
            'accepted_rides' => 0,
            'rejected_rides' => 0,
        ];
    }

    public function online(): static
    {
        return $this->state(fn () => ['is_online' => true]);
    }

    public function offline(): static
    {
        return $this->state(fn () => ['is_online' => false]);
    }

    public function busy(): static
    {
        return $this->state(fn () => ['is_busy' => true]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['is_verified' => false]);
    }

    public function pendingApproval(): static
    {
        return $this->state(fn () => ['status' => 'pending']);
    }

    /**
     * Pin the driver to an explicit location (Jaipur by default).
     */
    public function at(float $latitude, float $longitude): static
    {
        return $this->state(fn () => [
            'latitude' => $latitude,
            'longitude' => $longitude,
            'last_location_at' => now(),
        ]);
    }

    /**
     * Mark the location stale by moving last_location_at into the past.
     */
    public function staleLocation(): static
    {
        return $this->state(fn () => ['last_location_at' => now()->subDays(2)]);
    }
}
