<?php

namespace Tests\Feature;

use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\AppSetting;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\FareRule;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class RidePaymentFlowTest extends TestCase
{
    use RefreshDatabase;

    private const PICKUP = ['lat' => 26.9124, 'lng' => 75.7873];

    private const DESTINATION = ['lat' => 26.949, 'lng' => 75.8017];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        AppSetting::create([
            'group' => 'commission',
            'key' => 'ride_commission',
            'label' => 'Ride Commission %',
            'value' => '15',
            'type' => 'number',
        ]);

        config(['integrations.mode' => 'mock']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => null]);
        config(['integrations.credentials.maps.browser_key' => null]);
        config(['ride.offer_timeout_seconds' => 45]);
        config(['ride.max_radius_km' => 10]);
        config(['ride.max_candidates' => 8]);
        config(['ride.location_freshness_minutes' => null]);
    }

    public function test_cash_collection_records_the_remaining_fare_on_the_ride(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'driver_arrived');

        $res = $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']));

        $res->assertOk()->assertJsonPath('data.payment.amount', (float) $ride->estimated_fare);

        $fresh = Ride::find($rideId);
        $this->assertTrue($fresh->cash_collected);
        $this->assertSame((float) $fresh->estimated_fare, (float) $fresh->cash_collected_amount);
        $this->assertNotNull($fresh->cash_collected_at);
        $this->assertSame('cash', $fresh->cash_collected_via);
        $this->assertSame(Ride::PAYMENT_METHOD_CASH, $fresh->payment_method);
        $this->assertSame(Ride::PAYMENT_STATUS_PAID, $fresh->payment_status);
    }

    public function test_cash_settlement_debits_the_driver_wallet_and_marks_settled(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'driver_arrived', 500);
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();

        $res = $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']));

        $res->assertOk()
            ->assertJsonPath('data.settled', true)
            ->assertJsonPath('data.payment.settlement', 'settled')
            ->assertJsonPath('data.payment.amount', (float) $ride->estimated_fare);

        $fresh = Ride::find($rideId);
        $this->assertTrue($fresh->cash_settled);
        $this->assertNotNull($fresh->cash_settled_at);
        $this->assertSame(500.0 - (float) $ride->estimated_fare, (float) Wallet::where('user_id', $driver['user']->id)->first()->balance);

        $transaction = WalletTransaction::where('user_id', $driver['user']->id)->where('type', 'SETTLEMENT')->where('direction', 'debit')->firstOrFail();
        $this->assertSame((float) $ride->estimated_fare, (float) $transaction->amount);
        $this->assertSame('ride-cash-settlement:'.$fresh->ride_number, $transaction->idempotency_key);
    }

    public function test_completed_cash_ride_is_rejected_until_cash_is_settled(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'in_progress', 500);

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Ride payment must be completed before the ride can be marked as completed.');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Ride payment must be completed before the ride can be marked as completed.');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))->assertOk();

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.status', Ride::STATUS_COMPLETED);

        $fresh = Ride::find($rideId);
        $this->assertSame(Ride::PAYMENT_STATUS_PAID, $fresh->payment_status);
        $this->assertSame((string) $fresh->estimated_fare, (string) $fresh->final_fare);
        $this->assertSame(1, DriverEarning::where('ride_id', $rideId)->count());
    }

    public function test_cash_collection_is_rejected_when_the_fare_is_already_paid_online(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('online', 'driver_arrived');
        $this->payOnline($user, $rideId);

        $this->assertSame('paid', Ride::find($rideId)->payment_status);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'No cash to collect for this ride');
    }

    public function test_cash_settlement_is_rejected_before_cash_is_collected(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Cash must be collected before it can be settled');
    }

    public function test_cash_collection_returns_404_for_a_ride_assigned_to_another_driver(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived');
        $intruder = $this->driverNear($this->vehicleTypeWithFare());

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($intruder['user']))
            ->assertNotFound();

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($intruder['user']))
            ->assertNotFound();
    }

    public function test_cash_collection_is_rejected_outside_the_in_progress_window(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_assigned');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Cash can only be collected while the ride is in progress');
    }

    public function test_cash_settlement_surfaces_shortfall_and_resolves_after_wallet_topup(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'driver_arrived');
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();

        $res = $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']));

        $res->assertOk()
            ->assertJsonPath('data.settled', false)
            ->assertJsonPath('data.payment.settlement', 'pending')
            ->assertJsonPath('data.payment.shortfall', (float) $ride->estimated_fare);
        $this->assertFalse(Ride::find($rideId)->cash_settled);
        $this->assertSame(0, WalletTransaction::where('user_id', $driver['user']->id)->where('type', 'SETTLEMENT')->count());

        $this->topUpDriverWallet($driver['user'], (float) $ride->estimated_fare, 'driver-topup:'.$rideId);

        $this->assertSame(0, WalletTransaction::where('user_id', $driver['user']->id)->where('type', 'SETTLEMENT')->count());

        $this->assertSame((float) $ride->estimated_fare, (float) app(WalletService::class)->getBalance($driver['user'], 'driver'));

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.settled', true);

        $fresh = Ride::find($rideId);
        $this->assertTrue($fresh->cash_settled);
        $this->assertSame(0.0, (float) Wallet::where('user_id', $driver['user']->id)->first()->balance);
    }

    public function test_cash_collection_is_idempotent(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'driver_arrived');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();
        $first = Ride::find($rideId);
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.payment.amount', (float) $ride->estimated_fare);

        $second = Ride::find($rideId);
        $this->assertSame((string) $first->cash_collected_amount, (string) $second->cash_collected_amount);
        $this->assertSame($first->cash_collected_at->format('U'), $second->cash_collected_at->format('U'));
    }

    public function test_cash_settlement_is_idempotent_and_creates_one_debit(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived', 500);
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.settled', true);
        $first = Ride::find($rideId);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.settled', true);
        $second = Ride::find($rideId);

        $this->assertSame($first->cash_settled_at->format('U'), $second->cash_settled_at->format('U'));
        $this->assertSame(1, WalletTransaction::where('user_id', $driver['user']->id)->where('type', 'SETTLEMENT')->where('direction', 'debit')->count());
    }

    public function test_partial_online_payment_leaves_the_remaining_fare_for_cash_collection(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('online', 'driver_arrived');
        $this->payOnline($user, $rideId);

        $ride->update(['estimated_fare' => $ride->estimated_fare + 50]);
        $ride->refresh();

        $res = $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']));

        $res->assertOk()->assertJsonPath('data.payment.amount', 50);
        $this->assertSame(50.0, (float) Ride::find($rideId)->cash_collected_amount);
    }

    public function test_customer_role_cannot_collect_or_settle_cash_for_a_ride(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived');

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($user))
            ->assertForbidden();

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($user))
            ->assertForbidden();
    }

    public function test_driver_wallet_topup_credits_balance_through_the_payment_flow(): void
    {
        $user = $this->driverNear($this->vehicleTypeWithFare())['user'];

        $this->postJson('/api/v1/driver/wallet/topup', [
            'amount' => 250,
            'payment_method' => 'upi',
            'idempotency_key' => 'driver-topup:test-1',
        ], $this->headers($user))->assertStatus(201);

        $this->assertSame(0.0, (float) app(WalletService::class)->getBalance($user, 'driver'));

        $this->topUpDriverWallet($user, 250.0, 'driver-topup:test-1');

        $this->assertSame(250.0, (float) app(WalletService::class)->getBalance($user, 'driver'));
    }

    public function test_starting_a_trip_requires_a_verified_otp(): void
    {
        [, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived');

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'in_progress'], $this->headers($driver['user']))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Ride start OTP must be verified before starting the trip');

        $this->assertSame('DRIVER_ARRIVED', Ride::find($rideId)->status);
    }

    public function test_completing_a_ride_requires_a_verified_otp(): void
    {
        [, $driver, $rideId] = $this->assignedRide('cash', 'in_progress');
        Ride::where('id', $rideId)->update(['otp_verified' => false, 'otp_verified_at' => null]);

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))
            ->assertStatus(400)
            ->assertJsonPath('message', 'Ride start OTP must be verified before the ride can be completed.');

        $this->assertSame('IN_PROGRESS', Ride::find($rideId)->status);
    }

    public function test_active_trip_exposes_the_authoritative_payment_state(): void
    {
        [, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived', 500);
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();

        $this->getJson('/api/v1/driver/trips/active', $this->headers($driver['user']))
            ->assertOk()
            ->assertJsonPath('data.id', $rideId)
            ->assertJsonPath('data.payment.payment_method', 'cash')
            ->assertJsonPath('data.payment.payment_status', 'PAID')
            ->assertJsonPath('data.payment.settlement', 'pending');
    }

    private function driverUser(): User
    {
        $user = User::factory()->create(['user_type' => 'driver']);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));

        return $user;
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    private function vehicleTypeWithFare(): VehicleType
    {
        $suffix = substr((string) uniqid(), -6);

        $vt = VehicleType::create([
            'name' => 'Cab Mini '.$suffix,
            'code' => 'cab_mini_'.$suffix,
            'icon' => 'vehicle-cab',
            'description' => 'Compact hatchback',
            'capacity' => 4,
            'ac' => true,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        FareRule::create([
            'vehicle_type_id' => $vt->id,
            'base_fare' => 80,
            'per_km' => 15,
            'per_minute' => 2,
            'minimum_fare' => 80,
            'booking_fee' => 15,
            'platform_fee' => 10,
            'tax_rate' => 5,
            'surge_multiplier_max' => 2.00,
            'waiting_charge_per_min' => 2,
            'cancellation_fee' => 25,
            'driver_earn_percentage' => 75,
            'is_active' => true,
        ]);

        return $vt->fresh();
    }

    private function driverNear(VehicleType $vt, array $overrides = []): array
    {
        $user = $this->driverUser();
        $driver = Driver::create(array_merge([
            'user_id' => $user->id,
            'vehicle_type_id' => $vt->id,
            'status' => 'approved',
            'vehicle_number' => 'RJ14PD1234',
            'vehicle_model' => 'Maruti Alto',
            'vehicle_color' => 'White',
            'license_number' => 'RJ14201801234',
            'license_expiry' => now()->addYears(3),
            'is_online' => true,
            'is_busy' => false,
            'is_verified' => true,
            'latitude' => 26.9124,
            'longitude' => 75.7873,
            'last_location_at' => now(),
            'rating' => 4.5,
        ], $overrides));

        return ['user' => $user, 'driver' => $driver];
    }

    /**
     * Book a ride, accept it, and advance it to the requested stage while
     * funding the assigned driver wallet for settle tests.
     *
     * @return array{0: User, 1: array{user: User, driver: Driver}, 2: int, 3: Ride}
     */
    private function assignedRide(string $paymentMethod, string $stage, float $driverBalance = 0.0): array
    {
        $vt = $this->vehicleTypeWithFare();
        $driver = $this->driverNear($vt);
        $user = User::factory()->create(['user_type' => 'customer']);

        if ($driverBalance > 0) {
            app(WalletService::class)->credit($driver['user'], 'driver', $driverBalance, 'CREDIT', null, null, 'Test funding');
        }

        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'payment_method' => $paymentMethod,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $ride = Ride::find($rideId);

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($driver['user']))->assertOk();

        if (in_array($stage, ['arriving', 'driver_arrived', 'in_progress'], true)) {
            $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'arriving'], $this->headers($driver['user']))->assertOk();
        }

        if (in_array($stage, ['driver_arrived', 'in_progress'], true)) {
            $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'arrived'], $this->headers($driver['user']))->assertOk();
        }

        if ($stage === 'in_progress') {
            $this->postJson('/api/v1/rides/'.$rideId.'/verify-otp', ['otp' => $ride->otp], $this->headers($user))->assertOk();
        }

        return [$user, $driver, (int) $rideId, Ride::find($rideId)];
    }

    private function topUpDriverWallet(User $user, float $amount, string $idempotencyKey): void
    {
        $initiate = $this->postJson('/api/v1/driver/wallet/topup', [
            'amount' => $amount,
            'payment_method' => 'upi',
            'idempotency_key' => $idempotencyKey,
        ], $this->headers($user))->assertStatus(201);

        $providerOrderId = $initiate->json('data.provider_order_id');

        $this->postJson('/api/v1/driver/wallet/verify-topup', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($providerOrderId),
            'signature' => 'mock',
        ], $this->headers($user))->assertOk();
    }

    private function payOnline(User $user, int $rideId): void
    {
        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'ride',
            'payable_id' => $rideId,
            'payment_method' => 'card',
            'idempotency_key' => 'ride:online:'.$rideId,
        ], $this->headers($user))->assertStatus(201);

        $providerOrderId = $initiate->json('data.provider_order_id');

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($providerOrderId),
            'signature' => 'mock',
        ], $this->headers($user))->assertOk();
    }
}
