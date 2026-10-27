<?php

namespace Tests\Feature;

use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\AppSetting;
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
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RideBookingTest extends TestCase
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

    private function customer(): User
    {
        return User::factory()->create(['user_type' => 'customer']);
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

    private function vehicleTypeWithFare(array $fare = []): VehicleType
    {
        $vt = VehicleType::create([
            'name' => 'Cab Mini',
            'code' => 'cab_mini',
            'icon' => 'vehicle-cab',
            'description' => 'Compact hatchback',
            'capacity' => 4,
            'ac' => true,
            'is_active' => true,
            'sort_order' => 1,
        ]);

        FareRule::create(array_merge([
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
        ], $fare));

        return $vt->fresh();
    }

    private function driverNear(VehicleType $vt, float $lat = 26.9124, float $lng = 75.7873, array $overrides = []): array
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
            'latitude' => $lat,
            'longitude' => $lng,
            'last_location_at' => now(),
            'rating' => 4.5,
        ], $overrides));

        return ['user' => $user, 'driver' => $driver];
    }

    private function book(array $payload = []): array
    {
        $user = $this->customer();

        $res = $this->postJson('/api/v1/rides', array_merge([
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => VehicleType::factory()->create()->id,
            'pickup_address' => 'Jaipur Gate, Jaipur',
            'destination_address' => 'C-Scheme, Jaipur',
            'payment_method' => 'cash',
        ], $payload), $this->headers($user));

        return ['user' => $user, 'response' => $res];
    }

    private function enableGoogle(): void
    {
        config(['integrations.mode' => 'live']);
        config(['integrations.provider.maps' => 'google']);
        config(['integrations.credentials.maps.server_key' => 'test-key']);
        Cache::flush();
    }

    public function test_estimate_returns_fare_breakdown_for_vehicle_type(): void
    {
        $vt = $this->vehicleTypeWithFare();

        $res = $this->postJson('/api/v1/rides/estimate', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ]);

        $res->assertOk()
            ->assertJsonPath('data.0.distance_source', 'haversine')
            ->assertJsonPath('data.0.estimated_fare', self::expectedFare($vt))
            ->assertJsonStructure(['data' => [['base_fare', 'distance_charge', 'time_charge', 'booking_fee', 'platform_fee', 'tax_amount']]]);
    }

    public function test_estimate_returns_422_when_coordinates_missing(): void
    {
        $res = $this->postJson('/api/v1/rides/estimate', []);

        $res->assertStatus(422);
    }

    public function test_estimate_uses_routed_distance_when_google_provider_active(): void
    {
        $this->enableGoogle();
        $vt = $this->vehicleTypeWithFare();

        Http::fake([
            'maps.googleapis.com/maps/api/distancematrix/*' => Http::response([
                'status' => 'OK',
                'rows' => [[
                    'elements' => [[
                        'status' => 'OK',
                        'distance' => ['value' => 7200],
                        'duration' => ['value' => 1080],
                    ]],
                ]],
            ]),
        ]);

        $res = $this->postJson('/api/v1/rides/estimate', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ]);

        $res->assertOk()
            ->assertJsonPath('data.0.distance_km', 7.2)
            ->assertJsonPath('data.0.duration_min', 18)
            ->assertJsonPath('data.0.distance_source', 'routed');
    }

    public function test_nearby_drivers_returns_eligible_drivers_within_radius(): void
    {
        $customer = $this->customer();
        $vt = $this->vehicleTypeWithFare();
        $this->driverNear($vt, 26.9150, 75.7900);
        $this->driverNear($vt, 26.9200, 75.7950);

        $res = $this->getJson('/api/v1/rides/nearby-drivers?latitude='.self::PICKUP['lat'].'&longitude='.self::PICKUP['lng'].'&vehicle_type_id='.$vt->id, $this->headers($customer));

        $res->assertOk();
        $this->assertCount(2, $res->json('data'));
        $this->assertArrayHasKey('distance_km', $res->json('data.0'));
        $this->assertArrayHasKey('eta_min', $res->json('data.0'));
        $this->assertArrayHasKey('vehicle_type_name', $res->json('data.0'));
    }

    public function test_nearby_drivers_isolates_results_by_vehicle_type(): void
    {
        $customer = $this->customer();
        $cab = $this->vehicleTypeWithFare();
        $bike = VehicleType::create(['name' => 'Bike', 'code' => 'bike', 'is_active' => true]);
        $this->driverNear($cab, 26.9150, 75.7900);

        $res = $this->getJson('/api/v1/rides/nearby-drivers?latitude='.self::PICKUP['lat'].'&longitude='.self::PICKUP['lng'].'&vehicle_type_id='.$bike->id, $this->headers($customer));

        $res->assertOk();
        $this->assertSame([], $res->json('data'));
    }

    public function test_nearby_drivers_excludes_unverified_offline_and_unapproved_drivers(): void
    {
        $customer = $this->customer();
        $vt = $this->vehicleTypeWithFare();
        $this->driverNear($vt, 26.9150, 75.7900, ['is_verified' => false]);
        $this->driverNear($vt, 26.9160, 75.7910, ['is_online' => false]);
        $this->driverNear($vt, 26.9170, 75.7920, ['status' => 'pending']);

        $res = $this->getJson('/api/v1/rides/nearby-drivers?latitude='.self::PICKUP['lat'].'&longitude='.self::PICKUP['lng'].'&vehicle_type_id='.$vt->id, $this->headers($customer));

        $res->assertOk();
        $this->assertSame([], $res->json('data'));
    }

    public function test_stale_location_driver_is_excluded_when_freshness_configured(): void
    {
        config(['ride.location_freshness_minutes' => 5]);

        $customer = $this->customer();
        $vt = $this->vehicleTypeWithFare();
        $this->driverNear($vt, 26.9150, 75.7900, ['last_location_at' => now()->subHour()]);

        $res = $this->getJson('/api/v1/rides/nearby-drivers?latitude='.self::PICKUP['lat'].'&longitude='.self::PICKUP['lng'].'&vehicle_type_id='.$vt->id, $this->headers($customer));

        $res->assertOk();
        $this->assertSame([], $res->json('data'));
    }

    public function test_booking_creates_ride_with_single_active_offer(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $this->driverNear($vt, 26.9150, 75.7900);
        $this->driverNear($vt, 26.9200, 75.7950);
        $this->driverNear($vt, 26.9300, 75.8050);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'payment_method' => 'cash',
        ], $this->headers($user));

        $res->assertCreated()
            ->assertJsonPath('data.status', Ride::STATUS_REQUESTING)
            ->assertJsonPath('data.meta.distance_source', 'haversine');

        $ride = Ride::find($res->json('data.id'));

        $this->assertSame(1, RideRequest::where('ride_id', $ride->id)->where('status', 'pending')->count());
        $this->assertSame(2, RideRequest::where('ride_id', $ride->id)->where('status', 'sent')->count());
        $this->assertSame('searching', $ride->meta['dispatch']['status'] ?? null);
        $this->assertSame('Ride requested', RideStatusHistory::where('ride_id', $ride->id)->orderBy('id')->first()->notes);
    }

    public function test_booking_requires_authentication(): void
    {
        $vt = $this->vehicleTypeWithFare();

        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ]);

        $res->assertStatus(401);
        $this->assertSame(0, Ride::count());
    }

    public function test_booking_rejects_out_of_range_coordinates(): void
    {
        $vt = $this->vehicleTypeWithFare();

        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => 200,
            'pickup_longitude' => 500,
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($this->customer()));

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['pickup_latitude', 'pickup_longitude']);
        $this->assertSame(0, Ride::count());
    }

    public function test_booking_rejects_unknown_vehicle_type(): void
    {
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => 999999,
        ], $this->headers($this->customer()));

        $res->assertStatus(422)->assertJsonValidationErrors(['vehicle_type_id']);
        $this->assertSame(0, Ride::count());
    }

    public function test_replaying_same_idempotency_key_returns_the_existing_ride(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $user = $this->customer();
        $payload = [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'idempotency_key' => 'ride-confirm-double-tap',
        ];

        $first = $this->postJson('/api/v1/rides', $payload, $this->headers($user));
        $replayed = $this->postJson('/api/v1/rides', $payload, $this->headers($user));

        $first->assertCreated();
        $replayed->assertCreated();
        $this->assertSame($first->json('data.id'), $replayed->json('data.id'));
        $this->assertSame(1, Ride::count());
    }

    public function test_same_idempotency_key_with_a_different_ride_is_rejected(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $user = $this->customer();

        $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'idempotency_key' => 'ride-key-mutation',
        ], $this->headers($user))->assertCreated();

        $mutated = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => 26.8,
            'destination_longitude' => 75.7,
            'vehicle_type_id' => $vt->id,
            'idempotency_key' => 'ride-key-mutation',
        ], $this->headers($user));

        $mutated->assertStatus(400)->assertJsonPath('message', 'Idempotency key already used with a different payload');
        $this->assertSame(1, Ride::count());
    }

    public function test_driver_accept_assigns_ride_expires_others_and_wires_dispatch_log(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();

        $accept = $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']));

        if ($accept->status() >= 500) {
            file_put_contents(
                '/tmp/rbt500_exc.md',
                sprintf(
                    'CLASS=%s
MSG=%s
FILE=%s:%d
TRACE=%s
BODY=%s
CONTENT=%s
',
                    get_class($accept->exception ?? new \Exception('(no exception attached)')),
                    ($accept->exception ?? new \Exception(''))->getMessage(),
                    ($accept->exception ?? new \Exception(''))->getFile(),
                    ($accept->exception ?? new \Exception(''))->getLine(),
                    ($accept->exception ? $accept->exception->getTraceAsString() : '(none)'),
                    $accept->json(),
                    $accept->getContent()
                )
            );
        }

        $accept->assertOk()->assertJsonPath('data.status', Ride::STATUS_DRIVER_ASSIGNED);
        $this->assertTrue((bool) $a['driver']->fresh()->is_busy);

        $ride = Ride::find($rideId);
        $this->assertSame($a['driver']->id, $ride->driver_id);

        $this->assertSame(
            1,
            RideRequest::where('ride_id', $rideId)->where('id', '!=', $active->id)->where('status', 'expired')->count()
        );

        $this->assertDatabaseHas('dispatch_logs', [
            'dispatch_type' => 'ride',
            'ride_id' => $rideId,
            'candidate_id' => $a['driver']->id,
            'candidate_type' => 'driver',
            'status' => 'assigned',
        ]);

        $this->assertSame('Driver accepted request', RideStatusHistory::where('ride_id', $rideId)->where('status', Ride::STATUS_DRIVER_ASSIGNED)->first()->notes);
    }

    public function test_second_driver_cannot_accept_an_already_assigned_ride(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $offers = RideRequest::where('ride_id', $rideId)->orderBy('id')->get();
        $active = $offers->firstWhere('status', 'pending');

        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();

        $second = $offers->firstWhere('id', '!=', $active->id);
        $blocked = $this->postJson("/api/v1/driver/requests/{$second->id}/accept", [], $this->headers($b['user']));

        $blocked->assertNotFound();
        $this->assertSame($a['driver']->id, Ride::find($rideId)->driver_id);
    }

    public function test_driver_active_trip_returns_only_in_flight_trip(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        Ride::create([
            'ride_number' => 'RIDE_TEST_ACTIVE',
            'user_id' => $this->customer()->id,
            'driver_id' => $a['driver']->id,
            'vehicle_type_id' => $vt->id,
            'status' => Ride::STATUS_DRIVER_ASSIGNED,
            'pickup_address' => 'Smoke Gate, Jaipur',
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_address' => 'Test C-Scheme, Jaipur',
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'distance_km' => 4.7,
            'duration_min' => 9,
            'estimated_fare' => 86,
        ]);

        $this->getJson('/api/v1/driver/trips/active', $this->headers($a['user']))
            ->assertOk()
            ->assertJsonPath('data.ride_number', 'RIDE_TEST_ACTIVE')
            ->assertJsonPath('data.status', Ride::STATUS_DRIVER_ASSIGNED);

        Ride::where('ride_number', 'RIDE_TEST_ACTIVE')->update(['status' => Ride::STATUS_COMPLETED]);

        $this->getJson('/api/v1/driver/trips/active', $this->headers($a['user']))
            ->assertOk()
            ->assertJsonPath('data', null);
    }

    public function test_driver_reject_promotes_next_sent_candidate(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();

        $this->postJson("/api/v1/driver/requests/{$active->id}/reject", [], $this->headers($a['user']))->assertOk();

        $incoming = $this->getJson('/api/v1/driver/incoming-requests', $this->headers($b['user']));

        $incoming->assertOk();
        $this->assertSame($rideId, $incoming->json('data.0.ride_id'));
        $this->assertSame('pending', $incoming->json('data.0.status'));

        $this->assertNotNull(RideRequest::where('ride_id', $rideId)->find($active->id)->responded_at);
        $this->assertSame(1, $a['driver']->fresh()->rejected_rides);
    }

    public function test_expired_offer_is_promoted_when_customer_polls(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        RideRequest::where('ride_id', $rideId)->where('status', 'pending')->update(['expires_at' => now()->subMinute()]);

        $show = $this->getJson("/api/v1/rides/{$rideId}", $this->headers($user));

        $show->assertOk();
        $this->assertSame('pending', RideRequest::where('ride_id', $rideId)->orderBy('id')->get()->last()->status);
        $this->assertSame(
            1,
            RideRequest::where('ride_id', $rideId)->where('driver_id', $a['driver']->id)->where('status', 'expired')->count()
        );
        $this->assertSame(
            'pending',
            RideRequest::where('ride_id', $rideId)->where('driver_id', $b['driver']->id)->first()->status
        );
    }

    public function test_booked_ride_without_drivers_becomes_no_driver_found(): void
    {
        $vt = $this->vehicleTypeWithFare();

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $res->assertCreated()->assertJsonPath('data.status', Ride::STATUS_NO_DRIVER_FOUND);
        $this->assertSame('no_driver_available', Ride::find($res->json('data.id'))->meta['dispatch']['status'] ?? null);
    }

    public function test_customer_cancel_before_assignment_has_no_fee(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');

        $cancel = $this->postJson("/api/v1/rides/{$rideId}/cancel", ['reason' => 'Changed my mind'], $this->headers($user));

        $cancel->assertOk()->assertJsonPath('data.status', Ride::STATUS_CANCELLED);
        $this->assertSame(0.0, (float) Ride::find($rideId)->meta['cancellation']['fee']);
        $this->assertSame(0, RideRequest::where('ride_id', $rideId)->where('status', 'cancelled')->count() === 0 ? 0 : RideRequest::where('ride_id', $rideId)->where('status', 'pending')->count());
        $this->assertDatabaseHas('ride_status_histories', ['ride_id' => $rideId, 'status' => Ride::STATUS_CANCELLED]);
    }

    public function test_customer_cancel_after_assignment_records_fee_and_releases_driver(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();

        $cancel = $this->postJson("/api/v1/rides/{$rideId}/cancel", ['reason' => 'Long wait'], $this->headers($user));

        $cancel->assertOk()->assertJsonPath('data.status', Ride::STATUS_CANCELLED);
        $this->assertSame(25.0, (float) Ride::find($rideId)->meta['cancellation']['fee']);
        $this->assertFalse((bool) $a['driver']->fresh()->is_busy);
    }

    public function test_driver_release_cancellation_reassigns_the_ride(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();

        $release = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'cancelled', 'reason' => 'Breakdown'], $this->headers($a['user']));

        $release->assertOk()->assertJsonPath('data.status', Ride::STATUS_REQUESTING);

        $release2 = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'cancelled'], $this->headers($a['user']));
        $release2->assertStatus(422);

        $pendingFresh = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->with('ride')->get();
        $this->assertCount(1, $pendingFresh);
        $this->assertSame($b['driver']->id, $pendingFresh->first()->driver_id);
        $this->assertNull(Ride::find($rideId)->driver_id);
    }

    public function test_full_trip_completion_records_final_fare_and_driver_earnings(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'payment_method' => 'online',
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $ride = Ride::find($rideId);

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'arriving'], $this->headers($a['user']))->assertOk();
        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'arrived'], $this->headers($a['user']))->assertOk();

        $otp = $ride->otp;
        $this->postJson("/api/v1/rides/{$rideId}/verify-otp", ['otp' => $otp], $this->headers($user))->assertOk();

        // The customer pays the fare online through the Razorpay flow before
        // the driver may complete the trip — completion requires payment.
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

        $this->assertSame('paid', Ride::find($rideId)->payment_status);

        $complete = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($a['user']));

        $complete->assertOk()->assertJsonPath('data.status', Ride::STATUS_COMPLETED);

        $fresh = Ride::find($rideId);
        $this->assertNotNull($fresh->trip_completed_at);
        $this->assertSame((string) $fresh->estimated_fare, (string) $fresh->final_fare);
        $this->assertSame('PAID', $fresh->payment_status);

        $earning = DriverEarning::where('ride_id', $rideId)->first();
        $this->assertNotNull($earning);
        $this->assertSame(15.0, (float) $earning->commission_percentage);
        $this->assertSame(round((float) $fresh->final_fare * 0.85, 2), (float) $earning->earning_amount);
        $this->assertFalse((bool) $a['driver']->fresh()->is_busy);
        $this->assertSame(1, $a['driver']->fresh()->total_trips);

        $completedHistory = RideStatusHistory::where('ride_id', $rideId)->where('status', Ride::STATUS_COMPLETED)->first();
        $this->assertNotNull($completedHistory);
        $this->assertSame($a['driver']->user_id, $completedHistory->changed_by);
        $this->assertTrue(User::whereKey($completedHistory->changed_by)->exists());

        $earnings = $this->getJson('/api/v1/driver/earnings', $this->headers($a['user']));
        $earnings->assertOk()->assertJsonPath('data.total', round((float) $fresh->final_fare * 0.85, 2));
    }

    public function test_completion_with_wallet_payment_deducts_balance_once(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        Wallet::create([
            'user_id' => $user->id,
            'wallet_type' => 'customer',
            'balance' => 1000,
            'total_credited' => 1000,
        ]);

        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'payment_method' => 'wallet',
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $ride = Ride::find($rideId);

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();
        $this->postJson("/api/v1/rides/{$rideId}/verify-otp", ['otp' => $ride->otp], $this->headers($user))->assertOk();

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($a['user']))->assertOk();

        $fresh = Ride::find($rideId);
        $this->assertSame('PAID', $fresh->payment_status);
        $this->assertSame(round(1000 - (float) $fresh->final_fare, 2), (float) Wallet::where('user_id', $user->id)->first()->balance);
        $this->assertSame(1, WalletTransaction::where('user_id', $user->id)->where('idempotency_key', "ride:{$rideId}")->count());

        $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($a['user']))->assertOk();

        $this->assertSame(1, DriverEarning::where('ride_id', $rideId)->count());
        $this->assertSame(1, RideStatusHistory::where('ride_id', $rideId)->where('status', Ride::STATUS_COMPLETED)->count());
        $this->assertSame(1, WalletTransaction::where('user_id', $user->id)->where('idempotency_key', "ride:{$rideId}")->count());
    }

    public function test_wallet_completion_is_rejected_when_balance_insufficient(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        Wallet::create([
            'user_id' => $user->id,
            'wallet_type' => 'customer',
            'balance' => 10,
        ]);

        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
            'payment_method' => 'wallet',
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $ride = Ride::find($rideId);

        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();
        $this->postJson("/api/v1/rides/{$rideId}/verify-otp", ['otp' => $ride->otp], $this->headers($user))->assertOk();

        $complete = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'completed'], $this->headers($a['user']));

        $complete->assertStatus(400)
            ->assertJsonPath('message', 'Ride payment must be completed before the ride can be marked as completed.');

        $fresh = Ride::find($rideId);
        $this->assertSame(Ride::STATUS_IN_PROGRESS, $fresh->status);
        $this->assertSame('PENDING', $fresh->payment_status);
        $this->assertSame(10.0, (float) Wallet::where('user_id', $user->id)->first()->balance);
        $this->assertSame(0, DriverEarning::where('ride_id', $rideId)->count());
    }

    public function test_driver_cannot_update_status_of_another_driver_ride(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);
        $b = $this->driverNear($vt, 26.9200, 75.7950);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();

        $intrusion = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'arriving'], $this->headers($b['user']));

        $intrusion->assertNotFound();
    }

    public function test_status_transitions_are_enforced_in_order(): void
    {
        $vt = $this->vehicleTypeWithFare();
        $a = $this->driverNear($vt, 26.9150, 75.7900);

        $user = $this->customer();
        $res = $this->postJson('/api/v1/rides', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
            'vehicle_type_id' => $vt->id,
        ], $this->headers($user));

        $rideId = $res->json('data.id');
        $active = RideRequest::where('ride_id', $rideId)->where('status', 'pending')->firstOrFail();
        $this->postJson("/api/v1/driver/requests/{$active->id}/accept", [], $this->headers($a['user']))->assertOk();

        $skipped = $this->postJson("/api/v1/driver/trips/{$rideId}/status", ['status' => 'in_progress'], $this->headers($a['user']));

        $skipped->assertStatus(422);
        $this->assertSame(Ride::STATUS_DRIVER_ASSIGNED, Ride::find($rideId)->status);
    }

    public function test_route_returns_haversine_estimate_without_polyline_in_mock_mode(): void
    {
        $user = $this->customer();

        $res = $this->postJson('/api/v1/rides/route', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
        ], $this->headers($user));

        $res->assertOk()
            ->assertJsonPath('data.source', 'haversine')
            ->assertJsonPath('data.status', 'OK');
        $this->assertGreaterThan(0, $res->json('data.distance_km'));
        $this->assertNull($res->json('data.polyline'));
    }

    public function test_route_uses_google_directions_when_configured(): void
    {
        $this->enableGoogle();
        $user = $this->customer();

        Http::fake([
            'maps.googleapis.com/maps/api/directions/*' => Http::response([
                'status' => 'OK',
                'routes' => [[
                    'overview_polyline' => ['points' => 'encoded_polyline_xyz'],
                    'legs' => [[
                        'distance' => ['value' => 8200],
                        'duration' => ['value' => 1320],
                    ]],
                ]],
            ]),
        ]);

        $res = $this->postJson('/api/v1/rides/route', [
            'pickup_latitude' => self::PICKUP['lat'],
            'pickup_longitude' => self::PICKUP['lng'],
            'destination_latitude' => self::DESTINATION['lat'],
            'destination_longitude' => self::DESTINATION['lng'],
        ], $this->headers($user));

        $res->assertOk()
            ->assertJsonPath('data.source', 'google')
            ->assertJsonPath('data.distance_km', 8.2)
            ->assertJsonPath('data.duration_min', 22)
            ->assertJsonPath('data.polyline', 'encoded_polyline_xyz');

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'maps.googleapis.com/maps/api/directions/json') && $request['key'] === 'test-key');
    }

    public function test_config_maps_endpoint_returns_safe_display_defaults(): void
    {
        config(['maps.default_zoom' => 14]);
        Cache::flush();

        $res = $this->getJson('/api/v1/config/maps');

        $res->assertOk()->assertJsonStructure([
            'data' => ['enabled', 'public_key', 'default_center', 'default_zoom'],
        ]);
        $this->assertSame(14, $res->json('data.default_zoom'));
        $this->assertArrayNotHasKey('server_key', $res->json('data'));
    }

    /**
     * Compute the expected estimate exactly like the service does.
     */
    private static function expectedFare(VehicleType $vt): float
    {
        $rule = FareRule::where('vehicle_type_id', $vt->id)->firstOrFail();
        $distance = 4.31; // haversine from default pickup to destination, float
        $duration = max(1, round($distance / 30 * 60));

        $subtotal = (float) $rule->base_fare + round($distance * (float) $rule->per_km, 2)
            + round($duration * (float) $rule->per_minute, 2)
            + (float) $rule->booking_fee + (float) $rule->platform_fee;
        $tax = round($subtotal * (float) $rule->tax_rate / 100, 2);

        return max(round($subtotal + $tax, 2), (float) $rule->minimum_fare);
    }
}
