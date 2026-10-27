<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class GroceryCategoryNavigationTest extends TestCase
{
    use RefreshDatabase;

    /** The customer location the grocery taxonomy is requested for. */
    private const LAT = 26.9124;

    private const LNG = 75.7873;

    /**
     * Grocery endpoints resolve a delivery zone before they answer, so the
     * tests request the taxonomy from inside an active Grocery-enabled zone.
     * The zone configuration itself is covered by GroceryServiceabilityTest.
     */
    protected function setUp(): void
    {
        parent::setUp();

        Zone::create([
            'name' => 'Grocery Navigation Zone',
            'code' => 'GNAV-'.Str::upper(Str::random(4)),
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => true,
            'priority' => 10,
            'center_latitude' => self::LAT,
            'center_longitude' => self::LNG,
            'radius_km' => 20,
            'is_active' => true,
        ]);
    }

    private function categoriesUrl(?string $placement = null): string
    {
        return '/api/v1/grocery/categories?'.http_build_query(array_filter([
            'latitude' => self::LAT,
            'longitude' => self::LNG,
            'placement' => $placement,
        ], fn ($value) => $value !== null));
    }

    public function test_grocery_categories_return_parent_with_only_active_grocery_children(): void
    {
        $snacks = Category::create([
            'name' => 'Snacks & Drinks',
            'slug' => 'snacks-drinks',
            'type' => 'grocery',
            'sort_order' => 1,
        ]);

        $chips = Category::create([
            'name' => 'Chips & Namkeen',
            'slug' => 'chips-namkeen',
            'type' => 'grocery',
            'parent_id' => $snacks->id,
            'sort_order' => 1,
            'image' => config('app.url').'/storage/category-images/chips.png',
            'navigation_icon' => config('app.url').'/storage/category-navigation-icons/chips.png',
        ]);

        $hidden = Category::create([
            'name' => 'Hidden Snacks',
            'slug' => 'hidden-snacks',
            'type' => 'grocery',
            'parent_id' => $snacks->id,
            'is_active' => false,
        ]);

        $food = Category::create([
            'name' => 'Biryani',
            'slug' => 'biryani-root',
            'type' => 'food',
        ]);

        $foodChild = Category::create([
            'name' => 'Chicken Biryani',
            'slug' => 'chicken-biryani',
            'type' => 'food',
            'parent_id' => $food->id,
        ]);

        $response = $this->getJson($this->categoriesUrl());

        $response->assertStatus(200);

        $categories = collect($response->json('data'));

        $this->assertTrue($categories->contains('id', $snacks->id));
        $this->assertFalse($categories->contains('id', $food->id));

        $returnedSnacks = $categories->firstWhere('id', $snacks->id);
        $childIds = collect($returnedSnacks['children'])->pluck('id');

        $this->assertEquals([$chips->id], $childIds->all());
        $this->assertFalse($childIds->contains($hidden->id));
        $this->assertFalse($childIds->contains($foodChild->id));

        $returnedChips = collect($returnedSnacks['children'])->firstWhere('id', $chips->id);
        $this->assertEquals($chips->image, $returnedChips['image']);
        $this->assertEquals($chips->navigation_icon, $returnedChips['navigation_icon']);
        $this->assertEquals($snacks->id, $returnedChips['parent_id']);
    }

    public function test_grocery_categories_expose_and_filter_display_placement(): void
    {
        $both = Category::create(['name' => 'Both Cat', 'slug' => 'both-cat', 'type' => 'grocery']);
        $kids = Category::create(['name' => 'Kids', 'slug' => 'kids-cat', 'type' => 'grocery', 'display_placement' => 'top_navigation']);
        $electronics = Category::create(['name' => 'Electronics', 'slug' => 'electronics-cat', 'type' => 'grocery', 'display_placement' => 'main_content']);

        $all = collect($this->getJson($this->categoriesUrl())->json('data'));
        $this->assertEquals('both', $all->firstWhere('id', $both->id)['display_placement']);
        $this->assertEquals('top_navigation', $all->firstWhere('id', $kids->id)['display_placement']);

        $topNav = collect($this->getJson($this->categoriesUrl('top_navigation,both'))->json('data'))->pluck('id');
        $this->assertTrue($topNav->contains($kids->id));
        $this->assertTrue($topNav->contains($both->id));
        $this->assertFalse($topNav->contains($electronics->id));

        $mainContent = collect($this->getJson($this->categoriesUrl('main_content,both'))->json('data'))->pluck('id');
        $this->assertTrue($mainContent->contains($electronics->id));
        $this->assertTrue($mainContent->contains($both->id));
        $this->assertFalse($mainContent->contains($kids->id));
    }

    public function test_grocery_categories_return_nested_subcategories(): void
    {
        $grocery = Category::create([
            'name' => 'Grocery & Kitchen',
            'slug' => 'grocery-kitchen',
            'type' => 'grocery',
        ]);

        $atta = Category::create([
            'name' => 'Atta, Rice & Dal',
            'slug' => 'atta-rice-dal',
            'type' => 'grocery',
            'parent_id' => $grocery->id,
        ]);

        Category::create(['name' => 'Atta', 'slug' => 'atta', 'type' => 'grocery', 'parent_id' => $atta->id]);
        Category::create(['name' => 'Dal', 'slug' => 'dal', 'type' => 'grocery', 'parent_id' => $atta->id, 'sort_order' => 1]);
        $hidden = Category::create(['name' => 'Hidden Grain', 'slug' => 'hidden-grain', 'type' => 'grocery', 'parent_id' => $atta->id, 'is_active' => false]);

        $response = $this->getJson($this->categoriesUrl());

        $response->assertStatus(200);

        $groceryNode = collect($response->json('data'))->firstWhere('id', $grocery->id);
        $attaNode = collect($groceryNode['children'])->firstWhere('id', $atta->id);
        $subcategoryIds = collect($attaNode['children'])->pluck('id');

        // "Atta, Rice & Dal" exposes its own active children, sorted
        // (sort_order, then name), never inactive grandchildren.
        $this->assertEquals(['Atta', 'Dal'], collect($attaNode['children'])->pluck('name')->all());
        $this->assertFalse($subcategoryIds->contains($hidden->id));

        $attaChild = collect($attaNode['children'])->firstWhere('name', 'Atta');
        $this->assertEquals($atta->id, $attaChild['parent_id']);
        $this->assertEquals([], $attaChild['children']);
    }
}
