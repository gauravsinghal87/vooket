<?php

namespace Tests\Feature;

use App\Models\Restaurant;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VendorRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    private Role $adminRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $this->adminRole = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
    }

    private function restaurantPayload(): array
    {
        return [
            'vendor_type' => 'restaurant',
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'email' => 'vendor.restaurant@example.com',
            'phone' => '9898989898',
            'password' => 'secret123',
            'address' => 'MG Road, Bengaluru',
            'gst_number' => '29ABCDE1234F1Z5',
            'pan_number' => 'ABCDE1234F',
            'fssai_number' => '12345678901234',
            'bank_account_name' => 'Rahul Sharma',
            'bank_account_number' => '50200011111',
            'bank_ifsc' => 'HDFC0000123',
            'bank_name' => 'HDFC Bank',
            'avg_prep_time_min' => 25,
            'opens_at' => '10:00',
            'closes_at' => '23:00',
        ];
    }

    public function test_restaurant_registration_creates_pending_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());

        $response->assertStatus(201);

        $user = User::where('email', 'vendor.restaurant@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('vendor'));
        $this->assertEquals('vendor', $user->user_type);

        $vendor = Vendor::where('user_id', $user->id)->first();
        $this->assertNotNull($vendor);
        $this->assertEquals('restaurant', $vendor->vendor_type);
        $this->assertEquals('pending', $vendor->status);
        $this->assertEquals('Spice Villa', $vendor->business_name);
        $this->assertEquals('HDFC0000123', $vendor->bank_ifsc);
        $this->assertTrue($vendor->is_active);
    }

    public function test_grocery_registration_does_not_require_fssai(): void
    {
        $payload = [
            'vendor_type' => 'grocery',
            'business_name' => 'FreshMart',
            'owner_name' => 'Priya Patel',
            'email' => 'vendor.grocery@example.com',
            'phone' => '9797979797',
            'password' => 'secret123',
            'gst_number' => '',
            'pan_number' => '',
            'bank_name' => '',
        ];

        $response = $this->postJson('/api/v1/auth/vendor/register', $payload);

        $response->assertStatus(201);

        $user = User::where('email', 'vendor.grocery@example.com')->first();
        $vendor = Vendor::where('user_id', $user->id)->first();
        $this->assertEquals('grocery', $vendor->vendor_type);
        $this->assertEquals('pending', $vendor->status);
    }

    public function test_admin_can_review_and_approve_vendor(): void
    {
        $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());
        $vendor = Vendor::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $detail = $this->getJson("/api/v1/admin/vendors/{$vendor->id}");
        $detail->assertStatus(200);
        $this->assertEquals('Spice Villa', $detail->json('data.business_name'));
        $this->assertEquals('vendor.restaurant@example.com', $detail->json('data.email'));

        $approve = $this->postJson("/api/v1/admin/vendors/{$vendor->id}/review", ['action' => 'approve', 'commission_rate' => 10]);
        $approve->assertStatus(200);
        $vendor->refresh();
        $this->assertEquals('approved', $vendor->status);
        $this->assertNotNull($vendor->approved_at);
        $this->assertTrue($vendor->is_active);
    }

    public function test_approving_restaurant_vendor_creates_auto_outlet_restaurant(): void
    {
        $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());
        $vendor = Vendor::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/vendors/{$vendor->id}/review", ['action' => 'approve', 'commission_rate' => 10]);

        $restaurant = Restaurant::where('vendor_id', $vendor->id)->first();
        $this->assertNotNull($restaurant);
        $this->assertEquals('Spice Villa', $restaurant->name);
        $this->assertEquals('both', $restaurant->order_type);
        $this->assertFalse($restaurant->is_open);
        $this->assertEquals($vendor->phone, $restaurant->phone);

        $this->postJson("/api/v1/admin/vendors/{$vendor->id}/review", ['action' => 'approve', 'commission_rate' => 10]);
        $this->assertEquals(1, Restaurant::where('vendor_id', $vendor->id)->count());
    }

    public function test_approving_grocery_vendor_creates_auto_outlet_store(): void
    {
        $payload = [
            'vendor_type' => 'grocery',
            'business_name' => 'FreshMart',
            'owner_name' => 'Priya Patel',
            'email' => 'vendor.grocery@example.com',
            'phone' => '9797979797',
            'password' => 'secret123',
            'gst_number' => '',
            'pan_number' => '',
            'bank_name' => '',
        ];
        $this->postJson('/api/v1/auth/vendor/register', $payload);
        $vendor = Vendor::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/vendors/{$vendor->id}/review", ['action' => 'approve']);

        $store = Store::where('vendor_id', $vendor->id)->first();
        $this->assertNotNull($store);
        $this->assertEquals('FreshMart', $store->name);
        $this->assertEquals('supermarket', $store->store_type);
        $this->assertFalse($store->is_open);
    }

    public function test_admin_can_reject_vendor_and_user_stays_active_for_reapply(): void
    {
        $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());
        $user = User::where('email', 'vendor.restaurant@example.com')->first();
        $vendor = Vendor::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $reject = $this->postJson("/api/v1/admin/vendors/{$vendor->id}/review", [
            'action' => 'reject',
            'rejection_reason' => 'FSSAI documents not provided',
        ]);
        $reject->assertStatus(200);
        $vendor->refresh();
        $this->assertEquals('rejected', $vendor->status);
        $this->assertEquals('FSSAI documents not provided', $vendor->rejection_reason);
        $this->assertTrue($user->fresh()->is_active);
        $this->assertFalse($vendor->fresh()->is_active);
    }

    public function test_rejected_vendor_can_reapply(): void
    {
        $this->postJson('/api/v1/auth/vendor/register', $this->restaurantPayload());
        $user = User::where('email', 'vendor.restaurant@example.com')->first();
        $vendor = Vendor::first();
        $vendor->update(['status' => 'rejected', 'rejection_reason' => 'Missing FSSAI', 'is_active' => false]);
        $user->update(['is_active' => false]);

        Sanctum::actingAs($user, ['*']);
        $response = $this->postJson('/api/v1/auth/vendor/reapply', [
            'fssai_number' => '12345678901234',
        ]);

        $response->assertStatus(200);
        $vendor->refresh();
        $this->assertEquals('pending', $vendor->status);
        $this->assertNull($vendor->rejection_reason);
        $this->assertTrue($vendor->is_active);
        $this->assertTrue($user->fresh()->is_active);
        $this->assertEquals('12345678901234', $vendor->fssai_number);
    }
}
