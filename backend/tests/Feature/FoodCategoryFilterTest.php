<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\Restaurant;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Tests\TestCase;

class FoodCategoryFilterTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Customer coordinate the listing requests are made from. Restaurant
     * listings are zone-gated, so every fixture lives inside one Food zone.
     */
    private const CUSTOMER_LAT = 26.9124;

    private const CUSTOMER_LNG = 75.7873;

    private ?Zone $zone = null;

    private function foodZone(): Zone
    {
        return $this->zone ??= Zone::create([
            'name' => 'Category Test Zone',
            'code' => 'CAT-TEST',
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => self::CUSTOMER_LAT,
            'center_longitude' => self::CUSTOMER_LNG,
            'radius_km' => 20,
            'is_active' => true,
        ]);
    }

    private function restaurant(string $name): Restaurant
    {
        $vendor = Vendor::create([
            'user_id' => User::factory()->create(['user_type' => 'vendor'])->id,
            'business_name' => $name.' Vendor',
            'owner_name' => 'Test Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
            'zone_id' => $this->foodZone()->id,
        ]);

        return Restaurant::create([
            'vendor_id' => $vendor->id,
            'name' => $name,
            'slug' => Str::slug($name).'-'.uniqid(),
            'latitude' => self::CUSTOMER_LAT,
            'longitude' => self::CUSTOMER_LNG,
            'is_open' => true,
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function product(Restaurant $restaurant, Category $category, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'vendor_id' => $restaurant->vendor_id,
            'restaurant_id' => $restaurant->id,
            'category_id' => $category->id,
            'name' => 'Item '.uniqid(),
            'slug' => 'item-'.uniqid(),
            'sku' => 'SKU_'.uniqid(),
            'price' => 199,
            'type' => 'food',
            'tax_rate' => 5,
            'is_active' => true,
            'is_available' => true,
        ], $overrides));
    }

    /**
     * @return Collection<int, int>
     */
    private function restaurantIds(string $url)
    {
        $separator = str_contains($url, '?') ? '&' : '?';
        $url .= $separator.'latitude='.self::CUSTOMER_LAT.'&longitude='.self::CUSTOMER_LNG;

        return collect($this->getJson($url)->assertOk()->json('data.data'))->pluck('id');
    }

    public function test_it_filters_restaurants_by_food_category_id(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);
        $biryani = Category::create(['name' => 'Biryani', 'slug' => 'biryani', 'type' => 'food']);

        $pizzaPlace = $this->restaurant('Pizza Place');
        $this->product($pizzaPlace, $pizza);

        $biryaniPlace = $this->restaurant('Biryani Place');
        $this->product($biryaniPlace, $biryani);

        $this->assertEquals(
            [$pizzaPlace->id],
            $this->restaurantIds("/api/v1/food/restaurants?category={$pizza->id}")->all()
        );

        $all = $this->restaurantIds('/api/v1/food/restaurants');
        $this->assertTrue($all->contains($pizzaPlace->id));
        $this->assertTrue($all->contains($biryaniPlace->id));
    }

    public function test_it_filters_restaurants_by_category_slug(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);
        $biryani = Category::create(['name' => 'Biryani', 'slug' => 'biryani', 'type' => 'food']);

        $pizzaPlace = $this->restaurant('Pizza Place');
        $this->product($pizzaPlace, $pizza);

        $biryaniPlace = $this->restaurant('Biryani Place');
        $this->product($biryaniPlace, $biryani);

        $this->assertEquals(
            [$pizzaPlace->id],
            $this->restaurantIds('/api/v1/food/restaurants?category=food-pizza')->all()
        );
    }

    public function test_it_includes_products_from_descendant_categories(): void
    {
        $starters = Category::create(['name' => 'Starters', 'slug' => 'starters', 'type' => 'food']);
        $paneer = Category::create(['name' => 'Paneer Starters', 'slug' => 'paneer-starters', 'type' => 'food', 'parent_id' => $starters->id]);
        $unrelated = Category::create(['name' => 'Beverages', 'slug' => 'beverages', 'type' => 'food']);

        $restaurant = $this->restaurant('Child Category Kitchen');
        $this->product($restaurant, $paneer);

        $other = $this->restaurant('Beverage Bar');
        $this->product($other, $unrelated);

        $this->assertEquals(
            [$restaurant->id],
            $this->restaurantIds("/api/v1/food/restaurants?category={$starters->id}")->all()
        );
    }

    public function test_it_excludes_restaurants_without_an_available_food_product_in_the_category(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);
        $grocery = Category::create(['name' => 'Snacks', 'slug' => 'snacks', 'type' => 'grocery']);

        $matched = $this->restaurant('Matched');
        $this->product($matched, $pizza);

        $unavailable = $this->restaurant('Unavailable Dish');
        $this->product($unavailable, $pizza, ['is_available' => false]);

        $inactive = $this->restaurant('Inactive Dish');
        $this->product($inactive, $pizza, ['is_active' => false]);

        $wrongType = $this->restaurant('Grocery Item');
        $this->product($wrongType, $pizza, ['type' => 'grocery']);

        $this->assertEquals(
            [$matched->id],
            $this->restaurantIds("/api/v1/food/restaurants?category={$pizza->id}")->all()
        );
    }

    public function test_unknown_category_returns_no_restaurants_instead_of_all(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);

        $restaurant = $this->restaurant('Pizza Place');
        $this->product($restaurant, $pizza);

        $this->assertTrue(
            $this->restaurantIds('/api/v1/food/restaurants?category=999999')->isEmpty()
        );
    }

    public function test_all_or_blank_category_preserves_the_default_listing(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);

        $restaurant = $this->restaurant('Pizza Place');
        $this->product($restaurant, $pizza);

        $this->assertTrue($this->restaurantIds('/api/v1/food/restaurants?category=all')->contains($restaurant->id));
        $this->assertTrue($this->restaurantIds('/api/v1/food/restaurants?category=')->contains($restaurant->id));
    }

    public function test_category_filter_combines_with_search(): void
    {
        $pizza = Category::create(['name' => 'Pizza', 'slug' => 'food-pizza', 'type' => 'food']);

        $pizzaPlace = $this->restaurant('Pizza Place');
        $this->product($pizzaPlace, $pizza);

        $pizzaHub = $this->restaurant('Pizza Hub');
        $this->product($pizzaHub, $pizza);

        $other = $this->restaurant('Biryani Place');
        $this->product($other, Category::create(['name' => 'Biryani', 'slug' => 'biryani', 'type' => 'food']));

        $this->assertEquals(
            [$pizzaHub->id],
            $this->restaurantIds("/api/v1/food/restaurants?category={$pizza->id}&search=Hub")->all()
        );
    }
}
