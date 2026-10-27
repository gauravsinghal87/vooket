<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Order;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminOrdersUnifiedTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_orders_index_returns_food_grocery_and_ride_records(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $this->makeOrder($customer, 'food');
        $this->makeOrder($customer, 'grocery');
        $this->makeCompletedRide($this->makeDriver(), $customer);

        Sanctum::actingAs($admin, ['*']);

        $services = collect($this->getJson('/api/v1/admin/orders')->assertOk()->json('data'))
            ->pluck('service')
            ->sort()
            ->values()
            ->all();

        $this->assertSame(['food', 'grocery', 'ride'], $services);
    }

    public function test_admin_orders_index_requires_super_admin_authorization(): void
    {
        $customer = $this->makeCustomer();

        $this->getJson('/api/v1/admin/orders')->assertStatus(401);

        Sanctum::actingAs($customer, ['*']);
        $this->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_admin_orders_ride_record_exposes_ride_status_payment_and_earning_fields(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $driver = $this->makeDriver();
        $ride = $this->makeCompletedRide($driver, $customer);

        DriverEarning::updateOrCreate(
            ['ride_id' => $ride->id],
            [
                'driver_id' => $driver->id,
                'trip_fare' => 200,
                'driver_percentage' => 70,
                'commission_percentage' => 30,
                'commission_amount' => 60,
                'earning_amount' => 140,
                'currency' => 'INR',
                'status' => DriverEarning::STATUS_PENDING,
            ]
        );

        Sanctum::actingAs($admin, ['*']);

        $record = collect($this->getJson('/api/v1/admin/orders')->assertOk()->json('data'))
            ->firstWhere('service', 'ride');

        $this->assertNotNull($record);
        $this->assertSame('ride', $record['service']);
        $this->assertSame($ride->ride_number, $record['order_number']);
        $this->assertSame('COMPLETED', $record['status']);
        $this->assertSame('PAID', $record['payment_status']);
        $this->assertSame('wallet', $record['payment_method']);
        $this->assertSame('200.00', (string) $record['total_amount']);
        $this->assertSame('140.00', (string) $record['driver_earning']);
        $this->assertSame('60.00', (string) $record['admin_commission']);
        $this->assertSame(30.0, (float) $record['commission_percentage']);
        $this->assertSame('10.00', (string) $record['platform_fee']);
        $this->assertSame('5.00', (string) $record['waiting_charge']);
        $this->assertSame('50.00', (string) $record['base_fare']);
        $this->assertSame('60.00', (string) $record['distance_charge']);
        $this->assertSame(4.5, (float) $record['distance_km']);
        $this->assertSame(18, (int) $record['duration_min']);
        $this->assertSame('C Airport Road, Delhi', $record['pickup']['address']);
        $this->assertSame('D Block Connaught Place, Delhi', $record['drop']['address']);
        $this->assertSame($customer->name, $record['user']['name']);
        $this->assertSame($driver->user->name, $record['driver']['name']);
        $this->assertSame('Sedan', $record['vehicle_type']);
    }

    public function test_admin_orders_service_filter_isolates_food_grocery_and_ride(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $this->makeOrder($customer, 'food');
        $this->makeOrder($customer, 'grocery');
        $this->makeCompletedRide($this->makeDriver(), $customer);

        Sanctum::actingAs($admin, ['*']);

        $food = $this->getJson('/api/v1/admin/orders?service=food')->assertOk()->json('data');
        $this->assertSame(['food'], collect($food)->pluck('service')->unique()->values()->all());

        $grocery = $this->getJson('/api/v1/admin/orders?service=grocery')->assertOk()->json('data');
        $this->assertSame(['grocery'], collect($grocery)->pluck('service')->unique()->values()->all());

        $rides = $this->getJson('/api/v1/admin/orders?service=ride')->assertOk()->json('data');
        $this->assertSame(['ride'], collect($rides)->pluck('service')->unique()->values()->all());

        $legacyGrocery = $this->getJson('/api/v1/admin/orders?order_type=grocery')->assertOk()->json('data');
        $this->assertSame(['grocery'], collect($legacyGrocery)->pluck('service')->unique()->values()->all());
    }

    public function test_admin_orders_search_matches_order_number_ride_number_and_customer(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $order = $this->makeOrder($customer, 'food');
        $ride = $this->makeCompletedRide($this->makeDriver(), $customer);

        Sanctum::actingAs($admin, ['*']);

        $byOrder = $this->getJson('/api/v1/admin/orders?search='.substr($order->order_number, 4, 6))->assertOk()->json('data');
        $this->assertSame([$order->order_number], collect($byOrder)->pluck('order_number')->values()->all());

        $byRide = $this->getJson('/api/v1/admin/orders?search='.substr($ride->ride_number, 4, 6))->assertOk()->json('data');
        $this->assertSame([$ride->ride_number], collect($byRide)->pluck('order_number')->values()->all());

        $byCustomer = $this->getJson('/api/v1/admin/orders?search='.$customer->name)->assertOk()->json('data');
        $this->assertCount(2, $byCustomer);
    }

    public function test_admin_orders_pagination_merges_and_counts_orders_and_rides(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $driver = $this->makeDriver();

        for ($i = 0; $i < 6; $i++) {
            $this->makeOrder($customer, $i % 2 === 0 ? 'food' : 'grocery');
        }
        for ($i = 0; $i < 4; $i++) {
            $this->makeCompletedRide($driver, $customer);
        }

        Sanctum::actingAs($admin, ['*']);

        $first = $this->getJson('/api/v1/admin/orders?per_page=3&page=1')->assertOk();
        $firstIds = array_column($first->json('data'), 'id');
        $this->assertCount(3, $firstIds);
        $this->assertSame(10, $first->json('meta.pagination.total'));
        $this->assertSame(4, $first->json('meta.pagination.last_page'));

        $last = $this->getJson('/api/v1/admin/orders?per_page=3&page=4')->assertOk();
        $lastIds = array_column($last->json('data'), 'id');
        $this->assertCount(1, $lastIds);

        $allIds = array_unique(array_merge($firstIds, $lastIds));
        $this->assertCount(4, $allIds);
    }

    public function test_food_and_grocery_order_records_keep_their_fields_and_status_filter(): void
    {
        $admin = $this->makeAdmin();
        $customer = $this->makeCustomer();
        $food = $this->makeOrder($customer, 'food');
        $grocery = $this->makeOrder($customer, 'grocery');

        Sanctum::actingAs($admin, ['*']);

        $this->getJson('/api/v1/admin/orders?status=DELIVERED')->assertOk()
            ->assertJsonFragment(['order_number' => $food->order_number])
            ->assertJsonFragment(['order_number' => $grocery->order_number]);

        $this->getJson('/api/v1/admin/orders?status=CANCELLED')->assertOk()
            ->assertJsonMissing(['order_number' => $food->order_number]);

        $record = collect($this->getJson('/api/v1/admin/orders?service=food')->assertOk()->json('data'))->first();
        $this->assertSame('food', $record['order_type']);
        $this->assertSame('DELIVERED', $record['status']);
        $this->assertSame('paid', $record['payment_status']);
        $this->assertSame($food->total_amount, (string) $record['total_amount']);
        $this->assertArrayHasKey('vendor', $record);
    }

    private function makeAdmin(): User
    {
        Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::create([
            'name' => 'Unified Admin',
            'email' => 'unified-admin@example.com',
            'phone' => '9000000011',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([Role::where('slug', 'super_admin')->first()->id]);

        return $admin;
    }

    private function makeCustomer(): User
    {
        return User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
    }

    private function makeDriver(): Driver
    {
        $vehicleType = VehicleType::factory()->create(['name' => 'Sedan']);

        return Driver::factory()->create([
            'vehicle_type_id' => $vehicleType->id,
            'is_online' => true,
            'is_busy' => false,
        ]);
    }

    private function makeOrder(User $customer, string $orderType): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Unified Test Kitchen',
            'owner_name' => 'Owner',
            'phone' => '9898989111',
            'vendor_type' => $orderType === 'grocery' ? 'store' : 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'idempotency_key' => 'idem-'.uniqid(),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => 'DELIVERED',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'subtotal' => 200,
            'delivery_fee' => 40,
            'total_amount' => 240,
        ]);
    }

    private function makeCompletedRide(Driver $driver, User $customer): Ride
    {
        $vehicleType = $driver->vehicleType ?: VehicleType::factory()->create(['name' => 'Sedan']);

        $ride = Ride::create([
            'ride_number' => 'RIDE_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'driver_id' => $driver->id,
            'vehicle_type_id' => $vehicleType->id,
            'status' => Ride::STATUS_COMPLETED,
            'pickup_address' => 'C Airport Road, Delhi',
            'pickup_latitude' => 28.5562,
            'pickup_longitude' => 77.1000,
            'destination_address' => 'D Block Connaught Place, Delhi',
            'destination_latitude' => 28.6315,
            'destination_longitude' => 77.2167,
            'distance_km' => 4.5,
            'duration_min' => 18,
            'base_fare' => 50,
            'distance_charge' => 60,
            'time_charge' => 40,
            'booking_fee' => 20,
            'platform_fee' => 10,
            'waiting_charge' => 5,
            'tax_amount' => 15,
            'estimated_fare' => 200,
            'final_fare' => 200,
            'payment_method' => 'wallet',
            'payment_status' => Ride::PAYMENT_STATUS_PAID,
            'trip_completed_at' => now(),
        ]);

        return $ride;
    }
}
