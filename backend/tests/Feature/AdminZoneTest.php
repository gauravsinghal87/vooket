<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminZoneTest extends TestCase
{
    use RefreshDatabase;

    private const CENTER = ['lat' => 28.6139, 'lng' => 77.2090];

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $role = Role::updateOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $this->admin = User::create([
            'name' => 'Zone Admin',
            'email' => 'zones@example.com',
            'phone' => '9777777777',
            'password' => Hash::make('secret'),
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $this->admin->roles()->sync([$role->id]);
    }

    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer '.$this->admin->createToken('test')->plainTextToken];
    }

    /**
     * @return array<int, array{lat: float, lng: float}>
     */
    private function squarePolygon(float $lat, float $lng, float $delta = 0.1): array
    {
        return [
            ['lat' => $lat - $delta, 'lng' => $lng - $delta],
            ['lat' => $lat - $delta, 'lng' => $lng + $delta],
            ['lat' => $lat + $delta, 'lng' => $lng + $delta],
            ['lat' => $lat + $delta, 'lng' => $lng - $delta],
        ];
    }

    private function zone(array $overrides = []): Zone
    {
        return Zone::create(array_merge([
            'name' => 'Delhi Central',
            'code' => 'DEL-'.uniqid(),
            'type' => 'multi',
            'city' => 'Delhi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => false,
            'priority' => 10,
            'is_active' => true,
            'polygon' => $this->squarePolygon(self::CENTER['lat'], self::CENTER['lng']),
        ], $overrides));
    }

    public function test_admin_can_create_a_zone_with_a_polygon_boundary(): void
    {
        $payload = [
            'name' => 'South Delhi',
            'code' => 'DEL-SOUTH',
            'city' => 'Delhi',
            'food_enabled' => true,
            'grocery_enabled' => false,
            'polygon' => $this->squarePolygon(self::CENTER['lat'], self::CENTER['lng']),
        ];

        $response = $this->postJson('/api/v1/admin/zones', $payload, $this->authHeaders());

        $response->assertCreated()
            ->assertJsonPath('data.name', 'South Delhi')
            ->assertJsonPath('data.code', 'DEL-SOUTH')
            ->assertJsonPath('data.food_enabled', true)
            ->assertJsonPath('data.grocery_enabled', false)
            ->assertJsonPath('data.polygon.0.latitude', self::CENTER['lat'] - 0.1)
            ->assertJsonPath('data.polygon.0.longitude', self::CENTER['lng'] - 0.1)
            ->assertJsonPath('data.created_by', $this->admin->id);

        $this->assertDatabaseHas('zones', ['code' => 'DEL-SOUTH']);
    }

    public function test_zone_boundary_must_enclose_a_meaningful_area(): void
    {
        $response = $this->postJson('/api/v1/admin/zones', [
            'name' => 'Degenerate',
            'polygon' => [
                ['lat' => 0, 'lng' => 0],
                ['lat' => 0.1, 'lng' => 0.1],
                ['lat' => 0.2, 'lng' => 0.2],
            ],
        ], $this->authHeaders());

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Invalid zone boundary');
    }

    public function test_admin_can_list_zones_with_operational_counters(): void
    {
        $this->zone(['name' => 'Listed Zone']);

        $response = $this->getJson('/api/v1/admin/zones', $this->authHeaders());

        $response->assertOk()
            ->assertJsonPath('data.data.0.name', 'Listed Zone')
            ->assertJsonPath('data.data.0.restaurant_count', 0)
            ->assertJsonPath('data.data.0.online_drivers', 0);
    }

    public function test_admin_can_update_and_toggle_a_zone(): void
    {
        $zone = $this->zone(['name' => 'Before']);

        $this->putJson("/api/v1/admin/zones/{$zone->id}", ['name' => 'After'], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.name', 'After');

        $this->postJson("/api/v1/admin/zones/{$zone->id}/toggle", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->postJson("/api/v1/admin/zones/{$zone->id}/toggle", [], $this->authHeaders())
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_missing_zone_operations_return_not_found(): void
    {
        $this->getJson('/api/v1/admin/zones/999999', $this->authHeaders())->assertNotFound();
        $this->putJson('/api/v1/admin/zones/999999', ['name' => 'Nope'], $this->authHeaders())->assertNotFound();
        $this->postJson('/api/v1/admin/zones/999999/toggle', [], $this->authHeaders())->assertNotFound();
        $this->deleteJson('/api/v1/admin/zones/999999', [], $this->authHeaders())->assertNotFound();
    }

    public function test_serviceability_reports_inside_and_outside_points(): void
    {
        $this->zone(['grocery_enabled' => false]);

        $this->zone([
            'name' => 'Jaipur',
            'code' => 'JAI-'.uniqid(),
            'food_enabled' => false,
            'grocery_enabled' => true,
            'polygon' => $this->squarePolygon(26.9124, 75.7873),
        ]);

        $inside = $this->getJson('/api/v1/serviceability?latitude='.self::CENTER['lat'].'&longitude='.self::CENTER['lng'].'&service=food');
        $inside->assertOk()
            ->assertJsonPath('data.serviceable', true)
            ->assertJsonPath('data.zone.name', 'Delhi Central')
            ->assertJsonPath('data.reason', null);

        $outside = $this->getJson('/api/v1/serviceability?latitude=19.0760&longitude=72.8777&service=food');
        $outside->assertOk()
            ->assertJsonPath('data.serviceable', false)
            ->assertJsonPath('data.reason', 'OUTSIDE_SERVICE_AREA');

        $disabled = $this->getJson('/api/v1/serviceability?latitude='.self::CENTER['lat'].'&longitude='.self::CENTER['lng'].'&service=grocery');
        $disabled->assertOk()
            ->assertJsonPath('data.serviceable', false)
            ->assertJsonPath('data.reason', 'SERVICE_NOT_AVAILABLE_IN_ZONE');
    }

    public function test_serviceability_runs_in_grace_mode_when_no_zones_are_defined(): void
    {
        $response = $this->getJson('/api/v1/serviceability?latitude='.self::CENTER['lat'].'&longitude='.self::CENTER['lng'].'&service=food');

        $response->assertOk()
            ->assertJsonPath('data.serviceable', false)
            ->assertJsonPath('data.reason', 'NO_ZONE_DEFINED');
    }

    public function test_serviceability_services_lists_enabled_verticals(): void
    {
        $this->zone(['food_enabled' => true, 'grocery_enabled' => false, 'ride_enabled' => false]);

        $this->getJson('/api/v1/serviceability/services')
            ->assertOk()
            ->assertJsonPath('data.enabled.food', true)
            ->assertJsonPath('data.enabled.grocery', false)
            ->assertJsonPath('data.enabled.ride', false);
    }
}
