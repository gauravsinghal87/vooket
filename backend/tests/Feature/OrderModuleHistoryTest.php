<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Ride;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class OrderModuleHistoryTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = $this->makeCustomer('module-history@example.com', '9100700001');
    }

    private function makeCustomer(string $email, string $phone): User
    {
        return User::create([
            'name' => 'Module History Tester',
            'email' => $email,
            'phone' => $phone,
            'password' => Hash::make('secret'),
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function authHeaders(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    private function makeOrder(User $user, string $orderType, string $status = 'DELIVERED'): Order
    {
        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $user->id,
            'order_type' => $orderType,
            'status' => $status,
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);
    }

    private function makeRide(User $user, string $status = 'COMPLETED'): Ride
    {
        return Ride::create([
            'ride_number' => 'RD_'.Str::upper(Str::random(8)),
            'user_id' => $user->id,
            'status' => $status,
            'pickup_address' => '12 MG Road',
            'pickup_latitude' => 26.9124,
            'pickup_longitude' => 75.7873,
            'destination_address' => 'Airport Road',
            'destination_latitude' => 26.9490,
            'destination_longitude' => 75.8017,
            'estimated_fare' => 275,
        ]);
    }

    public function test_food_history_returns_only_food_orders(): void
    {
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'grocery');
        $this->makeRide($this->user);

        $response = $this->getJson('/api/v1/orders?module=food', $this->authHeaders($this->user));

        $response->assertOk()->assertJsonPath('success', true);
        $rows = $response->json('data.data');
        $this->assertCount(2, $rows);
        $this->assertSame(['food', 'food'], array_column($rows, 'order_type'));
    }

    public function test_grocery_history_returns_only_grocery_orders(): void
    {
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'grocery');
        $this->makeOrder($this->user, 'grocery');
        $this->makeRide($this->user);

        $response = $this->getJson('/api/v1/orders?module=grocery', $this->authHeaders($this->user));

        $response->assertOk()->assertJsonPath('success', true);
        $rows = $response->json('data.data');
        $this->assertCount(2, $rows);
        $this->assertSame(['grocery', 'grocery'], array_column($rows, 'order_type'));
    }

    public function test_ride_history_returns_only_ride_bookings(): void
    {
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'grocery');
        $rideA = $this->makeRide($this->user);
        $rideB = $this->makeRide($this->user, 'CANCELLED');

        $response = $this->getJson('/api/v1/orders?module=rides', $this->authHeaders($this->user));

        $response->assertOk()->assertJsonPath('success', true);

        $rows = $response->json('data.data');
        $this->assertCount(2, $rows);
        $this->assertEqualsCanonicalizing(
            [$rideA->ride_number, $rideB->ride_number],
            array_column($rows, 'ride_number')
        );

        // Rides come from the rides table, so no order-shaped record leaks in.
        foreach ($rows as $row) {
            $this->assertArrayNotHasKey('order_number', $row);
            $this->assertArrayNotHasKey('order_type', $row);
            $this->assertArrayHasKey('status', $row);
        }
    }

    public function test_history_never_returns_another_customers_records(): void
    {
        $other = $this->makeCustomer('module-history-other@example.com', '9100700002');
        $this->makeOrder($other, 'food');
        $this->makeRide($other);

        $mineOrder = $this->makeOrder($this->user, 'food');
        $mineRide = $this->makeRide($this->user);

        $orders = $this->getJson('/api/v1/orders?module=food', $this->authHeaders($this->user));
        $orders->assertOk();
        $this->assertSame(
            [$mineOrder->order_number],
            array_column($orders->json('data.data'), 'order_number')
        );

        $rides = $this->getJson('/api/v1/orders?module=rides', $this->authHeaders($this->user));
        $rides->assertOk();
        $this->assertSame(
            [$mineRide->ride_number],
            array_column($rides->json('data.data'), 'ride_number')
        );
    }

    public function test_invalid_module_value_returns_standard_validation_error(): void
    {
        $response = $this->getJson('/api/v1/orders?module=aircraft', $this->authHeaders($this->user));

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Validation failed')
            ->assertJsonStructure(['errors' => ['module']]);

        // The legacy filter is validated the same way, so it can no longer be
        // used to silently request a module that does not exist.
        $legacy = $this->getJson('/api/v1/orders?order_type=pharmacy', $this->authHeaders($this->user));

        $legacy->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['errors' => ['order_type']]);
    }

    public function test_unauthenticated_history_request_is_rejected(): void
    {
        $this->makeOrder($this->user, 'food');

        $this->getJson('/api/v1/orders?module=food')->assertUnauthorized();
    }

    public function test_history_paginates_and_keeps_status_fields(): void
    {
        for ($i = 0; $i < 7; $i++) {
            $this->makeOrder($this->user, 'food', $i % 2 === 0 ? 'DELIVERED' : 'CANCELLED');
        }

        $first = $this->getJson('/api/v1/orders?module=food&per_page=5', $this->authHeaders($this->user));

        $first->assertOk();
        $this->assertCount(5, $first->json('data.data'));
        $this->assertSame(1, $first->json('data.current_page'));
        $this->assertSame(2, $first->json('data.last_page'));
        $this->assertSame(7, $first->json('data.total'));

        foreach ($first->json('data.data') as $row) {
            $this->assertArrayHasKey('status', $row);
            $this->assertSame('food', $row['order_type']);
        }

        $second = $this->getJson('/api/v1/orders?module=food&per_page=5&page=2', $this->authHeaders($this->user));

        $second->assertOk();
        $this->assertCount(2, $second->json('data.data'));
        $this->assertSame(2, $second->json('data.current_page'));

        $ids = array_merge(
            array_column($first->json('data.data'), 'id'),
            array_column($second->json('data.data'), 'id')
        );
        $this->assertCount(7, array_unique($ids));
    }

    public function test_legacy_order_type_filter_still_returns_that_modules_orders(): void
    {
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'grocery');

        $response = $this->getJson('/api/v1/orders?order_type=grocery', $this->authHeaders($this->user));

        $response->assertOk();
        $this->assertCount(1, $response->json('data.data'));
        $this->assertSame('grocery', $response->json('data.data.0.order_type'));
    }

    public function test_request_without_module_keeps_returning_every_order(): void
    {
        $this->makeOrder($this->user, 'food');
        $this->makeOrder($this->user, 'grocery');

        $response = $this->getJson('/api/v1/orders', $this->authHeaders($this->user));

        $response->assertOk();
        $this->assertCount(2, $response->json('data.data'));
    }
}
