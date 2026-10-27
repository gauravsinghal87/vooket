<?php

namespace Tests\Feature;

use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Driver;
use App\Models\FareRule;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Ride;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Vendor;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use App\Services\Integration\WebhookNotifier;
use App\Services\RideService;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WebhookDispatchTest extends TestCase
{
    use RefreshDatabase;

    private function makeOrder(User $customer, User $merchant, string $number): Order
    {
        $vendor = Vendor::create([
            'user_id' => $merchant->id,
            'business_name' => 'Merchant Shop',
            'vendor_type' => 'restaurant',
            'owner_name' => $merchant->name,
            'phone' => $merchant->phone,
            'status' => 'approved',
        ]);

        return Order::create([
            'order_number' => $number,
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => 'food',
            'status' => 'PENDING',
            'payment_status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'total_amount' => 250.0,
        ]);
    }

    public function test_order_created_event_reaches_matching_subscription_when_order_flow_happens(): void
    {
        Http::fake();

        $user = User::create(['name' => 'Customer', 'phone' => '5555555555', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '4444444444', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.created'],
            'status' => true,
            'secret' => 's3cret',
        ]);

        $order = $this->makeOrder($user, $merchant, 'ORD_TEST_1');

        app(WebhookNotifier::class)->orderCreated($order);

        $delivery = WebhookDelivery::where('event', 'order.created')->first();
        $this->assertNotNull($delivery);
        $this->assertSame($order->id, data_get($delivery->payload, 'id'));
        $this->assertSame('250', (string) data_get($delivery->payload, 'total_amount'));
    }

    public function test_subscription_for_other_events_is_not_matched(): void
    {
        Http::fake();

        $user = User::create(['name' => 'Customer', 'phone' => '3333333333', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '2222222222', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.cancelled'],
            'status' => true,
        ]);

        $order = $this->makeOrder($user, $merchant, 'ORD_TEST_2');

        app(WebhookNotifier::class)->orderCreated($order);

        $this->assertDatabaseMissing('webhook_deliveries', ['event' => 'order.created']);
    }

    public function test_delivery_partner_marking_order_delivered_dispatches_order_delivered(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234567890', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9876543210', 'user_type' => 'vendor', 'is_active' => true]);
        $partner = User::create(['name' => 'Rider', 'phone' => '9000000001', 'user_type' => 'delivery_partner', 'is_active' => true]);
        $partner->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        $vendor = Vendor::create([
            'user_id' => $merchant->id,
            'business_name' => 'Merchant Shop',
            'vendor_type' => 'restaurant',
            'owner_name' => $merchant->name,
            'phone' => $merchant->phone,
            'status' => 'approved',
        ]);

        $deliveryPartner = DeliveryPartner::create([
            'user_id' => $partner->id,
            'status' => 'approved',
        ]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.delivered'],
            'status' => true,
        ]);

        $order = Order::create([
            'order_number' => 'ORD_TEST_4',
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'delivery_partner_id' => $deliveryPartner->id,
            'order_type' => 'food',
            'status' => 'OUT_FOR_DELIVERY',
            'payment_status' => 'paid',
            'payment_method' => 'online',
            'total_amount' => 250.0,
            'delivery_otp_verified_at' => now(),
        ]);

        Sanctum::actingAs($partner, ['*']);

        $response = $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered']);

        $response->assertOk();
        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'order.delivered']);
        $this->assertSame('DELIVERED', data_get(WebhookDelivery::where('event', 'order.delivered')->first()->payload, 'status'));
        $this->assertSame(1, $deliveryPartner->fresh()->total_deliveries);
    }

    public function test_catalog_publishes_delivery_events_and_subscriptions_accept_them(): void
    {
        $catalog = array_keys(config('webhooks.events', []));
        $this->assertContains('order.picked_up', $catalog);
        $this->assertContains('order.out_for_delivery', $catalog);
        $this->assertContains('order.arrived', $catalog);
        $this->assertContains('order.delivered', $catalog);

        $merchant = User::create(['name' => 'Merchant', 'phone' => '9000000002', 'user_type' => 'vendor', 'is_active' => true]);

        Sanctum::actingAs($merchant, ['*']);

        $response = $this->postJson('/api/v1/webhooks/subscribe', [
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.picked_up', 'order.out_for_delivery', 'order.arrived', 'order.delivered'],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('webhook_subscriptions', [
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
        ]);
    }

    public function test_inactive_subscription_is_skipped(): void
    {
        Http::fake();

        $user = User::create(['name' => 'Customer', 'phone' => '1111111111', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9999999998', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.created'],
            'status' => false,
        ]);

        $order = $this->makeOrder($user, $merchant, 'ORD_TEST_3');

        app(WebhookNotifier::class)->orderCreated($order);

        $this->assertDatabaseMissing('webhook_deliveries', ['event' => 'order.created']);
    }

    public function test_completed_payment_dispatches_payment_captured_and_order_updated(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500001', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9876500001', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['payment.captured', 'order.updated'],
            'status' => true,
        ]);

        $order = $this->makeOrder($customer, $merchant, 'ORD_PAY_1');

        Sanctum::actingAs($customer, ['*']);

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'amount' => 250.0,
            'payment_method' => 'upi',
        ]);
        $initiate->assertStatus(201);
        $payment = Payment::where('payment_number', $initiate->json('data.payment_number'))->firstOrFail();

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $payment->payment_number,
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($payment->provider_order_id),
            'provider_order_id' => $payment->provider_order_id,
            'signature' => 'sig_test',
        ])->assertOk();

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'payment.captured']);
        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'order.updated']);
        $this->assertSame('paid', Order::find($order->id)->payment_status);
    }

    public function test_failed_payment_dispatches_payment_failed_only(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500002', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9876500002', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['payment.captured', 'payment.failed'],
            'status' => true,
        ]);

        $order = $this->makeOrder($customer, $merchant, 'ORD_PAY_2');

        Sanctum::actingAs($customer, ['*']);

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'amount' => 250.0,
            'payment_method' => 'upi',
        ]);
        $initiate->assertStatus(201);
        $payment = Payment::where('payment_number', $initiate->json('data.payment_number'))->firstOrFail();

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $payment->payment_number,
            'provider_payment_id' => 'pay_fail_test',
            'provider_order_id' => $payment->provider_order_id,
            'signature' => 'sig_test',
        ])->assertOk();

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'payment.failed']);
        $this->assertDatabaseMissing('webhook_deliveries', ['event' => 'payment.captured']);
        $this->assertSame('pending', Order::find($order->id)->payment_status);
    }

    public function test_health_endpoint_lists_catalog_events(): void
    {
        $customer = User::create(['name' => 'Customer', 'phone' => '1234500003', 'user_type' => 'customer', 'is_active' => true]);

        Sanctum::actingAs($customer, ['*']);

        $this->getJson('/api/v1/webhooks/health')
            ->assertOk()
            ->assertJsonFragment(['name' => 'payment.captured'])
            ->assertJsonFragment(['name' => 'order.updated']);
    }

    public function test_wallet_credit_and_debit_dispatch_wallet_events(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500004', 'user_type' => 'customer', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $customer->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['wallet.credited', 'wallet.debited'],
            'status' => true,
        ]);

        $walletService = app(WalletService::class);

        $transaction = $walletService->credit($customer, 'customer', 500.0, 'CREDIT', null, null, 'Top up', Str::uuid()->toString());

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'wallet.credited']);
        $this->assertSame((string) $transaction->id, (string) data_get(WebhookDelivery::where('event', 'wallet.credited')->first()->payload, 'id'));
        $this->assertSame(500.0, (float) data_get(WebhookDelivery::where('event', 'wallet.credited')->first()->payload, 'balance_after'));

        $walletService->debit($customer, 'customer', 100.0, 'DEBIT', null, null, 'Ride payment', Str::uuid()->toString());

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'wallet.debited']);
    }

    public function test_partner_accepting_dispatch_dispatches_delivery_assigned(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500005', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9876500005', 'user_type' => 'vendor', 'is_active' => true]);
        $partner = User::create(['name' => 'Rider', 'phone' => '9000000005', 'user_type' => 'delivery_partner', 'is_active' => true]);
        $partner->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        $deliveryPartner = DeliveryPartner::create([
            'user_id' => $partner->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
            'last_location_at' => now(),
        ]);

        $order = $this->makeOrder($customer, $merchant, 'ORD_ASGN_1');

        $dispatchLog = DispatchLog::create([
            'dispatch_type' => 'delivery',
            'order_id' => $order->id,
            'candidate_id' => $deliveryPartner->id,
            'candidate_type' => 'delivery_partner',
            'status' => 'pending',
        ]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['delivery.assigned'],
            'status' => true,
        ]);

        Sanctum::actingAs($partner, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$dispatchLog->id}/accept", [])
            ->assertOk();

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'delivery.assigned']);
        $delivery = WebhookDelivery::where('event', 'delivery.assigned')->first();
        $this->assertSame($deliveryPartner->id, data_get($delivery->payload, 'delivery_partner_id'));
        $this->assertSame('PARTNER_ASSIGNED', data_get($delivery->payload, 'status'));
    }

    public function test_creating_ride_dispatches_ride_requested(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500006', 'user_type' => 'customer', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $customer->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['ride.requested'],
            'status' => true,
        ]);

        $vehicleType = VehicleType::create(['name' => 'Bike', 'code' => 'BIKE', 'capacity' => 1]);

        FareRule::create([
            'vehicle_type_id' => $vehicleType->id,
            'base_fare' => 30,
            'per_km' => 12,
            'per_minute' => 1,
            'minimum_fare' => 30,
            'booking_fee' => 5,
            'platform_fee' => 2,
            'tax_rate' => 5,
            'is_active' => true,
        ]);

        $ride = app(RideService::class)->createRide($customer, [
            'vehicle_type_id' => $vehicleType->id,
            'pickup_latitude' => 12.9716,
            'pickup_longitude' => 77.5946,
            'destination_latitude' => 12.9352,
            'destination_longitude' => 77.6245,
            'payment_method' => 'cash',
        ]);

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'ride.requested']);
        $delivery = WebhookDelivery::where('event', 'ride.requested')->first();
        $this->assertSame($ride->id, data_get($delivery->payload, 'id'));
        $this->assertSame('REQUESTING', data_get($delivery->payload, 'status'));
    }

    public function test_driver_completing_trip_dispatches_ride_completed(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500007', 'user_type' => 'customer', 'is_active' => true]);
        $driverUser = User::create(['name' => 'Driver', 'phone' => '9000000007', 'user_type' => 'driver', 'is_active' => true]);
        $driverUser->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));

        $vehicleType = VehicleType::create(['name' => 'Bike', 'code' => 'BIKE_2', 'capacity' => 1]);

        $driver = Driver::create([
            'user_id' => $driverUser->id,
            'vehicle_type_id' => $vehicleType->id,
            'status' => 'approved',
            'is_verified' => true,
        ]);

        WebhookSubscription::create([
            'user_id' => $customer->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['ride.completed'],
            'status' => true,
        ]);

        $ride = Ride::create([
            'ride_number' => 'RIDE_TEST_1',
            'user_id' => $customer->id,
            'driver_id' => $driver->id,
            'vehicle_type_id' => $vehicleType->id,
            'status' => 'IN_PROGRESS',
            'pickup_latitude' => 12.9716,
            'pickup_longitude' => 77.5946,
            'destination_latitude' => 12.9352,
            'destination_longitude' => 77.6245,
            'distance_km' => 5.0,
            'estimated_fare' => 120.0,
            'payment_method' => 'online',
            'payment_status' => 'PAID',
            'otp_verified' => true,
            'otp_verified_at' => now(),
        ]);

        Sanctum::actingAs($driverUser, ['*']);

        $this->postJson("/api/v1/driver/trips/{$ride->id}/status", ['status' => 'completed'])
            ->assertOk();

        $this->assertDatabaseHas('webhook_deliveries', ['event' => 'ride.completed']);
        $delivery = WebhookDelivery::where('event', 'ride.completed')->first();
        $this->assertSame('COMPLETED', data_get($delivery->payload, 'status'));
        $this->assertSame(1, $driver->fresh()->total_trips);
    }

    public function test_delivery_is_signed_with_hmac_using_subscription_secret(): void
    {
        $captured = null;

        Http::fake(function ($request) use (&$captured) {
            $captured = $request;

            return Http::response('ok', 200);
        });

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500011', 'user_type' => 'customer', 'is_active' => true]);
        $merchant = User::create(['name' => 'Merchant', 'phone' => '9876500011', 'user_type' => 'vendor', 'is_active' => true]);

        WebhookSubscription::create([
            'user_id' => $merchant->id,
            'target_url' => 'https://merchant.example.com/hook',
            'events' => ['order.created'],
            'status' => true,
            'secret' => 's3cret',
        ]);

        $order = $this->makeOrder($customer, $merchant, 'ORD_SIG_1');

        app(WebhookNotifier::class)->orderCreated($order);

        $this->assertNotNull($captured);
        $event = $captured->header('X-SuperApp-Event')[0] ?? null;
        $signature = $captured->header('X-SuperApp-Signature')[0] ?? null;

        $this->assertSame('order.created', $event);
        $this->assertSame(hash_hmac('sha256', $captured->body(), 's3cret'), $signature);

        $this->assertSame('delivered', WebhookDelivery::where('event', 'order.created')->first()->status);
    }

    public function test_order_events_are_scoped_to_owning_vendor_only(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500008', 'user_type' => 'customer', 'is_active' => true]);
        $merchantA = User::create(['name' => 'Merchant A', 'phone' => '9876500008', 'user_type' => 'vendor', 'is_active' => true]);
        $merchantB = User::create(['name' => 'Merchant B', 'phone' => '9876500009', 'user_type' => 'vendor', 'is_active' => true]);

        $vendorA = Vendor::create([
            'user_id' => $merchantA->id,
            'business_name' => 'Shop A',
            'vendor_type' => 'restaurant',
            'owner_name' => $merchantA->name,
            'phone' => $merchantA->phone,
            'status' => 'approved',
        ]);
        $vendorB = Vendor::create([
            'user_id' => $merchantB->id,
            'business_name' => 'Shop B',
            'vendor_type' => 'restaurant',
            'owner_name' => $merchantB->name,
            'phone' => $merchantB->phone,
            'status' => 'approved',
        ]);

        WebhookSubscription::create([
            'user_id' => $merchantA->id,
            'target_url' => 'https://a.example.com/hook',
            'events' => ['order.created'],
            'status' => true,
        ]);
        WebhookSubscription::create([
            'user_id' => $merchantB->id,
            'target_url' => 'https://b.example.com/hook',
            'events' => ['order.created'],
            'status' => true,
        ]);

        $order = Order::create([
            'order_number' => 'ORD_SCOPE_1',
            'user_id' => $customer->id,
            'vendor_id' => $vendorA->id,
            'order_type' => 'food',
            'status' => 'PENDING',
            'payment_status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'total_amount' => 100.0,
        ]);

        app(WebhookNotifier::class)->orderCreated($order);

        $this->assertDatabaseHas('webhook_deliveries', ['url' => 'https://a.example.com/hook', 'event' => 'order.created']);
        $this->assertDatabaseMissing('webhook_deliveries', ['url' => 'https://b.example.com/hook', 'event' => 'order.created']);
    }

    public function test_ride_events_are_scoped_to_ride_owners_only(): void
    {
        Http::fake();

        $customer = User::create(['name' => 'Customer', 'phone' => '1234500009', 'user_type' => 'customer', 'is_active' => true]);
        $other = User::create(['name' => 'Bystander', 'phone' => '1234500010', 'user_type' => 'customer', 'is_active' => true]);

        $vehicleType = VehicleType::create(['name' => 'Bike', 'code' => 'BIKE_3', 'capacity' => 1]);

        WebhookSubscription::create([
            'user_id' => $customer->id,
            'target_url' => 'https://customer.example.com/hook',
            'events' => ['ride.requested'],
            'status' => true,
        ]);
        WebhookSubscription::create([
            'user_id' => $other->id,
            'target_url' => 'https://other.example.com/hook',
            'events' => ['ride.requested'],
            'status' => true,
        ]);

        FareRule::create([
            'vehicle_type_id' => $vehicleType->id,
            'base_fare' => 30,
            'per_km' => 12,
            'per_minute' => 1,
            'minimum_fare' => 30,
            'booking_fee' => 5,
            'platform_fee' => 2,
            'tax_rate' => 5,
            'is_active' => true,
        ]);

        app(RideService::class)->createRide($customer, [
            'vehicle_type_id' => $vehicleType->id,
            'pickup_latitude' => 12.9716,
            'pickup_longitude' => 77.5946,
            'destination_latitude' => 12.9352,
            'destination_longitude' => 77.6245,
            'payment_method' => 'cash',
        ]);

        $this->assertDatabaseHas('webhook_deliveries', ['url' => 'https://customer.example.com/hook', 'event' => 'ride.requested']);
        $this->assertDatabaseMissing('webhook_deliveries', ['url' => 'https://other.example.com/hook', 'event' => 'ride.requested']);
    }
}
