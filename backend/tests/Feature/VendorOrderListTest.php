<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class VendorOrderListTest extends TestCase
{
    use RefreshDatabase;

    private Role $vendorRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
    }

    private function makeVendor(): User
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor']);
        $vendorUser->roles()->attach($this->vendorRole->id);
        Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Spice Villa',
            'owner_name' => 'Rahul Sharma',
            'email' => 'spice@example.com',
            'phone' => '9898989898',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        return $vendorUser;
    }

    private function makeOrder(int $vendorId, string $status): Order
    {
        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => User::factory()->create()->id,
            'vendor_id' => $vendorId,
            'order_type' => 'food',
            'status' => $status,
            'payment_status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'total_amount' => 230,
        ]);
    }

    public function test_active_orders_list_includes_delivered_items_snapshot(): void
    {
        $vendorUser = $this->makeVendor();
        $vendorId = Vendor::where('user_id', $vendorUser->id)->value('id');

        $product = Product::create([
            'vendor_id' => $vendorId,
            'name' => 'Masala Chai',
            'slug' => 'masala-chai-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => 109.43,
            'type' => 'food',
            'is_active' => true,
            'is_available' => true,
        ]);

        $order = $this->makeOrder($vendorId, 'PENDING');
        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => 'Masala Chai',
            'quantity' => 1,
            'unit_price' => 109.43,
            'price_snapshot' => 109.43,
            'line_total' => 109.43,
            'selected_options' => [
                ['group_id' => 2, 'option_id' => 3, 'group_name' => 'Add-ons', 'option_name' => 'Adrak', 'price' => 10],
                ['group_id' => 3, 'option_id' => 8, 'group_name' => 'Size', 'option_name' => 'Large', 'price' => 89.43],
            ],
        ]);

        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->getJson('/api/v1/vendor/orders');

        $response->assertStatus(200);
        $row = collect($response->json('data'))->firstWhere('order_number', $order->order_number);
        $item = $row['items'][0];

        $this->assertSame('Masala Chai', $item['product_name']);
        $this->assertSame(1, $item['quantity']);
        $this->assertSame('109.43', $item['unit_price']);
        $this->assertSame('109.43', $item['line_total']);
        $this->assertEqualsCanonicalizing(
            ['Add-ons', 'Size'],
            collect($item['selected_options'])->pluck('group_name')->all()
        );
    }

    public function test_active_orders_list_includes_accepted_orders(): void
    {
        $vendorUser = $this->makeVendor();
        $vendorId = Vendor::where('user_id', $vendorUser->id)->value('id');

        $this->makeOrder($vendorId, 'PENDING');
        $this->makeOrder($vendorId, 'ACCEPTED');
        $this->makeOrder($vendorId, 'PREPARING');
        $this->makeOrder($vendorId, 'READY');
        $this->makeOrder($vendorId, 'OUT_FOR_DELIVERY');

        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->getJson('/api/v1/vendor/orders');

        $response->assertStatus(200);
        $statuses = collect($response->json('data'))->pluck('status')->all();
        $this->assertEqualsCanonicalizing(
            ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'],
            $statuses
        );
        $this->assertContains('ACCEPTED', $statuses);
    }

    public function test_accepted_orders_are_excluded_from_delivered_tab(): void
    {
        $vendorUser = $this->makeVendor();
        $vendorId = Vendor::where('user_id', $vendorUser->id)->value('id');

        $this->makeOrder($vendorId, 'ACCEPTED');
        $this->makeOrder($vendorId, 'DELIVERED');

        Sanctum::actingAs($vendorUser, ['*']);

        $response = $this->getJson('/api/v1/vendor/orders?status=delivered');

        $response->assertStatus(200);
        $this->assertEqualsCanonicalizing(['DELIVERED'], collect($response->json('data'))->pluck('status')->all());
    }
}
