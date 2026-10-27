<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Commission;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\FareRule;
use App\Models\JournalEntry;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use App\Services\WithdrawalService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class RideFinanceSettlementTest extends TestCase
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
        config(['partner_payout.min_wallet_balance' => '0']);

        AppSetting::updateOrCreate(
            ['group' => 'partner_payout', 'key' => 'partner_min_wallet_balance'],
            ['label' => 'Partner Min Wallet Balance', 'value' => '0', 'type' => 'number']
        );
    }

    public function test_wallet_ride_cancellation_charges_the_configured_fee_to_the_wallet(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('wallet', 'driver_arrived');

        app(WalletService::class)->credit($user, 'customer', 500, 'TOP_UP', null, null, 'Wallet top-up');

        $this->postJson("/api/v1/rides/{$rideId}/cancel", ['reason' => 'Changed plans'], $this->headers($user))
            ->assertOk();

        $ride = Ride::find($rideId);

        $this->assertSame(25.0, (float) $ride->meta['cancellation']['fee']);
        $this->assertTrue($ride->meta['cancellation']['collected']);
        $this->assertFalse($ride->meta['cancellation']['deferred']);

        $this->assertSame(475.0, (float) Wallet::where('user_id', $user->id)->first()->balance);

        $tx = WalletTransaction::where('user_id', $user->id)
            ->where('direction', 'debit')
            ->where('idempotency_key', 'ride-cancellation-fee:'.$ride->ride_number)
            ->firstOrFail();
        $this->assertSame(25.0, (float) $tx->amount);

        $this->assertDatabaseHas('journal_entries', [
            'idempotency_key' => 'ride:cancellation-fee:'.$ride->ride_number,
        ]);
    }

    public function test_cash_ride_cancellation_records_a_deferred_fee_without_moving_money(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'driver_arrived');

        $this->postJson("/api/v1/rides/{$rideId}/cancel", ['reason' => 'Changed plans'], $this->headers($user))
            ->assertOk();

        $ride = Ride::find($rideId);

        $this->assertSame(25.0, (float) $ride->meta['cancellation']['fee']);
        $this->assertFalse($ride->meta['cancellation']['collected']);
        $this->assertTrue($ride->meta['cancellation']['deferred']);

        $this->assertSame(0, WalletTransaction::where('user_id', $user->id)->count());
        $this->assertNull(JournalEntry::where('idempotency_key', 'ride:cancellation-fee:'.$ride->ride_number)->first());
    }

    public function test_cancellation_with_no_configured_fee_charges_nothing(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('wallet', 'driver_arrived', cancellationFee: 0);

        app(WalletService::class)->credit($user, 'customer', 500, 'TOP_UP', null, null, 'Wallet top-up');

        $this->postJson("/api/v1/rides/{$rideId}/cancel", ['reason' => 'Changed plans'], $this->headers($user))
            ->assertOk();

        $ride = Ride::find($rideId);

        $this->assertFalse($ride->meta['cancellation']['applied']);
        $this->assertSame(500.0, (float) Wallet::where('user_id', $user->id)->first()->balance);
    }

    public function test_completed_ride_records_a_ride_commission_row_and_journal(): void
    {
        [$user, $driver, $rideId, $ride] = $this->assignedRide('cash', 'in_progress', 500);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))->assertOk();

        $fare = (float) $ride->estimated_fare;
        $expectedCommission = round($fare * 0.15, 2);

        $commission = Commission::where('source_type', 'ride')->where('source_id', $rideId)->firstOrFail();
        $this->assertSame('driver', $commission->party_type);
        $this->assertSame('ride', $commission->service);
        $this->assertSame($expectedCommission, (float) $commission->commission_amount);
        $this->assertSame(1, Commission::where('source_type', 'ride')->where('source_id', $rideId)->count());

        $this->assertDatabaseHas('journal_entries', [
            'idempotency_key' => 'commission:accrued:ride:'.$rideId,
        ]);
    }

    public function test_replaying_completion_does_not_duplicate_the_ride_commission(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'in_progress', 500);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))->assertOk();

        $this->assertSame(1, Commission::where('source_type', 'ride')->where('source_id', $rideId)->count());
        $this->assertSame(1, DriverEarning::where('ride_id', $rideId)->count());
    }

    public function test_successful_driver_payout_marks_pending_earnings_paid(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'in_progress', 500);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))->assertOk();

        $earning = DriverEarning::where('ride_id', $rideId)->firstOrFail();
        $this->assertSame(DriverEarning::STATUS_PENDING, $earning->status);

        $driver['driver']->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);

        $payout = app(WithdrawalService::class)->requestDriverWithdrawal(
            $driver['user'],
            Money::fromMajor($earning->earning_amount)
        );

        app(WithdrawalService::class)->markPayoutSuccess($payout);

        $earning->refresh();
        $this->assertSame(DriverEarning::STATUS_PAID, $earning->status);
        $this->assertSame($payout->id, $earning->meta['settled_by_payout_id']);
    }

    public function test_payout_success_is_idempotent_for_earning_status(): void
    {
        [$user, $driver, $rideId] = $this->assignedRide('cash', 'in_progress', 500);

        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-collect", ['method' => 'cash'], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/rides/{$rideId}/cash-settle", [], $this->headers($driver['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driver['user']))->assertOk();

        $earning = DriverEarning::where('ride_id', $rideId)->firstOrFail();
        $driver['driver']->update(['bank_account_number' => '1234567890', 'bank_ifsc' => 'HDFC0001234']);

        $payout = app(WithdrawalService::class)->requestDriverWithdrawal(
            $driver['user'],
            Money::fromMajor($earning->earning_amount)
        );

        app(WithdrawalService::class)->markPayoutSuccess($payout);
        app(WithdrawalService::class)->markPayoutSuccess($payout->fresh());

        $this->assertSame(1, WalletTransaction::where('user_id', $driver['user']->id)
            ->where('reference_type', 'payout')
            ->count());
        $this->assertSame(DriverEarning::STATUS_PAID, $earning->fresh()->status);
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    private function vehicleTypeWithFare(float $cancellationFee = 25): VehicleType
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
            'cancellation_fee' => $cancellationFee,
            'driver_earn_percentage' => 75,
            'is_active' => true,
        ]);

        return $vt->fresh();
    }

    private function driverNear(VehicleType $vt): array
    {
        $user = User::factory()->create(['user_type' => 'driver']);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));
        $driver = Driver::create([
            'user_id' => $user->id,
            'vehicle_type_id' => $vt->id,
            'status' => 'approved',
            'vehicle_number' => 'RJ14PD'.$this->uniqueDigits(),
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
        ]);

        return ['user' => $user, 'driver' => $driver];
    }

    private function uniqueDigits(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function assignedRide(string $paymentMethod, string $stage, float $driverBalance = 0.0, float $cancellationFee = 25): array
    {
        $vt = $this->vehicleTypeWithFare($cancellationFee);
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
}
