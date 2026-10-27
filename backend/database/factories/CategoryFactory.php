<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        $name = $this->faker->unique()->words(2, true);

        return [
            'name' => Str::title($name),
            'slug' => Str::slug($name.'-'.$this->faker->unique()->numberBetween(1, 9999)),
            'parent_id' => null,
            'type' => $this->faker->randomElement(['food', 'grocery']),
            'icon' => null,
            'image' => null,
            'description' => $this->faker->sentence(),
            'sort_order' => 0,
            'is_active' => true,
            'is_featured' => false,
            'meta' => null,
            'meta_title' => null,
            'meta_description' => null,
        ];
    }

    public function food(): static
    {
        return $this->state(fn () => ['type' => 'food']);
    }

    public function grocery(): static
    {
        return $this->state(fn () => ['type' => 'grocery']);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
