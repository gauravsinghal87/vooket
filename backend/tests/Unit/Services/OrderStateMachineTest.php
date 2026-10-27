<?php

namespace Tests\Unit\Services;

use App\Exceptions\InvalidOrderTransitionException;
use App\Models\Order;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Services\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class OrderStateMachineTest extends TestCase
{
    use RefreshDatabase;

    public function test_food_order_moves_through_the_full_chain(): void
    {
        $order = $this->makeOrder('food', 'PENDING');

        foreach (['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED'] as $target) {
            OrderStateMachine::assertCanTransition($order, $target);
            $order->update(['status' => $target]);
        }

        $this->assertSame('DELIVERED', $order->fresh()->status);
    }

    public function test_grocery_order_moves_through_picking_and_packed_chain(): void
    {
        $order = $this->makeOrder('grocery', 'PENDING');

        foreach (['PLACED', 'CONFIRMED', 'PICKING', 'PACKED', 'READY', 'PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'] as $target) {
            OrderStateMachine::assertCanTransition($order, $target);
            $order->update(['status' => $target]);
        }

        $this->assertSame('DELIVERED', $order->fresh()->status);
    }

    public function test_grocery_allows_processing_then_packed_step(): void
    {
        $order = $this->makeOrder('grocery', 'PENDING');

        foreach (['PLACED', 'PROCESSING', 'PACKED', 'READY'] as $target) {
            OrderStateMachine::assertCanTransition($order, $target);
            $order->update(['status' => $target]);
        }

        $this->assertSame('READY', $order->fresh()->status);
    }

    public function test_returns_false_for_illegal_food_jump_from_preparing_to_delivered(): void
    {
        $order = $this->makeOrder('food', 'PREPARING');

        $this->assertFalse(OrderStateMachine::canTransition($order, 'DELIVERED'));
    }

    public function test_returns_false_for_grocery_only_status_on_food_order(): void
    {
        $order = $this->makeOrder('food', 'CONFIRMED');

        $this->assertFalse(OrderStateMachine::canTransition($order, 'PICKING'));
        $this->assertFalse(OrderStateMachine::canTransition($order, 'PACKED'));
    }

    public function test_assert_can_transition_rejects_illegal_move_and_reports_statuses(): void
    {
        $order = $this->makeOrder('food', 'PREPARING');

        try {
            OrderStateMachine::assertCanTransition($order, 'DELIVERED');
            $this->fail('Expected InvalidOrderTransitionException');
        } catch (InvalidOrderTransitionException $e) {
            $this->assertSame('PREPARING', $e->currentStatus);
            $this->assertSame('DELIVERED', $e->targetStatus);
            $this->assertSame($order->id, $e->orderId);
            $this->assertStringContainsString($order->order_number, $e->getMessage());
        }
    }

    public function test_delivered_and_cancelled_are_terminal(): void
    {
        $delivered = $this->makeOrder('food', 'DELIVERED');
        $cancelled = $this->makeOrder('food', 'CANCELLED');

        $this->assertFalse(OrderStateMachine::canTransition($delivered, 'CANCELLED'));
        $this->assertFalse(OrderStateMachine::canTransition($delivered, 'ARRIVED'));
        $this->assertFalse(OrderStateMachine::canTransition($cancelled, 'PLACED'));
        $this->assertFalse(OrderStateMachine::canTransition($cancelled, 'DELIVERED'));
    }

    #[DataProvider('preDeliveryFoodStatuses')]
    public function test_cancel_is_legal_from_each_pre_delivery_food_status(string $status): void
    {
        $order = $this->makeOrder('food', $status);

        $this->assertTrue(OrderStateMachine::canTransition($order, 'CANCELLED'));
    }

    #[DataProvider('preDeliveryGroceryStatuses')]
    public function test_cancel_is_legal_from_each_pre_delivery_grocery_status(string $status): void
    {
        $order = $this->makeOrder('grocery', $status);

        $this->assertTrue(OrderStateMachine::canTransition($order, 'CANCELLED'));
    }

    #[DataProvider('dispatchStatuses')]
    public function test_cancel_is_rejected_once_dispatch_has_started(string $status): void
    {
        $order = $this->makeOrder('food', $status);

        $this->assertFalse(OrderStateMachine::canTransition($order, 'CANCELLED'));
    }

    public static function preDeliveryFoodStatuses(): array
    {
        return [
            'pending' => ['PENDING'],
            'placed' => ['PLACED'],
            'accepted' => ['ACCEPTED'],
            'confirmed' => ['CONFIRMED'],
            'preparing' => ['PREPARING'],
            'ready' => ['READY'],
        ];
    }

    public static function preDeliveryGroceryStatuses(): array
    {
        return [
            'pending' => ['PENDING'],
            'placed' => ['PLACED'],
            'accepted' => ['ACCEPTED'],
            'confirmed' => ['CONFIRMED'],
            'picking' => ['PICKING'],
            'processing' => ['PROCESSING'],
            'packed' => ['PACKED'],
            'ready' => ['READY'],
        ];
    }

    public static function dispatchStatuses(): array
    {
        return [
            'partner_assigned' => ['PARTNER_ASSIGNED'],
            'picked_up' => ['PICKED_UP'],
            'out_for_delivery' => ['OUT_FOR_DELIVERY'],
            'arrived' => ['ARRIVED'],
        ];
    }

    private function makeOrder(string $orderType, string $status): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'State Machine Kitchen',
            'owner_name' => 'S M',
            'phone' => '9876543210',
            'vendor_type' => $orderType === 'grocery' ? 'grocery' : 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => $status,
            'payment_status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 100,
            'delivery_fee' => 20,
            'total_amount' => 120,
        ]);
    }
}
