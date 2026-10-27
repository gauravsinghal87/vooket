<?php

namespace Tests\Feature;

use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Driver;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PartnerOnboardingTest extends TestCase
{
    use RefreshDatabase;

    private Role $driverRole;

    private Role $deliveryRole;

    private Role $adminRole;

    protected function setUp(): void
    {
        parent::setUp();

        $this->driverRole = Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']);
        $this->deliveryRole = Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']);
        $this->adminRole = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
    }

    private function registerDriver(): array
    {
        VehicleType::create(['name' => 'Cab (Mini)', 'code' => 'cab_mini']);

        return [
            'role' => 'driver',
            'name' => 'New Driver',
            'email' => 'driver.new@example.com',
            'phone' => '9898989898',
            'password' => 'secret123',
            'vehicle_type_id' => VehicleType::first()->id,
            'vehicle_number' => 'KA-01-AB-1234',
            'vehicle_model' => 'Maruti Swift',
            'vehicle_color' => 'White',
            'license_number' => 'DL-99999999',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '111122223333',
            'zone_id' => $this->zone()->id,
        ];
    }

    private function zone(): Zone
    {
        return Zone::firstOrCreate(
            ['code' => 'PARTNER-ZONE'],
            [
                'name' => 'Partner Zone',
                'type' => 'multi',
                'city' => 'Bengaluru',
                'country' => 'IN',
                'food_enabled' => true,
                'grocery_enabled' => true,
                'ride_enabled' => true,
                'priority' => 10,
                'is_active' => true,
            ]
        );
    }

    public function test_driver_registration_creates_pending_profile(): void
    {
        $response = $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());

        $response->assertStatus(201);

        $user = User::where('email', 'driver.new@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('driver'));

        $driver = Driver::where('user_id', $user->id)->first();
        $this->assertNotNull($driver);
        $this->assertEquals('pending', $driver->status);
        $this->assertFalse($driver->is_online);
        $this->assertFalse($driver->is_verified);
    }

    public function test_delivery_partner_registration_creates_pending_profile(): void
    {
        $payload = [
            'role' => 'delivery_partner',
            'name' => 'New Partner',
            'email' => 'partner.new@example.com',
            'phone' => '9797979797',
            'password' => 'secret123',
            'vehicle_type' => 'bike',
            'vehicle_number' => 'KA-02-CD-5678',
            'vehicle_model' => '',
            'vehicle_color' => '',
            'service_type' => 'food',
            'license_number' => 'DL-88888888',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '444455556666',
            'pan_number' => '',
            'bank_name' => '',
            'zone_id' => $this->zone()->id,
        ];

        $response = $this->postJson('/api/v1/auth/partner/register', $payload);

        $response->assertStatus(201);

        $user = User::where('email', 'partner.new@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('delivery_partner'));

        $partner = DeliveryPartner::where('user_id', $user->id)->first();
        $this->assertNotNull($partner);
        $this->assertEquals('pending', $partner->status);
        $this->assertEquals('food', $partner->service_type);
        $this->assertFalse($partner->is_online);
    }

    public function test_pending_driver_cannot_go_online(): void
    {
        $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());
        $user = User::where('email', 'driver.new@example.com')->first();

        Sanctum::actingAs($user, ['*']);
        $response = $this->postJson('/api/v1/driver/availability');

        $response->assertStatus(422);
        $this->assertStringContainsStringIgnoringCase('application', $response->json('message'));
    }

    public function test_admin_approves_and_rejects_driver(): void
    {
        $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());
        $user = User::where('email', 'driver.new@example.com')->first();
        $driver = Driver::where('user_id', $user->id)->first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $approve = $this->putJson("/api/v1/admin/drivers/{$driver->id}", ['status' => 'approved']);
        $approve->assertStatus(200);
        $driver->refresh();
        $this->assertEquals('approved', $driver->status);
        $this->assertTrue($driver->is_verified);
        $this->assertNotNull($driver->verified_at);

        $reject = $this->putJson("/api/v1/admin/drivers/{$driver->id}", [
            'status' => 'rejected',
            'rejection_reason' => 'Licence number looks incorrect',
        ]);
        $reject->assertStatus(200);
        $driver->refresh();
        $this->assertEquals('rejected', $driver->status);
        $this->assertEquals('Licence number looks incorrect', $driver->rejection_reason);
    }

    public function test_rejected_driver_can_reapply(): void
    {
        $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());
        $user = User::where('email', 'driver.new@example.com')->first();
        $driver = Driver::where('user_id', $user->id)->first();

        $driver->update(['status' => 'rejected', 'rejection_reason' => 'Bad document', 'reviewed_at' => now()]);

        Sanctum::actingAs($user, ['*']);
        $response = $this->postJson('/api/v1/auth/partner/reapply', ['vehicle_number' => 'KA-01-AB-9999']);

        $response->assertStatus(200);
        $driver->refresh();
        $this->assertEquals('pending', $driver->status);
        $this->assertNull($driver->rejection_reason);
        $this->assertNull($driver->reviewed_at);
        $this->assertEquals('KA-01-AB-9999', $driver->vehicle_number);
    }

    public function test_approved_driver_can_go_online(): void
    {
        $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());
        $user = User::where('email', 'driver.new@example.com')->first();
        $driver = Driver::where('user_id', $user->id)->first();
        $driver->update(['status' => 'approved']);

        Sanctum::actingAs($user, ['*']);
        $response = $this->postJson('/api/v1/driver/availability');

        $response->assertStatus(200);
        $this->assertTrue($response->json('data.is_online'));
        $this->assertEquals('approved', $driver->fresh()->status);
    }

    public function test_admin_can_review_driver_details(): void
    {
        $this->postJson('/api/v1/auth/partner/register', $this->registerDriver());
        $driver = Driver::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $response = $this->getJson("/api/v1/admin/drivers/{$driver->id}");

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals($driver->id, $data['id']);
        $this->assertEquals('driver.new@example.com', $data['user']['email']);
        $this->assertEquals('DL-99999999', $data['license_number']);
        $this->assertEquals('pending', $data['status']);
        $this->assertArrayHasKey('documents', $data);
    }

    public function test_admin_can_review_delivery_partner_details(): void
    {
        $payload = [
            'role' => 'delivery_partner',
            'name' => 'New Partner',
            'email' => 'partner.review@example.com',
            'phone' => '9797979797',
            'password' => 'secret123',
            'vehicle_type' => 'bike',
            'vehicle_number' => 'KA-02-CD-5678',
            'service_type' => 'food',
            'license_number' => 'DL-88888888',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '444455556666',
            'bank_account_name' => 'New Partner',
            'bank_account_number' => '50200012345',
            'bank_ifsc' => 'HDFC0000123',
            'bank_name' => 'HDFC Bank',
            'zone_id' => $this->zone()->id,
        ];
        $this->postJson('/api/v1/auth/partner/register', $payload);
        $partner = DeliveryPartner::first();

        $admin = User::factory()->create();
        $admin->roles()->attach($this->adminRole->id);
        Sanctum::actingAs($admin, ['*']);

        $response = $this->getJson("/api/v1/admin/delivery-partners/{$partner->id}");

        $response->assertStatus(200);
        $data = $response->json('data');
        $this->assertEquals($partner->id, $data['id']);
        $this->assertEquals('partner.review@example.com', $data['user']['email']);
        $this->assertEquals('bike', $data['vehicle_type']);
        $this->assertEquals('food', $data['service_type']);
        $this->assertEquals('HDFC0000123', $data['bank_ifsc']);
    }

    public function test_grocery_delivery_partner_registration_sets_service_type(): void
    {
        $payload = [
            'role' => 'delivery_partner',
            'name' => 'Grocery Partner',
            'email' => 'partner.grocery@example.com',
            'phone' => '9696969696',
            'password' => 'secret123',
            'vehicle_type' => 'scooter',
            'vehicle_number' => 'KA-03-EF-1234',
            'service_type' => 'grocery',
            'license_number' => 'DL-77777777',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '777788889999',
            'zone_id' => $this->zone()->id,
        ];

        $response = $this->postJson('/api/v1/auth/partner/register', $payload);

        $response->assertStatus(201);

        $user = User::where('email', 'partner.grocery@example.com')->first();
        $partner = DeliveryPartner::where('user_id', $user->id)->first();
        $this->assertEquals('grocery', $partner->service_type);
        $this->assertEquals('pending', $partner->status);
    }

    public function test_delivery_partner_registration_requires_service_type(): void
    {
        $payload = [
            'role' => 'delivery_partner',
            'name' => 'No Service Partner',
            'email' => 'partner.noservice@example.com',
            'phone' => '9595959595',
            'password' => 'secret123',
            'vehicle_type' => 'bike',
            'vehicle_number' => 'KA-04-GH-5678',
            'license_number' => 'DL-66666666',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '111199992222',
        ];

        $response = $this->postJson('/api/v1/auth/partner/register', $payload);

        $response->assertStatus(422);
        $this->assertNull(User::where('email', 'partner.noservice@example.com')->first());
    }

    public function test_incoming_orders_filtered_by_partner_service_type(): void
    {
        $payload = [
            'role' => 'delivery_partner',
            'name' => 'Food Only Partner',
            'email' => 'partner.foodonly@example.com',
            'phone' => '9494949494',
            'password' => 'secret123',
            'vehicle_type' => 'bike',
            'vehicle_number' => 'KA-05-JK-9012',
            'service_type' => 'food',
            'license_number' => 'DL-55555555',
            'license_expiry' => now()->addYear()->toDateString(),
            'aadhar_number' => '333344445555',
            'zone_id' => $this->zone()->id,
        ];

        $this->postJson('/api/v1/auth/partner/register', $payload);
        $user = User::where('email', 'partner.foodonly@example.com')->first();
        $partner = DeliveryPartner::where('user_id', $user->id)->first();
        $partner->update(['status' => 'approved']);

        $customer = User::factory()->create();

        $groceryOrder = Order::create([
            'order_number' => 'ORD-GRO-1',
            'user_id' => $customer->id,
            'order_type' => 'grocery',
        ]);
        DispatchLog::create([
            'dispatch_type' => 'order',
            'order_id' => $groceryOrder->id,
            'candidate_id' => $partner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        $foodOrder = Order::create([
            'order_number' => 'ORD-FOO-1',
            'user_id' => $customer->id,
            'order_type' => 'food',
        ]);
        DispatchLog::create([
            'dispatch_type' => 'order',
            'order_id' => $foodOrder->id,
            'candidate_id' => $partner->id,
            'candidate_type' => DispatchLog::CANDIDATE_TYPE_DELIVERY_PARTNER,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        Sanctum::actingAs($user, ['*']);
        $response = $this->getJson('/api/v1/delivery-partner/incoming-orders');

        $response->assertStatus(200);
        $incoming = collect($response->json('data'));
        $this->assertCount(1, $incoming);
        $this->assertEquals('ORD-FOO-1', $incoming->first()['order']['order_number']);
        $this->assertNotEquals('ORD-GRO-1', $incoming->first()['order']['order_number']);
    }
}
