<?php

namespace Tests\Feature;

use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\FareRule;
use App\Models\Ride;
use App\Models\RideRequest;
use App\Models\RideStatusHistory;
use App\Models\Role;
use App\Models\User;
use App\Models\VehicleType;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class AdminFareRuleTest extends TestCase
{
    use RefreshDatabase;

    private const PICKUP = ['lat' => 26.9124, 'lng' => 75.7873];

    private const DESTINATION = ['lat' => 26.949, 'lng' => 75.8017];

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();

        config(['integrations.mode' => 'mock']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => null]);
        config(['integrations.credentials.maps.browser_key' => null]);
        config(['ride.offer_timeout_seconds' => 45]);
        config(['ride.max_radius_km' => 10]);
        config(['ride.max_candidates' => 8]);
        config(['ride.location_freshness_minutes' => null]);

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Fare Admin',
            'email' => 'fare@example.com',
            'phone' => '9888888888',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    private function headers(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('test')->plainTextToken];
    }

    private function authHeaders(): array
    {
        return $this->headers($this->admin);
    }

    private function customer(): User
    {
        return User::factory()->create(['user_type' => 'customer']);
    }

    private function vehicle(string $code = 'cab_mini'): VehicleType
    {
        return VehicleType::factory()->create(['code' => $code, 'name' => ucfirst(str_replace('_', ' ', $code)), 'is_active' => true]);
    }

    private function ruleFor(VehicleType $vt, array $overrides = []): FareRule
    {
        return FareRule::factory()->create(array_merge(['vehicle_type_id' => $vt->id], $overrides));
    }

    private function validRulePayload(VehicleType $vt): array
    {
        return [
            'vehicle_type_id' => $vt->id,
            'base_fare' => 80,
            'per_km' => 15,
            'per_minute' => 2,
            'minimum_fare' => 80,
            'booking_fee' => 15,
            'platform_fee' => 10,
            'tax_rate' => 5,
            'waiting_fee_per_minute' => 2,
            'cancellation_fee' => 25,
            'driver_commission_percent' => 25,
            'is_active' => true,
        ];
    }

    private function estimateBody(): array
    {
        return [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
        ];
    }

    private static function expectedFare(FareRule $rule): float
    {
        $distance = 4.31;
        $duration = max(1, round($distance / 30 * 60));

        $subtotal = (float) $rule->base_fare + round($distance * (float) $rule->per_km, 2)
            + round($duration * (float) $rule->per_minute, 2)
            + (float) $rule->booking_fee + (float) $rule->platform_fee;
        $tax = round($subtotal * (float) $rule->tax_rate / 100, 2);

        return max(round($subtotal + $tax, 2), (float) $rule->minimum_fare);
    }

    /**
     * JSON encodes a whole-number fare without a decimal point (198, not
     * 198.0), so compare numerically rather than by strict type identity.
     */
    private function assertFareEquals(float $expected, TestResponse $res): void
    {
        $this->assertSame($expected, (float) $res->json('data.0.estimated_fare'));
    }

    public function test_admin_can_list_fare_rules_with_vehicle(): void
    {
        $vt = $this->vehicle('cab_mini');
        $this->ruleFor($vt, ['per_km' => 15]);

        $res = $this->getJson('/api/v1/admin/fare-rules', $this->authHeaders());

        $res->assertOk()
            ->assertJsonPath('data.0.vehicle_type_id', $vt->id)
            ->assertJsonPath('data.0.vehicle_type.name', $vt->name)
            ->assertJsonPath('data.0.driver_commission_percent', 25);
    }

    public function test_admin_can_view_a_single_fare_rule(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt);

        $this->getJson("/api/v1/admin/fare-rules/{$rule->id}", $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.id', $rule->id)
            ->assertJsonPath('data.base_fare', number_format((float) $rule->base_fare, 2, '.', ''));
    }

    public function test_admin_can_create_fare_rule(): void
    {
        $vt = $this->vehicle('cab_sedan');

        $res = $this->postJson('/api/v1/admin/fare-rules', $this->validRulePayload($vt), $this->authHeaders());

        $res->assertCreated()->assertJsonPath('success', true);

        $this->assertDatabaseHas('fare_rules', [
            'vehicle_type_id' => $vt->id,
            'base_fare' => '80.00',
            'per_km' => '15.00',
            'waiting_charge_per_min' => '2.00',
            'driver_earn_percentage' => '75.00',
            'is_active' => true,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => FareRule::class,
            'action' => 'created',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_admin_can_update_fare_rule(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt, ['per_km' => 15, 'per_minute' => 2]);

        $res = $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", [
            'per_km' => 40,
            'per_minute' => 3,
        ], $this->authHeaders());

        $res->assertOk()->assertJsonPath('data.per_km', '40.00');

        $this->assertDatabaseHas('fare_rules', ['id' => $rule->id, 'per_km' => '40.00', 'per_minute' => '3.00']);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => FareRule::class,
            'entity_id' => $rule->id,
            'action' => 'updated',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_admin_can_enable_and_disable_fare_rule(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt, ['is_active' => true]);

        $this->postJson("/api/v1/admin/fare-rules/{$rule->id}/toggle", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => FareRule::class,
            'entity_id' => $rule->id,
            'action' => 'fare_rule_toggled',
            'user_id' => $this->admin->id,
        ]);

        $this->postJson("/api/v1/admin/fare-rules/{$rule->id}/toggle", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_admin_can_delete_fare_rule(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt);

        $this->deleteJson("/api/v1/admin/fare-rules/{$rule->id}", [], $this->authHeaders())
            ->assertOk();

        $this->assertDatabaseMissing('fare_rules', ['id' => $rule->id]);
        $this->assertDatabaseHas('audit_logs', [
            'entity_type' => FareRule::class,
            'entity_id' => $rule->id,
            'action' => 'deleted',
            'user_id' => $this->admin->id,
        ]);
    }

    public function test_non_admin_cannot_access_fare_rule_endpoints(): void
    {
        $vt = $this->vehicle();
        $this->ruleFor($vt);
        $user = $this->customer();

        $this->getJson('/api/v1/admin/fare-rules', $this->headers($user))->assertForbidden();
        $this->postJson('/api/v1/admin/fare-rules', $this->validRulePayload($vt), $this->headers($user))->assertForbidden();
        $this->putJson('/api/v1/admin/fare-rules/1', ['per_km' => 5], $this->headers($user))->assertForbidden();
        $this->deleteJson('/api/v1/admin/fare-rules/1', [], $this->headers($user))->assertForbidden();
    }

    public function test_negative_values_are_rejected(): void
    {
        $vt = $this->vehicle();

        $payload = $this->validRulePayload($vt);
        $payload['base_fare'] = -1;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);

        $payload = $this->validRulePayload($vt);
        $payload['per_km'] = -0.1;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);

        $payload = $this->validRulePayload($vt);
        $payload['minimum_fare'] = -5;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);
    }

    public function test_percentage_fields_are_validated(): void
    {
        $vt = $this->vehicle();

        $payload = $this->validRulePayload($vt);
        $payload['tax_rate'] = 150;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);

        $payload = $this->validRulePayload($vt);
        $payload['driver_commission_percent'] = 105;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);

        $payload = $this->validRulePayload($vt);
        $payload['driver_earn_percentage'] = -2;
        $this->postJson('/api/v1/admin/fare-rules', $payload, $this->authHeaders())->assertStatus(422);
    }

    public function test_duplicate_active_rule_for_same_vehicle_is_rejected(): void
    {
        $vt = $this->vehicle();
        $this->ruleFor($vt, ['is_active' => true]);

        $this->postJson('/api/v1/admin/fare-rules', $this->validRulePayload($vt), $this->authHeaders())
            ->assertStatus(422);
    }

    public function test_fare_estimate_uses_db_fare_rule_and_returns_broken_down_currency(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, [
            'base_fare' => 80,
            'per_km' => 15,
            'per_minute' => 2,
            'minimum_fare' => 80,
            'booking_fee' => 15,
            'platform_fee' => 10,
            'tax_rate' => 5,
        ]);

        $res = $this->postJson('/api/v1/rides/estimate', $this->estimateBody());

        $res->assertOk()
            ->assertJsonPath('data.0.vehicle_type.id', $vt->id)
            ->assertJsonPath('data.0.distance_source', 'haversine')
            ->assertJsonPath('data.0.currency', 'INR')
            ->assertJsonPath('data.0.base_fare', 80)
            ->assertJsonStructure(['data' => [
                ['vehicle_type', 'distance_km', 'duration_min', 'base_fare', 'distance_charge', 'time_charge', 'booking_fee', 'platform_fee', 'tax_amount', 'estimated_fare', 'currency'],
            ]]);
        $this->assertFareEquals(self::expectedFare($rule), $res);
        $this->assertSame((float) $rule->base_fare, (float) $res->json('data.0.base_fare'));
    }

    public function test_changing_per_km_via_admin_changes_estimate(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, ['per_km' => 15]);

        $before = $this->postJson('/api/v1/rides/estimate', $this->estimateBody())->json('data.0.estimated_fare');

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['per_km' => 40], $this->authHeaders())->assertOk();

        $after = $this->postJson('/api/v1/rides/estimate', $this->estimateBody())->json('data.0.estimated_fare');

        $this->assertSame(self::expectedFare($rule->fresh()), (float) $after);
        $this->assertGreaterThan((float) $before, (float) $after);
    }

    public function test_changing_base_fare_via_admin_changes_estimate(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, ['base_fare' => 80]);

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['base_fare' => 300], $this->authHeaders())->assertOk();

        $res = $this->postJson('/api/v1/rides/estimate', $this->estimateBody());

        $res->assertOk();
        $this->assertFareEquals(self::expectedFare($rule->fresh()), $res);
        $this->assertSame(300.0, (float) $res->json('data.0.base_fare'));
    }

    public function test_changing_tax_rate_via_admin_changes_estimate(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, ['tax_rate' => 5]);

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['tax_rate' => 18], $this->authHeaders())->assertOk();
        $res = $this->postJson('/api/v1/rides/estimate', $this->estimateBody());

        $res->assertOk();
        $this->assertFareEquals(self::expectedFare($rule->fresh()), $res);
    }

    public function test_minimum_fare_is_enforced(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, [
            'base_fare' => 10,
            'per_km' => 1,
            'per_minute' => 0,
            'booking_fee' => 0,
            'platform_fee' => 0,
            'tax_rate' => 0,
            'minimum_fare' => 200,
        ]);

        $res = $this->postJson('/api/v1/rides/estimate', $this->estimateBody());

        $res->assertOk()->assertJsonPath('data.0.estimated_fare', 200);
        $this->assertLessThan(200.0, (float) $res->json('data.0.subtotal'));
        $this->assertSame((float) $rule->minimum_fare, (float) $res->json('data.0.estimated_fare'));
    }

    public function test_final_fare_and_earnings_use_the_current_active_rule(): void
    {
        $vt = $this->vehicle('cab_mini');
        $rule = $this->ruleFor($vt, ['driver_earn_percentage' => 50]);

        $driverUser = User::factory()->create(['user_type' => 'driver']);
        $driverUser->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));
        $driver = Driver::create([
            'user_id' => $driverUser->id,
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
            'latitude' => 26.9150,
            'longitude' => 75.7900,
            'last_location_at' => now(),
            'rating' => 4.5,
        ]);

        // Admin changes the driver share (commission) AFTER booking request.
        AppSetting::create([
            'group' => 'commission',
            'key' => 'ride_commission',
            'label' => 'Ride Commission %',
            'value' => '30',
            'type' => 'number',
        ]);
        $user = $this->customer();
        $booked = $this->postJson('/api/v1/rides', array_merge($this->estimateBody(), ['vehicle_type_id' => $vt->id, 'payment_method' => 'online']), $this->headers($user));
        $booked->assertCreated();
        $rideId = $booked->json('data.id');

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['driver_commission_percent' => 30], $this->authHeaders())->assertOk();

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($driverUser))->assertOk();
        $ride = Ride::find($rideId);
        $this->postJson("/api/v1/rides/{$rideId}/verify-otp", ['otp' => $ride->otp], $this->headers($user))->assertOk();

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'ride',
            'payable_id' => $rideId,
            'payment_method' => 'card',
            'idempotency_key' => 'ride:online:'.$rideId,
        ], $this->headers($user))->assertCreated();
        $providerOrderId = $initiate->json('data.provider_order_id');
        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($providerOrderId),
            'signature' => 'mock',
        ], $this->headers($user))->assertOk();

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driverUser))->assertOk();

        $fresh = Ride::find($rideId);
        $this->assertSame((string) $fresh->estimated_fare, (string) $fresh->final_fare);

        // DriverEarning uses the CURRENT rule (commission 30% -> driver earns 70%).
        $earning = DriverEarning::where('ride_id', $rideId)->firstOrFail();
        $this->assertSame(70.0, (float) $earning->driver_percentage);
        $this->assertSame(30.0, (float) $earning->commission_percentage);
    }

    public function test_duplicate_completion_does_not_create_duplicate_charges_or_earnings(): void
    {
        $vt = $this->vehicle('cab_mini');
        $this->ruleFor($vt);

        $driverUser = User::factory()->create(['user_type' => 'driver']);
        $driverUser->roles()->attach(Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']));
        Driver::create([
            'user_id' => $driverUser->id,
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
            'latitude' => 26.9150,
            'longitude' => 75.7900,
            'last_location_at' => now(),
            'rating' => 4.5,
        ]);

        $user = $this->customer();
        Wallet::create(['user_id' => $user->id, 'wallet_type' => 'customer', 'balance' => 1000, 'total_credited' => 1000]);

        $booked = $this->postJson('/api/v1/rides', array_merge($this->estimateBody(), ['vehicle_type_id' => $vt->id, 'payment_method' => 'wallet']), $this->headers($user));
        $rideId = $booked->json('data.id');

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($driverUser))->assertOk();
        $ride = Ride::find($rideId);
        $this->postJson("/api/v1/rides/{$rideId}/verify-otp", ['otp' => $ride->otp], $this->headers($user))->assertOk();

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driverUser))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($driverUser))->assertOk();

        $this->assertSame(1, DriverEarning::where('ride_id', $rideId)->count());
        $this->assertSame(1, RideStatusHistory::where('ride_id', $rideId)->where('status', Ride::STATUS_COMPLETED)->count());
        $this->assertSame(1, WalletTransaction::where('user_id', $user->id)->where('idempotency_key', "ride:{$rideId}")->count());
    }

    public function test_fare_rule_changes_are_audited_with_old_and_new_values(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt, ['per_km' => 15]);

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['per_km' => 20], $this->authHeaders())->assertOk();

        $log = AuditLog::where('entity_type', FareRule::class)->where('entity_id', $rule->id)->where('action', 'updated')->first();

        $this->assertNotNull($log);
        $this->assertSame($this->admin->id, $log->user_id);
        $this->assertSame('super_admin', $log->role);
        $this->assertSame('15.00', $log->old_values['per_km'] ?? '');
        $this->assertArrayHasKey('per_km', $log->new_values);
        $this->assertSame($vt->id, (int) $rule->vehicle_type_id);
    }

    public function test_fare_rule_update_invalidates_the_fare_cache(): void
    {
        $vt = $this->vehicle();
        $rule = $this->ruleFor($vt, ['per_km' => 15]);

        Cache::spy();

        $this->putJson("/api/v1/admin/fare-rules/{$rule->id}", ['per_km' => 20], $this->authHeaders())->assertOk();

        Cache::shouldHaveReceived('forget')->with('fare_rules:all')->once();
        Cache::shouldHaveReceived('forget')->with('fare_rule:vehicle:'.$vt->id.':zone:global')->once();
    }

    public function test_preview_uses_the_backend_formula(): void
    {
        $vt = $this->vehicle('cab_mini');

        $res = $this->postJson('/api/v1/admin/fare-rules/preview', array_merge($this->validRulePayload($vt), [
            'distance_km' => 4.31,
            'duration_min' => 9,
        ]), $this->authHeaders());

        $res->assertOk()
            ->assertJsonPath('data.distance_km', 4.31)
            ->assertJsonPath('data.duration_min', 9)
            ->assertJsonPath('data.currency', 'INR')
            ->assertJsonPath('data.estimated_fare', 197.03)
            ->assertJsonStructure(['data' => [
                'base_fare', 'distance_charge', 'time_charge', 'booking_fee', 'platform_fee', 'tax_amount', 'estimated_fare',
            ]]);
    }

    public function test_estimate_does_not_expose_raw_fare_rule_configuration(): void
    {
        $vt = $this->vehicle('cab_mini');
        $this->ruleFor($vt, ['driver_earn_percentage' => 75]);

        $res = $this->postJson('/api/v1/rides/estimate', $this->estimateBody());

        $res->assertOk();
        $this->assertArrayNotHasKey('fare_rule', $res->json('data.0'));
        $this->assertArrayNotHasKey('driver_earn_percentage', $res->json('data.0'));
        $this->assertArrayNotHasKey('waiting_charge_per_min', $res->json('data.0'));
    }
}
