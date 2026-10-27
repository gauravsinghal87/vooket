<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Permission;
use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryTest extends TestCase
{
    use RefreshDatabase;

    private array $categoryPermissions = [
        'categories.view', 'categories.create', 'categories.update', 'categories.delete',
        'categories.restore', 'categories.reorder', 'categories.feature', 'categories.export',
    ];

    private array $vendorCategoryPermissions = [
        'vendor_categories.view', 'vendor_categories.create', 'vendor_categories.update', 'vendor_categories.delete',
        'vendor_categories.restore', 'vendor_categories.reorder', 'categories.view', 'categories.update',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        collect(array_merge($this->categoryPermissions, $this->vendorCategoryPermissions, ['categories.feature']))
            ->unique()
            ->each(fn (string $slug) => Permission::firstOrCreate(['slug' => $slug], ['name' => str_replace(['.', '-'], [' ', ' '], $slug), 'module' => explode('.', $slug)[0]]));
    }

    private function makeAdmin(): User
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
        $role->permissions()->sync(Permission::pluck('id'));

        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        return $user;
    }

    private function makeVendor(string $type = 'restaurant'): User
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $role->permissions()->sync(Permission::whereIn('slug', $this->vendorCategoryPermissions)->pluck('id'));

        $user = User::factory()->create(['user_type' => 'vendor']);

        Vendor::create([
            'user_id' => $user->id,
            'vendor_type' => $type,
            'business_name' => $type === 'grocery' ? 'Test Market' : 'Test Kitchen',
            'owner_name' => 'Test Owner',
            'phone' => '9000000000',
            'status' => 'approved',
            'is_active' => true,
        ]);

        if ($type === 'grocery') {
            Store::create(['vendor_id' => $user->vendor->id, 'name' => 'Test Market', 'slug' => 'test-market-'.uniqid()]);
        } else {
            Restaurant::create(['vendor_id' => $user->vendor->id, 'name' => 'Test Kitchen', 'slug' => 'test-kitchen-'.uniqid()]);
        }

        $user->roles()->attach($role->id);

        return $user;
    }

    public function test_super_admin_can_list_paginated_categories(): void
    {
        Category::factory()->count(5)->create(['type' => 'food']);
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->getJson('/api/v1/admin/categories?per_page=10');

        $response->assertStatus(200);
        $this->assertIsArray($response->json('data'));
        $this->assertEquals(5, $response->json('meta.pagination.total'));
        $this->assertArrayHasKey('products_count', $response->json('data.0'));
    }

    public function test_super_admin_can_create_category_and_child(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $create = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Fast Food',
            'slug' => 'fast-food',
            'type' => 'food',
            'sort_order' => 1,
        ]);
        $create->assertStatus(201);
        $parentId = $create->json('data.id');

        $child = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Burgers',
            'type' => 'food',
            'parent_id' => $parentId,
        ]);
        $child->assertStatus(201);
        $this->assertEquals($parentId, $child->json('data.parent_id'));
        $this->assertEquals('food', $child->json('data.type'));
    }

    public function test_non_admin_cannot_access_admin_category_endpoints(): void
    {
        $customer = User::factory()->create();
        Sanctum::actingAs($customer, ['*']);

        $response = $this->getJson('/api/v1/admin/categories');

        $response->assertStatus(403);
    }

    public function test_admin_without_permission_denied(): void
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        Sanctum::actingAs($user, ['*']);

        $response = $this->getJson('/api/v1/admin/categories');

        $response->assertStatus(403);
    }

    public function test_cycle_prevention_is_enforced(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $parent = $this->postJson('/api/v1/admin/categories', ['name' => 'Parent', 'type' => 'food'])->json('data');
        $child = $this->postJson('/api/v1/admin/categories', ['name' => 'Child', 'type' => 'food', 'parent_id' => $parent['id']])->json('data');

        $response = $this->putJson("/api/v1/admin/categories/{$parent['id']}", ['parent_id' => $child['id']]);

        $response->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('descendant', $response->json('message'));
    }

    public function test_child_inherits_parent_type(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $parent = $this->postJson('/api/v1/admin/categories', ['name' => 'Pantry', 'type' => 'grocery'])->json('data');

        $child = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Cereals',
            'type' => 'food',
            'parent_id' => $parent['id'],
        ]);

        $child->assertStatus(201);
        $this->assertEquals('grocery', $child->json('data.type'));
    }

    public function test_deleting_parent_with_children_is_blocked(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $parent = $this->postJson('/api/v1/admin/categories', ['name' => 'Parent', 'type' => 'food'])->json('data');
        $this->postJson('/api/v1/admin/categories', ['name' => 'Child', 'type' => 'food', 'parent_id' => $parent['id']]);

        $response = $this->deleteJson("/api/v1/admin/categories/{$parent['id']}");

        $response->assertStatus(409);
        $this->assertDatabaseHas('categories', ['id' => $parent['id'], 'deleted_at' => null]);
    }

    public function test_soft_delete_and_restore(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $created = $this->postJson('/api/v1/admin/categories', ['name' => 'Temp', 'type' => 'food'])->json('data');

        $delete = $this->deleteJson("/api/v1/admin/categories/{$created['id']}");
        $delete->assertStatus(200);
        $this->assertSoftDeleted('categories', ['id' => $created['id']]);

        $restore = $this->postJson("/api/v1/admin/categories/{$created['id']}/restore");
        $restore->assertStatus(200);
        $this->assertDatabaseHas('categories', ['id' => $created['id'], 'deleted_at' => null]);
    }

    public function test_toggle_status_and_featured(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $created = $this->postJson('/api/v1/admin/categories', ['name' => 'Featured Me', 'type' => 'food'])->json('data');

        $toggle = $this->postJson("/api/v1/admin/categories/{$created['id']}/toggle", ['cascade' => false]);
        $toggle->assertStatus(200);
        $this->assertFalse($toggle->json('data.is_active'));

        $featured = $this->postJson("/api/v1/admin/categories/{$created['id']}/toggle-featured");
        $featured->assertStatus(200);
        $this->assertTrue($featured->json('data.is_featured'));

        $this->assertDatabaseHas('audit_logs', ['entity_type' => Category::class, 'action' => 'featured']);
    }

    public function test_reorder_updates_sort_order(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $a = $this->postJson('/api/v1/admin/categories', ['name' => 'Alpha', 'type' => 'food'])->json('data');
        $b = $this->postJson('/api/v1/admin/categories', ['name' => 'Beta', 'type' => 'food'])->json('data');

        $response = $this->postJson('/api/v1/admin/categories/reorder', [
            'items' => [
                ['id' => $a['id'], 'sort_order' => 5],
                ['id' => $b['id'], 'sort_order' => 1],
            ],
        ]);

        $response->assertStatus(200);
        $this->assertEquals(5, Category::find($a['id'])->sort_order);
        $this->assertEquals(1, Category::find($b['id'])->sort_order);
    }

    public function test_admin_can_set_and_validate_category_display_placement(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $created = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Kids',
            'type' => 'grocery',
            'display_placement' => 'top_navigation',
        ]);
        $created->assertStatus(201);
        $id = $created->json('data.id');
        $this->assertEquals('top_navigation', $created->json('data.display_placement'));

        $updated = $this->putJson("/api/v1/admin/categories/{$id}", ['display_placement' => 'main_content']);
        $updated->assertStatus(200);
        $this->assertEquals('main_content', $updated->json('data.display_placement'));

        $invalid = $this->putJson("/api/v1/admin/categories/{$id}", ['display_placement' => 'nowhere']);
        $invalid->assertStatus(422);
        $this->assertDatabaseHas('categories', ['id' => $id, 'display_placement' => 'main_content']);

        $default = $this->postJson('/api/v1/admin/categories', ['name' => 'Defaulted', 'type' => 'grocery'])->json('data');
        $this->assertEquals('both', $default['display_placement']);
        $this->assertDatabaseHas('categories', ['id' => $default['id'], 'display_placement' => 'both']);
    }

    public function test_admin_can_set_and_clear_category_navigation_icon(): void
    {
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $image = config('app.url').'/storage/category-images/dairy.png';
        $navIcon = config('app.url').'/storage/category-navigation-icons/milk.png';

        $created = $this->postJson('/api/v1/admin/categories', [
            'name' => 'Dairy',
            'type' => 'grocery',
            'image' => $image,
            'navigation_icon' => $navIcon,
        ]);

        $created->assertStatus(201);
        $id = $created->json('data.id');
        $this->assertEquals($navIcon, $created->json('data.navigation_icon'));
        $this->assertEquals($image, $created->json('data.image'));

        $removed = $this->deleteJson("/api/v1/admin/categories/{$id}/navigation-icon");
        $removed->assertStatus(200);
        $this->assertNull($removed->json('data.navigation_icon'));

        $category = Category::find($id);
        $this->assertNull($category->navigation_icon);
        $this->assertEquals($image, $category->image);
    }

    public function test_admin_can_upload_category_navigation_icon(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $response = $this->postJson('/api/v1/admin/categories/upload-navigation-icon', [
            'image' => UploadedFile::fake()->image('milk.png', 64, 64),
        ]);

        $response->assertStatus(200);
        $url = $response->json('data.navigation_icon');
        $this->assertStringContainsString('category-navigation-icons', $url);
        Storage::disk('public')->assertExists(Str::after($url, '/storage/'));

        $invalid = $this->postJson('/api/v1/admin/categories/upload-navigation-icon', ['image' => 'not-an-image']);
        $invalid->assertStatus(422);
    }

    public function test_vendor_categories_are_isolated_between_vendors(): void
    {
        $vendorA = $this->makeVendor('restaurant');
        $vendorB = $this->makeVendor('grocery');

        Sanctum::actingAs($vendorA, ['*']);
        $created = $this->postJson('/api/v1/vendor/categories', ['name' => 'Secret Menu'])->json('data');

        Sanctum::actingAs($vendorB, ['*']);
        $list = $this->getJson('/api/v1/vendor/categories');
        $list->assertStatus(200);
        $this->assertCount(0, $list->json('data'));

        $show = $this->getJson("/api/v1/vendor/categories/{$created['id']}");
        $show->assertStatus(404);
    }

    public function test_vendor_category_crud(): void
    {
        $vendor = $this->makeVendor('restaurant');
        Sanctum::actingAs($vendor, ['*']);

        $create = $this->postJson('/api/v1/vendor/categories', ['name' => 'Starters']);
        $create->assertStatus(201);
        $id = $create->json('data.id');

        $child = $this->postJson('/api/v1/vendor/categories', ['name' => 'Paneer Starters', 'parent_id' => $id]);
        $child->assertStatus(201);
        $this->assertEquals($id, $child->json('data.parent_id'));

        $update = $this->putJson("/api/v1/vendor/categories/{$id}", ['name' => 'Appetizers']);
        $update->assertStatus(200);
        $this->assertEquals('Appetizers', $update->json('data.name'));

        $delete = $this->deleteJson("/api/v1/vendor/categories/{$id}")->assertStatus(409);

        $this->deleteJson("/api/v1/vendor/categories/{$child->json('data.id')}")->assertStatus(200);
        $this->deleteJson("/api/v1/vendor/categories/{$id}")->assertStatus(200);
        $this->assertSoftDeleted('vendor_categories', ['id' => $id]);

        $this->postJson("/api/v1/vendor/categories/{$id}/restore")->assertStatus(200);
        $this->assertDatabaseHas('vendor_categories', ['id' => $id, 'deleted_at' => null]);
    }

    public function test_vendor_platform_categories_are_scoped_by_service(): void
    {
        $foodVendor = $this->makeVendor('restaurant');
        $groceryVendor = $this->makeVendor('grocery');

        $foodCategory = Category::create(['name' => 'Biryani', 'slug' => 'platform-biryani', 'type' => 'food']);
        $groceryCategory = Category::create(['name' => 'Dairy', 'slug' => 'platform-dairy', 'type' => 'grocery']);

        Sanctum::actingAs($foodVendor, ['*']);
        $response = $this->getJson('/api/v1/vendor/categories/platform');
        $response->assertStatus(200);
        $returned = collect($response->json('data.categories'));
        $this->assertEquals('food', $response->json('data.service_type'));
        $this->assertTrue($returned->contains('id', $foodCategory->id));
        $this->assertFalse($returned->contains('id', $groceryCategory->id));

        $sync = $this->postJson('/api/v1/vendor/categories/platform', ['category_ids' => [$foodCategory->id]]);
        $sync->assertStatus(200);
        $this->assertEquals([$foodCategory->id], $sync->json('data.selected_category_ids'));

        $wrongType = $this->postJson('/api/v1/vendor/categories/platform', ['category_ids' => [$groceryCategory->id]]);
        $wrongType->assertStatus(422);
    }

    public function test_customer_food_categories_return_active_food_only(): void
    {
        Category::create(['name' => 'Active Food', 'slug' => 'active-food', 'type' => 'food', 'is_active' => true]);
        Category::create(['name' => 'Hidden Food', 'slug' => 'hidden-food', 'type' => 'food', 'is_active' => false]);
        Category::create(['name' => 'Active Grocery', 'slug' => 'active-grocery', 'type' => 'grocery', 'is_active' => true]);

        $response = $this->getJson('/api/v1/food/categories');

        $response->assertStatus(200);
        $names = collect($response->json('data'))->pluck('name');
        $this->assertContains('Active Food', $names);
        $this->assertNotContains('Hidden Food', $names);
        $this->assertNotContains('Active Grocery', $names);
    }
}
