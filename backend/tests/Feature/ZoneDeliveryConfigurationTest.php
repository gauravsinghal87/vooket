<?php

namespace Tests\Feature;

use App\Exceptions\DeliveryConfigurationException;
use App\Models\Address;
use App\Models\AppSetting;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliverySlot;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Zone;
use App\Models\ZoneDeliveryConfig;
use App\Services\Maps\ZoneService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use App\Services\Pricing\ZoneDeliveryConfigService;
use Database\Seeders\ConfigurationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

/**
 * Zone-scoped Food / Grocery Instant / Grocery Scheduled delivery configuration.
 *
 * The delivery DESTINATION resolves the zone, and that zone's saved values price
 * the cart and order. A zone without a complete saved row cannot be priced; the
 * customer receives an actionable configuration error, never a silent global
 * fallback. Every order freezes what it was priced with, so later admin edits
 * are safe.
 */
class ZoneDeliveryConfigurationTest extends TestCase
{
    use RefreshDatabase;

    private const A_LAT = 12.9716;

    private const A_LNG = 77.5946;

    private const B_LAT = 13.0500;

    private const B_LNG = 77.6500;

    private Zone $zoneA;

    private Zone $zoneB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(ConfigurationSeeder::class);

        $this->zoneA = $this->makeZone('Zone A', self::A_LAT, self::A_LNG, 10);
        $this->zoneB = $this->makeZone('Zone B', self::B_LAT, self::B_LNG, 20);
    }

    public function test_the_destination_resolves_the_zone_and_overlaps_use_priority(): void
    {
        $zones = app(ZoneService::class);

        $this->assertSame($this->zoneA->id, $zones->resolve(self::A_LAT, self::A_LNG, 'food')?->id);
        $this->assertSame($this->zoneB->id, $zones->resolve(self::B_LAT, self::B_LNG, 'food')?->id);
        $this->assertNull($zones->resolve(13.5000, 78.5000, 'food'));

        $outside = $zones->isServiceable(13.5000, 78.5000, 'food');
        $this->assertFalse($outside['serviceable']);
        $this->assertSame(ZoneService::REASON_OUTSIDE_SERVICE_AREA, $outside['reason']);

        $invalid = $zones->isServiceable(null, null, 'food');
        $this->assertFalse($invalid['serviceable']);
        $this->assertSame(ZoneService::REASON_INVALID_COORDINATES, $invalid['reason']);

        // A higher-priority overlapping zone wins deterministically.
        $overlap = $this->makeZone('Overlap', self::A_LAT, self::A_LNG, 99);
        $this->assertSame($overlap->id, $zones->resolve(self::A_LAT, self::A_LNG, 'food')?->id);
    }

    public function test_admin_can_save_independent_configs_and_reset_requires_setup(): void
    {
        $admin = $this->makeAdmin();

        $this->getJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs")
            ->assertOk()
            ->assertJsonPath('data.configs.food.configured', false)
            ->assertJsonPath('data.configs.grocery_instant.configured', false)
            ->assertJsonPath('data.configs.grocery_scheduled.configured', false);

        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => 20,
            'delivery_fee_paid_by_admin_per_km' => 4,
            'free_delivery_above' => 900,
            'free_delivery_km' => 1,
            'delivery_gst_percent' => 5,
            'partner_free_distance_earning' => 11,
            'packaging_charge' => 7,
            'handling_fee' => 3,
        ])->assertOk();

        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'grocery',
            'delivery_mode' => 'instant',
            'delivery_fee_per_km' => 10,
            'delivery_fee_paid_by_admin_per_km' => 2,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => 5,
            'partner_free_distance_earning' => 20,
        ])->assertOk();

        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'chargeable',
            'delivery_fee_per_km' => 30,
            'delivery_fee_paid_by_admin_per_km' => 6,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => 12,
            'packaging_charge' => 8,
            'handling_fee' => 2,
        ])->assertOk();

        // Re-saving updates the same row instead of creating a conflicting one.
        // It is a partial update: fields omitted from the payload keep their
        // previously saved values.
        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => 25,
            'delivery_gst_percent' => 5,
        ])->assertOk();

        $this->assertSame(3, ZoneDeliveryConfig::where('zone_id', $this->zoneA->id)->count());

        $food = ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'food',
            'delivery_mode' => 'standard',
        ])->firstOrFail();

        $this->assertEqualsWithDelta(25.0, (float) $food->delivery_fee_per_km, 0.001);
        $this->assertEqualsWithDelta(4.0, (float) $food->delivery_fee_paid_by_admin_per_km, 0.001);
        $this->assertEqualsWithDelta(900.0, (float) $food->free_delivery_above, 0.001);
        $this->assertEqualsWithDelta(1.0, (float) $food->free_delivery_km, 0.001);
        $this->assertEqualsWithDelta(11.0, (float) $food->partner_free_distance_earning, 0.001);
        $this->assertEqualsWithDelta(7.0, (float) $food->packaging_charge, 0.001);
        $this->assertEqualsWithDelta(3.0, (float) $food->handling_fee, 0.001);

        $this->getJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs")
            ->assertOk()
            ->assertJsonPath('data.configs.food.configured', true)
            ->assertJsonPath('data.configs.food.values.delivery_fee_per_km', 25)
            ->assertJsonPath('data.configs.grocery_instant.configured', true)
            ->assertJsonPath('data.configs.grocery_instant.values.delivery_fee_per_km', 10)
            ->assertJsonPath('data.configs.grocery_scheduled.configured', true)
            ->assertJsonPath('data.configs.grocery_scheduled.values.delivery_fee_per_km', 30);

        // Reset removes the zone configuration so checkout fails with a clear
        // setup-required error until it is saved again.
        $this->deleteJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'food',
            'delivery_mode' => 'standard',
        ])->assertOk();

        $this->assertDatabaseMissing('zone_delivery_configs', [
            'zone_id' => $this->zoneA->id,
            'module' => 'food',
            'delivery_mode' => 'standard',
        ]);

        $this->getJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs")
            ->assertOk()
            ->assertJsonPath('data.configs.food.configured', false);
    }

    public function test_saved_values_are_returned_in_the_same_shape_the_admin_form_saves(): void
    {
        $this->makeAdmin();

        $urlA = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";
        $urlB = "/api/v1/admin/zones/{$this->zoneB->id}/delivery-configs";

        $foodA = [
            'delivery_fee_per_km' => 21.5,
            'delivery_fee_paid_by_admin_per_km' => 4.25,
            'free_delivery_above' => 800,
            'free_delivery_km' => 1.5,
            'delivery_gst_percent' => 5,
            'partner_free_distance_earning' => 11,
            'packaging_charge' => 7,
            'handling_fee' => 3,
            'admin_fee_per_parcel' => null,
        ];
        $instantA = [
            'delivery_fee_per_km' => 10,
            'delivery_fee_paid_by_admin_per_km' => 2,
            'free_delivery_above' => 600,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => 5,
            'partner_free_distance_earning' => 20,
            'packaging_charge' => 0,
            'handling_fee' => 0,
            'admin_fee_per_parcel' => null,
        ];
        $scheduledA = [
            'delivery_type' => 'free',
            'delivery_fee_per_km' => 0,
            'delivery_fee_paid_by_admin_per_km' => 0,
            'free_delivery_above' => null,
            'free_delivery_km' => null,
            'delivery_gst_percent' => 0,
            'partner_free_distance_earning' => 20,
            'packaging_charge' => 8,
            'handling_fee' => 2,
            'admin_fee_per_parcel' => 15,
        ];
        $foodB = [
            'delivery_fee_per_km' => 55,
            'delivery_fee_paid_by_admin_per_km' => 9,
            'free_delivery_above' => 1000,
            'free_delivery_km' => 2,
            'delivery_gst_percent' => 18,
            'partner_free_distance_earning' => 30,
            'packaging_charge' => 12,
            'handling_fee' => 6,
            'admin_fee_per_parcel' => null,
        ];

        $saves = [
            [$urlA, 'food', 'standard', $foodA],
            [$urlA, 'grocery', 'instant', $instantA],
            [$urlA, 'grocery', 'scheduled', $scheduledA],
            [$urlB, 'food', 'standard', $foodB],
        ];

        foreach ($saves as [$url, $module, $mode, $values]) {
            $response = $this->putJson($url, [
                'module' => $module,
                'delivery_mode' => $mode,
                ...$values,
            ])->assertOk();

            foreach ($values as $field => $value) {
                $response->assertJsonPath("data.values.{$field}", $value);
            }
        }

        // A new GET request must return the persisted values using the same
        // editable field names as the save payload, not the pricing aliases.
        $getA = $this->getJson($urlA)->assertOk()
            ->assertJsonPath('data.configs.food.saved', true)
            ->assertJsonPath('data.configs.food.configured', true)
            ->assertJsonPath('data.configs.grocery_instant.saved', true)
            ->assertJsonPath('data.configs.grocery_scheduled.saved', true)
            ->assertJsonPath('data.configs.grocery_scheduled.values.delivery_type', 'free');

        foreach ($foodA as $field => $value) {
            $getA->assertJsonPath("data.configs.food.values.{$field}", $value);
        }
        foreach ($instantA as $field => $value) {
            $getA->assertJsonPath("data.configs.grocery_instant.values.{$field}", $value);
        }
        foreach ($scheduledA as $field => $value) {
            $getA->assertJsonPath("data.configs.grocery_scheduled.values.{$field}", $value);
        }

        // A different zone is independent, and returning to Zone A still loads
        // exactly what was saved there.
        $getB = $this->getJson($urlB)->assertOk()
            ->assertJsonPath('data.configs.food.saved', true)
            ->assertJsonPath('data.configs.grocery_instant.saved', false)
            ->assertJsonPath('data.configs.grocery_instant.values.delivery_fee_per_km', 5)
            ->assertJsonPath('data.configs.grocery_instant.values.free_delivery_km', 2)
            ->assertJsonPath('data.configs.grocery_scheduled.saved', false)
            ->assertJsonPath('data.configs.grocery_scheduled.values.delivery_type', 'chargeable')
            ->assertJsonPath('data.configs.grocery_scheduled.values.admin_fee_per_parcel', null);

        foreach ($foodB as $field => $value) {
            $getB->assertJsonPath("data.configs.food.values.{$field}", $value);
        }

        $this->getJson($urlA)->assertOk()
            ->assertJsonPath('data.configs.food.values.delivery_fee_per_km', 21.5)
            ->assertJsonPath('data.configs.grocery_instant.values.free_delivery_km', 0)
            ->assertJsonPath('data.configs.grocery_scheduled.values.admin_fee_per_parcel', 15);
    }

    public function test_zone_delivery_configuration_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/admin/zones/delivery-config-status')->assertUnauthorized();

        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => 5,
        ])->assertUnauthorized();
    }

    public function test_zone_delivery_configuration_endpoints_forbid_non_super_admins(): void
    {
        Sanctum::actingAs($this->makeCustomer());

        $this->getJson('/api/v1/admin/zones/delivery-config-status')->assertForbidden();

        $this->putJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs", [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => 5,
        ])->assertForbidden();
    }

    public function test_admin_config_validation_rejects_negative_and_invalid_combinations(): void
    {
        $this->makeAdmin();

        $url = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";

        $this->putJson($url, [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => -1,
        ])->assertStatus(422);

        $this->putJson($url, [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_gst_percent' => 101,
        ])->assertStatus(422);

        // Only optional fields accept an explicit null. A non-nullable price of
        // zero must be sent as 0, never null.
        $this->putJson($url, [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'packaging_charge' => null,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('packaging_charge');

        $this->putJson($url, [
            'module' => 'food',
            'delivery_mode' => 'instant',
        ])->assertStatus(422);

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
        ])->assertStatus(422);

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
        ])->assertStatus(422);

        $this->assertSame(0, ZoneDeliveryConfig::count());
    }

    public function test_zero_values_and_zero_free_parcel_fee_are_valid_and_complete(): void
    {
        $this->makeAdmin();

        $url = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";

        $this->putJson($url, [
            'module' => 'food',
            'delivery_mode' => 'standard',
            'delivery_fee_per_km' => 0,
            'delivery_fee_paid_by_admin_per_km' => 0,
            'free_delivery_above' => 0,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => 0,
            'partner_free_distance_earning' => 0,
            'packaging_charge' => 0,
            'handling_fee' => 0,
        ])->assertOk();

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => 0,
            'packaging_charge' => 0,
            'handling_fee' => 0,
        ])->assertOk();

        $this->getJson($url)
            ->assertOk()
            ->assertJsonPath('data.configs.food.configured', true)
            ->assertJsonPath('data.configs.food.values.delivery_fee_per_km', 0)
            ->assertJsonPath('data.configs.grocery_scheduled.configured', true)
            ->assertJsonPath('data.configs.grocery_scheduled.values.admin_fee_per_parcel', 0);

        $this->assertEqualsWithDelta(
            0.0,
            (float) ZoneDeliveryConfig::where([
                'zone_id' => $this->zoneA->id,
                'module' => 'food',
                'delivery_mode' => 'standard',
            ])->value('delivery_fee_per_km'),
            0.001
        );

        // Zero is a real value in pricing, not an "unset" marker.
        $foodSettings = app(DeliveryFeeService::class)->settings('food', $this->zoneA);
        $this->assertEqualsWithDelta(0.0, $foodSettings['per_km'], 0.001);

        $scheduled = app(GroceryDeliveryConfigService::class)->resolve('scheduled', $this->zoneA);
        $this->assertSame('free', $scheduled['scheduled_delivery_type']);
        $this->assertEqualsWithDelta(0.0, $scheduled['admin_per_parcel'], 0.001);
    }

    public function test_switching_scheduled_type_preserves_the_hidden_fields(): void
    {
        $this->makeAdmin();

        $url = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => 15,
            'packaging_charge' => 4,
            'handling_fee' => 2,
        ])->assertOk();

        // Switching to Chargeable sends only the Chargeable fields. The hidden
        // per-parcel amount must survive for a later switch back to Free.
        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'chargeable',
            'delivery_fee_per_km' => 10,
            'delivery_fee_paid_by_admin_per_km' => 2,
            'free_delivery_km' => 3,
            'delivery_gst_percent' => 12,
            'packaging_charge' => 6,
            'handling_fee' => 1,
        ])->assertOk();

        $row = ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
        ])->firstOrFail();

        $this->assertSame('chargeable', $row->delivery_type);
        $this->assertEqualsWithDelta(15.0, (float) $row->admin_fee_per_parcel, 0.001);

        // Switching back to Free must not erase the Chargeable values.
        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => 25,
        ])->assertOk();

        $row->refresh();

        $this->assertSame('free', $row->delivery_type);
        $this->assertEqualsWithDelta(25.0, (float) $row->admin_fee_per_parcel, 0.001);
        $this->assertEqualsWithDelta(10.0, (float) $row->delivery_fee_per_km, 0.001);
        $this->assertEqualsWithDelta(12.0, (float) $row->delivery_gst_percent, 0.001);
        $this->assertEqualsWithDelta(6.0, (float) $row->packaging_charge, 0.001);
    }

    public function test_partial_scheduled_update_keeps_the_saved_type_and_parcel_fee(): void
    {
        $this->makeAdmin();

        $url = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => 15,
            'packaging_charge' => 4,
        ])->assertOk();

        // Omitting delivery_type and admin_fee_per_parcel keeps both saved values.
        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'packaging_charge' => 8,
        ])->assertOk()
            ->assertJsonPath('data.values.delivery_type', 'free')
            ->assertJsonPath('data.values.admin_fee_per_parcel', 15)
            ->assertJsonPath('data.values.packaging_charge', 8);

        $row = ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
        ])->firstOrFail();

        $this->assertSame(ZoneDeliveryConfig::TYPE_FREE, $row->delivery_type);
        $this->assertEqualsWithDelta(15.0, (float) $row->admin_fee_per_parcel, 0.001);
        $this->assertEqualsWithDelta(8.0, (float) $row->packaging_charge, 0.001);

        // Free Delivery cannot clear its required per-parcel amount.
        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => null,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('admin_fee_per_parcel');

        $this->assertEqualsWithDelta(15.0, (float) $row->fresh()->admin_fee_per_parcel, 0.001);
    }

    public function test_explicit_null_clears_an_optional_field(): void
    {
        $this->makeAdmin();

        $url = "/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs";

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'chargeable',
            'free_delivery_above' => 500,
            'free_delivery_km' => 2,
        ])->assertOk();

        $this->putJson($url, [
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
            'delivery_type' => 'chargeable',
            'free_delivery_above' => null,
            'free_delivery_km' => null,
        ])->assertOk()
            ->assertJsonPath('data.values.free_delivery_above', null)
            ->assertJsonPath('data.values.free_delivery_km', null);

        $row = ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'grocery',
            'delivery_mode' => 'scheduled',
        ])->firstOrFail();

        $this->assertNull($row->free_delivery_above);
        $this->assertNull($row->free_delivery_km);
    }

    public function test_backfill_is_idempotent_and_reports_setup_required_zones(): void
    {
        $this->makeAdmin();

        $this->getJson('/api/v1/admin/zones/delivery-config-status')
            ->assertOk()
            ->assertJsonPath('data.missing_count', 2)
            ->assertJsonCount(2, 'data.zones')
            ->assertJsonPath('data.zones.0.missing', ['food', 'grocery_instant', 'grocery_scheduled']);

        // A dry run reports what would be created without writing anything.
        $this->postJson('/api/v1/admin/zones/delivery-config-backfill', ['dry_run' => true])
            ->assertOk()
            ->assertJsonPath('data.dry_run', true)
            ->assertJsonPath('data.zones', 2)
            ->assertJsonPath('data.created', 6);

        $this->assertDatabaseCount('zone_delivery_configs', 0);

        $this->postJson('/api/v1/admin/zones/delivery-config-backfill', ['dry_run' => false])
            ->assertOk()
            ->assertJsonPath('data.created', 6)
            ->assertJsonPath('data.existing', 0);

        $this->assertDatabaseCount('zone_delivery_configs', 6);

        $this->getJson('/api/v1/admin/zones/delivery-config-status')
            ->assertOk()
            ->assertJsonPath('data.missing_count', 0);

        // Admin edits are never overwritten by a repeated backfill.
        ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'food',
            'delivery_mode' => 'standard',
        ])->update(['delivery_fee_per_km' => 42]);

        $this->postJson('/api/v1/admin/zones/delivery-config-backfill', ['dry_run' => false])
            ->assertOk()
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.existing', 6)
            ->assertJsonPath('data.incomplete_existing', 0);

        $this->assertDatabaseCount('zone_delivery_configs', 6);
        $this->assertEqualsWithDelta(42.0, (float) ZoneDeliveryConfig::where([
            'zone_id' => $this->zoneA->id,
            'module' => 'food',
            'delivery_mode' => 'standard',
        ])->value('delivery_fee_per_km'), 0.001);
    }

    public function test_unsaved_scheduled_config_shows_the_global_scheduled_type_as_reference(): void
    {
        $this->setSetting('grocery_scheduled_delivery_type', 'free');
        $this->makeAdmin();

        $this->getJson("/api/v1/admin/zones/{$this->zoneA->id}/delivery-configs")
            ->assertOk()
            ->assertJsonPath('data.configs.grocery_scheduled.configured', false)
            ->assertJsonPath('data.configs.grocery_scheduled.values.delivery_type', 'free')
            ->assertJsonPath('data.configs.grocery_scheduled.global.delivery_type', 'free');
    }

    public function test_zone_list_counts_only_complete_configurations(): void
    {
        $this->makeAdmin();

        ZoneDeliveryConfig::create([
            'zone_id' => $this->zoneA->id,
            'module' => ZoneDeliveryConfig::MODULE_FOOD,
            'delivery_mode' => ZoneDeliveryConfig::MODE_STANDARD,
            'delivery_fee_per_km' => 5,
        ]);

        // Saved but incomplete: a Free Scheduled row with no per-parcel amount.
        ZoneDeliveryConfig::create([
            'zone_id' => $this->zoneA->id,
            'module' => ZoneDeliveryConfig::MODULE_GROCERY,
            'delivery_mode' => ZoneDeliveryConfig::MODE_SCHEDULED,
            'delivery_type' => ZoneDeliveryConfig::TYPE_FREE,
            'admin_fee_per_parcel' => null,
        ]);

        $this->getJson('/api/v1/admin/zones?search=Zone%20A&per_page=50')
            ->assertOk()
            ->assertJsonPath('data.data.0.name', 'Zone A')
            ->assertJsonPath('data.data.0.delivery_configs_count', 1)
            ->assertJsonPath('data.data.0.food_delivery_configs_count', 1)
            ->assertJsonPath('data.data.0.grocery_instant_delivery_configs_count', 0)
            ->assertJsonPath('data.data.0.grocery_scheduled_delivery_configs_count', 0);
    }

    public function test_food_orders_are_priced_from_the_destination_zone_not_the_client(): void
    {
        $this->configureFoodDefaults();
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 7, handling: 3);
        $this->configureZoneFood($this->zoneB, perKm: 50, adminPerKm: 9, earning: 15, gst: 12, packaging: 2, handling: 1);

        [$vendorA, $productA] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);
        [$vendorB, $productB] = $this->makeFoodVendor($this->zoneB, self::B_LAT, self::B_LNG);

        $customerA = $this->makeCustomer();
        $addressA = $this->makeAddress($customerA, 12.9800, 77.6000);
        $this->makeFoodCart($customerA, $vendorA, $productA);
        $orderA = app(OrderService::class)->createOrder($customerA, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $addressA->id,
            // A spoofed client zone must be ignored in favour of the address.
            'zone_id' => $this->zoneB->id,
        ])->fresh();

        $distanceA = app(DeliveryFeeService::class)->distanceKm(self::A_LAT, self::A_LNG, 12.9800, 77.6000);
        $this->assertSame($this->zoneA->id, $orderA->drop_zone_id);
        $this->assertEqualsWithDelta(round($distanceA * 20, 2), (float) $orderA->delivery_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $orderA->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(7.0, (float) $orderA->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(3.0, (float) $orderA->handling_fee, 0.01);
        $this->assertSame($this->zoneA->id, $orderA->meta['delivery_pricing']['zone_id']);
        $this->assertSame('Zone A', $orderA->meta['delivery_pricing']['zone_name']);
        $this->assertSame('zone', $orderA->meta['delivery_pricing']['config_source']);
        $this->assertSame('food', $orderA->meta['delivery_pricing']['module']);

        $customerB = $this->makeCustomer();
        $addressB = $this->makeAddress($customerB, 13.0550, 77.6550);
        $this->makeFoodCart($customerB, $vendorB, $productB);
        $orderB = app(OrderService::class)->createOrder($customerB, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $addressB->id,
        ])->fresh();

        $distanceB = app(DeliveryFeeService::class)->distanceKm(self::B_LAT, self::B_LNG, 13.0550, 77.6550);
        $this->assertSame($this->zoneB->id, $orderB->drop_zone_id);
        $this->assertEqualsWithDelta(round($distanceB * 50, 2), (float) $orderB->delivery_fee, 0.01);
        $this->assertEqualsWithDelta(12.0, (float) $orderB->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(2.0, (float) $orderB->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(1.0, (float) $orderB->handling_fee, 0.01);
    }

    public function test_an_order_outside_every_zone_is_rejected(): void
    {
        $this->configureFoodDefaults();
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 13.5000, 78.5000);
        $this->makeFoodCart($customer, $vendor, $product);

        $this->expectExceptionMessage('Delivery address is outside the store service area');

        app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ]);
    }

    public function test_grocery_instant_and_scheduled_use_their_own_zone_configs(): void
    {
        $this->configureGroceryInstant($this->zoneA, 10, 2, 5);
        $this->configureGroceryScheduledChargeable($this->zoneA, 30, 6, 12, 8, 2);

        [$vendor, $store, $product] = $this->makeGroceryVendor($this->zoneA);

        $instantCustomer = $this->makeCustomer();
        $instantAddress = $this->makeAddress($instantCustomer, 12.9800, 77.6000);
        $this->makeGroceryCart($instantCustomer, $vendor, $store, $product, 'instant');
        $instant = app(OrderService::class)->createOrder($instantCustomer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $instantAddress->id,
        ])->fresh();

        $distance = app(DeliveryFeeService::class)->distanceKm(12.9800, 77.6000, self::A_LAT, self::A_LNG);

        // Instant has no packaging/handling in its configuration.
        $this->assertEqualsWithDelta(round($distance * 10, 2), (float) $instant->delivery_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $instant->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(0.0, (float) $instant->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $instant->handling_fee, 0.001);
        $this->assertSame('instant', $instant->meta['delivery_pricing']['delivery_mode']);
        $this->assertSame('zone', $instant->meta['delivery_pricing']['config_source']);

        $scheduledCustomer = $this->makeCustomer();
        $scheduledAddress = $this->makeAddress($scheduledCustomer, 12.9800, 77.6000);
        $slot = $this->makeSlot($vendor, $store);
        $this->makeGroceryCart($scheduledCustomer, $vendor, $store, $product, 'scheduled');
        $scheduled = app(OrderService::class)->createOrder($scheduledCustomer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $scheduledAddress->id,
            'delivery_slot_id' => $slot->id,
        ])->fresh();

        $distance = app(DeliveryFeeService::class)->distanceKm(12.9800, 77.6000, self::A_LAT, self::A_LNG);

        $this->assertEqualsWithDelta(round($distance * 30, 2), (float) $scheduled->delivery_fee, 0.01);
        $this->assertEqualsWithDelta(12.0, (float) $scheduled->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(8.0, (float) $scheduled->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(2.0, (float) $scheduled->handling_fee, 0.01);
        $this->assertSame('scheduled', $scheduled->meta['delivery_pricing']['delivery_mode']);
        $this->assertSame('chargeable', $scheduled->meta['delivery_pricing']['scheduled_delivery_type']);
        $this->assertSame('zone', $scheduled->meta['delivery_pricing']['config_source']);

        // The two modes never leak into each other.
        $this->assertSame('instant', $instant->meta['delivery_pricing']['delivery_mode']);
        $this->assertNotEquals((float) $instant->delivery_fee, (float) $scheduled->delivery_fee);
    }

    public function test_scheduled_free_funds_the_partner_per_parcel_and_is_snapshotted(): void
    {
        $this->configureGroceryScheduledFree($this->zoneA, adminPerParcel: 40, packaging: 20, handling: 5);

        [$vendor, $store, $product] = $this->makeGroceryVendor($this->zoneA);
        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);
        $slot = $this->makeSlot($vendor, $store);
        $this->makeGroceryCart($customer, $vendor, $store, $product, 'scheduled');
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
            'delivery_slot_id' => $slot->id,
        ])->fresh();

        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(20.0, (float) $order->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $order->handling_fee, 0.01);
        $this->assertSame('free', $order->meta['delivery_pricing']['scheduled_delivery_type']);
        $this->assertEqualsWithDelta(40.0, (float) $order->meta['delivery_pricing']['admin_delivery_cost'], 0.01);

        $earning = app(DeliveryFeeService::class)->partnerEarningForOrder(
            $order,
            'grocery',
            (float) $order->delivery_fee,
            app(GroceryDeliveryConfigService::class)->adminFundedAmountForOrder($order),
        );
        $this->assertEqualsWithDelta(40.0, $earning['amount'], 0.01);
    }

    public function test_zone_partner_earnings_are_frozen_on_the_order(): void
    {
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);
        $this->makeFoodCart($customer, $vendor, $product);
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $fees = app(DeliveryFeeService::class);
        $distance = (float) $order->meta['delivery_pricing']['distance_km'];
        $fee = (float) $order->delivery_fee;
        $earning = $fees->partnerEarningForOrder($order, 'food', $fee);

        $this->assertEqualsWithDelta($fee + 11 + round($distance * 4, 2), $earning['amount'], 0.01);

        // Changing the zone afterwards must not move this order's earning.
        $this->configureZoneFood($this->zoneA, perKm: 99, adminPerKm: 99, earning: 99, gst: 5, packaging: 0, handling: 0);
        $unchanged = $fees->partnerEarningForOrder($order->fresh(), 'food', $fee);

        $this->assertEqualsWithDelta($earning['amount'], $unchanged['amount'], 0.01);
        $this->assertSame($earning['breakdown']['per_km_key'], $unchanged['breakdown']['per_km_key']);
    }

    public function test_missing_zone_configuration_returns_actionable_422_at_checkout(): void
    {
        $zoneC = $this->makeZone('Zone C', 13.2000, 77.8000, 5);
        [$vendor, $product] = $this->makeFoodVendor($zoneC, 13.2000, 77.8000);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 13.2050, 77.8050);
        $this->makeFoodCart($customer, $vendor, $product);

        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/orders', [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'Delivery pricing is not configured for this area (Zone C) yet. Please contact support.'
            );
    }

    public function test_zone_orders_freeze_their_partner_rate(): void
    {
        // With mandatory zone configuration, global values are not used.
        // The order must be priced from the zone configuration.
        $this->configureFoodDefaults(perKm: 5, gst: 18, packaging: 0, handling: 0);
        $this->setSetting('food_delivery_fee_paid_by_admin_per_km', '4');
        $this->setSetting('food_partner_free_distance_earning', '11');
        $this->setSetting('food_free_delivery_km', '0');

        $zoneC = $this->makeZone('Zone C', 13.2000, 77.8000, 5);
        $this->configureZoneFood($zoneC, perKm: 5, adminPerKm: 4, earning: 11, gst: 18, packaging: 0, handling: 0);

        [$vendor, $product] = $this->makeFoodVendor($zoneC, 13.2000, 77.8000);
        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 13.2050, 77.8050);
        $this->makeFoodCart($customer, $vendor, $product);
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $this->assertSame('zone', $order->meta['delivery_pricing']['config_source']);

        $fees = app(DeliveryFeeService::class);
        $fee = (float) $order->delivery_fee;
        $before = $fees->partnerEarningForOrder($order, 'food', $fee);

        // Adding a zone configuration afterwards must not rewrite history.
        $this->configureZoneFood($zoneC, perKm: 5, adminPerKm: 99, earning: 99, gst: 18, packaging: 0, handling: 0);
        $after = $fees->partnerEarningForOrder($order->fresh(), 'food', $fee);

        $this->assertEqualsWithDelta($before['amount'], $after['amount'], 0.001);
        $this->assertSame('food_delivery_fee_paid_by_admin_per_km', $after['breakdown']['per_km_key']);
        $this->assertEqualsWithDelta(4.0, (float) $after['breakdown']['per_km'], 0.001);
    }

    public function test_a_zone_without_a_saved_row_fails_with_an_actionable_error(): void
    {
        // Mandatory: a zone without a complete configuration cannot be priced.
        $this->configureFoodDefaults(perKm: 5, gst: 18, packaging: 2, handling: 1);

        $zoneC = $this->makeZone('Zone C', 13.2000, 77.8000, 5);

        $this->expectException(DeliveryConfigurationException::class);
        $this->expectExceptionMessage('Zone C');

        app(DeliveryFeeService::class)->calculate('food', 200, 5.0, $zoneC);
    }

    public function test_a_changed_zone_config_is_not_silently_charged_to_an_existing_quote(): void
    {
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);

        // Price the cart exactly as the cart API would, then save the quote.
        $cart = $this->makeFoodCart($customer, $vendor, $product);
        $distance = app(DeliveryFeeService::class)->distanceKm(self::A_LAT, self::A_LNG, 12.9800, 77.6000);
        $quoteFee = app(DeliveryFeeService::class)->calculate('food', 400, $distance, $this->zoneA);
        $cart->update([
            'delivery_fee' => $quoteFee,
            'delivery_gst_percent' => 5,
            'delivery_gst_amount' => round($quoteFee * 0.05, 2),
            'pricing_quote' => [
                'version' => 1,
                'delivery_fee' => $quoteFee,
                'delivery_gst_amount' => round($quoteFee * 0.05, 2),
                'packaging_fee' => 0,
                'handling_fee' => 0,
            ],
        ]);

        // Admin changes the zone before checkout.
        $this->configureZoneFood($this->zoneA, perKm: 40, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);

        $this->expectException(DeliveryConfigurationException::class);
        $this->expectExceptionMessage('Delivery charges changed since your cart was updated');

        app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ]);
    }

    public function test_order_prices_authoritatively_when_the_cart_quote_required_an_address(): void
    {
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);
        $cart = $this->makeFoodCart($customer, $vendor, $product);

        $cart->update([
            'delivery_fee' => 0,
            'delivery_gst_percent' => 0,
            'delivery_gst_amount' => 0,
            'pricing_quote' => [
                'version' => 1,
                'requires_delivery_address' => true,
                'delivery_fee' => 0,
                'delivery_gst_amount' => 0,
                'packaging_fee' => 0,
                'handling_fee' => 0,
            ],
        ]);

        $distance = app(DeliveryFeeService::class)->distanceKm(self::A_LAT, self::A_LNG, 12.9800, 77.6000);

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $this->assertSame($this->zoneA->id, $order->drop_zone_id);
        $this->assertEqualsWithDelta(round($distance * 20, 2), (float) $order->delivery_fee, 0.01);
        $this->assertSame('zone', $order->meta['delivery_pricing']['config_source']);
    }

    public function test_payment_keeps_the_frozen_order_price_after_a_zone_change(): void
    {
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);
        $this->makeFoodCart($customer, $vendor, $product);
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'upi',
            'address_id' => $address->id,
        ])->fresh();

        $pricedTotal = (float) $order->total_amount;

        // A later admin edit must not reprice an order that is already placed.
        $this->configureZoneFood($this->zoneA, perKm: 90, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);

        $payment = app(PaymentService::class)->initiatePayable($customer, $order->fresh(), 'upi');

        $this->assertSame((int) round($pricedTotal * 100), (int) $payment->amount_paise);
    }

    public function test_payment_rejects_an_order_whose_delivery_amount_no_longer_matches_its_snapshot(): void
    {
        $this->configureZoneFood($this->zoneA, perKm: 20, adminPerKm: 4, earning: 11, gst: 5, packaging: 0, handling: 0);
        [$vendor, $product] = $this->makeFoodVendor($this->zoneA, self::A_LAT, self::A_LNG);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer, 12.9800, 77.6000);
        $this->makeFoodCart($customer, $vendor, $product);
        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'food',
            'payment_method' => 'upi',
            'address_id' => $address->id,
        ])->fresh();

        $order->update(['delivery_fee' => (float) $order->delivery_fee + 10]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Order delivery pricing is inconsistent');

        app(PaymentService::class)->initiatePayable($customer, $order->fresh(), 'upi');
    }

    // ------------------------------------------------------------------
    // helpers
    // ------------------------------------------------------------------

    private function makeZone(string $name, float $lat, float $lng, int $priority): Zone
    {
        return Zone::create([
            'name' => $name,
            'code' => 'ZONE-'.Str::upper(Str::random(6)),
            'type' => 'multi',
            'country' => 'IN',
            'food_enabled' => true,
            'grocery_enabled' => true,
            'ride_enabled' => false,
            'priority' => $priority,
            'center_latitude' => $lat,
            'center_longitude' => $lng,
            'radius_km' => 3,
            'polygon' => [
                ['lat' => $lat - 0.03, 'lng' => $lng - 0.03],
                ['lat' => $lat - 0.03, 'lng' => $lng + 0.03],
                ['lat' => $lat + 0.03, 'lng' => $lng + 0.03],
                ['lat' => $lat + 0.03, 'lng' => $lng - 0.03],
            ],
            'is_active' => true,
        ]);
    }

    private function makeAdmin(): User
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);

        $admin = User::factory()->create([
            'user_type' => 'super_admin',
            'is_active' => true,
        ]);
        $admin->roles()->sync([$role->id]);
        Sanctum::actingAs($admin);

        return $admin;
    }

    private function makeCustomer(): User
    {
        return User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
    }

    private function makeAddress(User $user, float $lat, float $lng): Address
    {
        return Address::create([
            'user_id' => $user->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '9'.random_int(100000000, 999999999),
            'address_line_1' => '12, Main Road',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'country' => 'IN',
            'latitude' => $lat,
            'longitude' => $lng,
            'type' => 'home',
            'is_default' => true,
        ]);
    }

    /**
     * @return array{0: Vendor, 1: Product}
     */
    private function makeFoodVendor(Zone $zone, float $lat, float $lng): array
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Kitchen '.Str::random(5),
            'owner_name' => 'Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => $lat,
            'longitude' => $lng,
            'zone_id' => $zone->id,
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'name' => 'Burger '.Str::random(6),
            'slug' => 'burger-'.Str::lower(Str::random(8)),
            'sku' => 'SKU_'.Str::upper(Str::random(8)),
            'price' => 100,
            'type' => 'food',
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);

        return [$vendor, $product];
    }

    private function makeFoodCart(User $user, Vendor $vendor, Product $product): Cart
    {
        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'food',
            'vendor_id' => $vendor->id,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 0,
            'total' => 0,
            'items_count' => 0,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 4,
            'line_total' => 400,
        ]);

        return $cart;
    }

    /**
     * @return array{0: Vendor, 1: Store, 2: Product}
     */
    private function makeGroceryVendor(Zone $zone): array
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Mart '.Str::random(5),
            'owner_name' => 'Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'grocery',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => self::A_LAT,
            'longitude' => self::A_LNG,
            'zone_id' => $zone->id,
        ]);

        $store = Store::create([
            'vendor_id' => $vendor->id,
            'name' => 'Mart '.Str::random(5),
            'slug' => 'mart-'.Str::lower(Str::random(8)),
            'store_type' => 'supermarket',
            'latitude' => self::A_LAT,
            'longitude' => self::A_LNG,
            'is_open' => true,
            'is_featured' => false,
            'order_type' => 'both',
        ]);

        $product = Product::create([
            'vendor_id' => $vendor->id,
            'store_id' => $store->id,
            'name' => 'Groceries '.Str::random(6),
            'slug' => 'grocery-'.Str::lower(Str::random(8)),
            'sku' => 'SKU_'.Str::upper(Str::random(8)),
            'price' => 120,
            'type' => 'grocery',
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);

        return [$vendor, $store, $product];
    }

    private function makeGroceryCart(User $user, Vendor $vendor, Store $store, Product $product, string $mode): Cart
    {
        $cart = Cart::create([
            'user_id' => $user->id,
            'cart_type' => 'grocery',
            'vendor_id' => $vendor->id,
            'delivery_mode' => $mode,
            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 0,
            'total' => 0,
            'items_count' => 0,
        ]);

        CartItem::create([
            'cart_id' => $cart->id,
            'product_id' => $product->id,
            'unit_price' => $product->price,
            'quantity' => 2,
            'line_total' => 240,
        ]);

        return $cart;
    }

    private function makeSlot(Vendor $vendor, Store $store): DeliverySlot
    {
        return DeliverySlot::create([
            'vendor_id' => $vendor->id,
            'store_id' => $store->id,
            'slot_date' => Carbon::now('Asia/Kolkata')->addDay()->format('Y-m-d'),
            'start_time' => '10:00:00',
            'end_time' => '12:00:00',
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 0,
            'is_active' => true,
        ]);
    }

    private function configureFoodDefaults(
        float $perKm = 5,
        float $gst = 18,
        float $packaging = 0,
        float $handling = 0
    ): void {
        $this->setSetting('food_delivery_fee_per_km', (string) $perKm);
        $this->setSetting('food_free_delivery_above', '');
        $this->setSetting('food_free_delivery_km', '0');
        $this->setSetting('food_delivery_gst_percent', (string) $gst);
        $this->setSetting('food_delivery_packaging_charge', (string) $packaging);
        $this->setSetting('food_delivery_handling_fee', (string) $handling);
    }

    private function configureZoneFood(
        Zone $zone,
        float $perKm,
        float $adminPerKm,
        float $earning,
        float $gst,
        float $packaging,
        float $handling
    ): void {
        app(ZoneDeliveryConfigService::class)->upsert($zone, 'food', 'standard', [
            'delivery_fee_per_km' => $perKm,
            'delivery_fee_paid_by_admin_per_km' => $adminPerKm,
            'free_delivery_above' => null,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => $gst,
            'partner_free_distance_earning' => $earning,
            'packaging_charge' => $packaging,
            'handling_fee' => $handling,
        ]);
    }

    private function configureGroceryInstant(Zone $zone, float $perKm, float $adminPerKm, float $gst): void
    {
        app(ZoneDeliveryConfigService::class)->upsert($zone, 'grocery', 'instant', [
            'delivery_fee_per_km' => $perKm,
            'delivery_fee_paid_by_admin_per_km' => $adminPerKm,
            'free_delivery_above' => null,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => $gst,
            'partner_free_distance_earning' => 20,
        ]);
    }

    private function configureGroceryScheduledChargeable(
        Zone $zone,
        float $perKm,
        float $adminPerKm,
        float $gst,
        float $packaging,
        float $handling
    ): void {
        app(ZoneDeliveryConfigService::class)->upsert($zone, 'grocery', 'scheduled', [
            'delivery_type' => 'chargeable',
            'delivery_fee_per_km' => $perKm,
            'delivery_fee_paid_by_admin_per_km' => $adminPerKm,
            'free_delivery_above' => null,
            'free_delivery_km' => 0,
            'delivery_gst_percent' => $gst,
            'packaging_charge' => $packaging,
            'handling_fee' => $handling,
        ]);
    }

    private function configureGroceryScheduledFree(
        Zone $zone,
        float $adminPerParcel,
        float $packaging,
        float $handling
    ): void {
        app(ZoneDeliveryConfigService::class)->upsert($zone, 'grocery', 'scheduled', [
            'delivery_type' => 'free',
            'admin_fee_per_parcel' => $adminPerParcel,
            'packaging_charge' => $packaging,
            'handling_fee' => $handling,
        ]);
    }

    private function setSetting(string $key, string $value): void
    {
        AppSetting::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'group' => 'delivery', 'label' => $key, 'type' => 'text']
        );
    }
}
