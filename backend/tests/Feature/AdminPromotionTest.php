<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\Coupon;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminPromotionTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Promotion Admin',
            'email' => 'promo@example.com',
            'phone' => '9999999999',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    public function test_admin_can_create_an_active_coupon(): void
    {
        $res = $this->postJson('/api/v1/admin/coupons', [
            'code' => 'SAVE20',
            'name' => '20% Off',
            'type' => 'percentage',
            'value' => '20',
            'max_discount' => '100',
            'min_order_amount' => '200',
            'service' => 'food',
            'is_active' => true,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);

        $this->assertDatabaseHas('coupons', ['code' => 'SAVE20', 'service' => 'food']);
    }

    public function test_admin_can_create_a_banner(): void
    {
        $res = $this->postJson('/api/v1/admin/banners', [
            'title' => 'Weekend Sale',
            'position' => 'home',
            'image' => 'https://example.com/banner.jpg',
            'target_type' => 'url',
            'target_url' => 'https://example.com/sale',
            'is_active' => true,
        ], $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);

        $this->assertDatabaseHas('banners', ['title' => 'Weekend Sale', 'position' => 'home']);
    }

    public function test_admin_can_upload_a_banner_image(): void
    {
        Storage::fake('public');

        $res = $this->postJson('/api/v1/admin/banners/upload', [
            'image' => UploadedFile::fake()->image('banner.png', 800, 400),
        ], $this->authHeaders());

        $res->assertOk()->assertJsonPath('success', true);

        $image = $res->json('data.image');
        $this->assertNotEmpty($image);
        Storage::disk('public')->assertExists(str_replace(config('app.url').'/storage/', '', $image));
    }

    public function test_banner_image_upload_requires_an_image_file(): void
    {
        $res = $this->postJson('/api/v1/admin/banners/upload', ['image' => 'not-a-file'], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('image', $res->json('errors'));
        $this->assertDatabaseCount(Banner::class, 0);
    }

    public function test_coupon_creation_rejects_duplicate_code(): void
    {
        Coupon::create([
            'code' => 'SAVE20',
            'name' => 'Existing',
            'type' => 'percentage',
            'value' => '10',
        ]);

        $res = $this->postJson('/api/v1/admin/coupons', [
            'code' => 'SAVE20',
            'name' => 'Duplicate',
            'type' => 'percentage',
            'value' => '20',
        ], $this->authHeaders());

        $res->assertStatus(422);
        $this->assertArrayHasKey('code', $res->json('errors'));
    }
}
