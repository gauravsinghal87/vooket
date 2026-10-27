<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\AppSetting;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\DeliverySlot;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\Role;
use App\Models\Store;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WalletTransaction;
use App\Services\OrderService;
use App\Services\Pricing\DeliveryFeeService;
use App\Services\Pricing\GroceryDeliveryConfigService;
use Database\Seeders\ConfigurationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Instant and Scheduled Grocery Delivery are two independent configurations.
 *
 * The scheduled keys are stored in their own settings group and resolved through
 * GroceryDeliveryConfigService, so an edit to one mode can never move the other,
 * and every order keeps the values it was priced with.
 */
class GroceryScheduledDeliveryPricingTest extends TestCase
{
    use RefreshDatabase;

    private const VENDOR_LAT = 12.9716;

    private const VENDOR_LNG = 77.5946;

    /** Delivery address ~7 km from the vendor, well outside a 2 km allowance. */
    private const ADDRESS_LAT = 13.0350;

    private const ADDRESS_LNG = 77.5946;

    private Role $vendorRole;

    private Vendor $vendor;

    private Store $store;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-05 04:00:00', 'UTC'));

        $this->seed(ConfigurationSeeder::class);

        $this->vendorRole = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);

        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($this->vendorRole->id);

        $this->vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'FreshMart',
            'owner_name' => 'FreshMart Owner',
            'email' => 'freshmart@example.com',
            'phone' => '9898912345',
            'vendor_type' => 'grocery',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => self::VENDOR_LAT,
            'longitude' => self::VENDOR_LNG,
        ]);

        $this->store = Store::create([
            'vendor_id' => $this->vendor->id,
            'name' => 'FreshMart Supermarket',
            'slug' => 'freshmart-'.uniqid(),
            'store_type' => 'supermarket',
            'order_type' => 'both',
            'is_open' => true,
            'is_active' => true,
            'supports_instant_delivery' => true,
            'supports_scheduled_delivery' => true,
        ]);
    }

    public function test_seeder_creates_the_scheduled_group_without_duplicating_the_instant_group(): void
    {
        $scheduled = AppSetting::where('group', GroceryDeliveryConfigService::GROUP)->pluck('key');

        foreach (GroceryDeliveryConfigService::SCHEDULED_KEYS as $key) {
            $this->assertContains($key, $scheduled);
        }

        $this->assertCount(count(GroceryDeliveryConfigService::SCHEDULED_KEYS), $scheduled);

        // The Instant keys are untouched and still live in their own group.
        $instant = AppSetting::where('group', 'grocery_delivery')->pluck('key');

        $this->assertNotContains(GroceryDeliveryConfigService::TYPE_KEY, $instant);

        // Re-seeding must not create a second copy of a scheduled setting.
        $this->seed(ConfigurationSeeder::class);

        $this->assertSame(
            count(GroceryDeliveryConfigService::SCHEDULED_KEYS),
            AppSetting::where('group', GroceryDeliveryConfigService::GROUP)->count()
        );
    }

    public function test_seeder_does_not_overwrite_an_admin_edited_scheduled_value(): void
    {
        $this->setSetting('grocery_scheduled_delivery_fee_per_km', '12');

        $this->seed(ConfigurationSeeder::class);

        $this->assertSame('12', AppSetting::where('key', 'grocery_scheduled_delivery_fee_per_km')->value('value'));
    }

    public function test_scheduled_chargeable_uses_the_scheduled_configuration(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_CHARGEABLE);
        $this->setSetting('grocery_scheduled_delivery_fee_per_km', '9');
        $this->clearSetting('grocery_scheduled_free_delivery_above');
        $this->setSetting('grocery_scheduled_free_delivery_km', '0');
        $this->setSetting('grocery_scheduled_delivery_gst_percent', '18');
        $this->setSetting('grocery_scheduled_packaging_charge', '15');
        $this->setSetting('grocery_scheduled_handling_fee', '5');

        $order = $this->placeScheduledOrder();

        $distanceKm = $this->deliveryDistanceKm();
        $this->assertGreaterThan(5, $distanceKm);

        $this->assertEqualsWithDelta(round($distanceKm * 9, 2), (float) $order->delivery_fee, 0.02);
        $this->assertEqualsWithDelta(18.0, (float) $order->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(
            round((float) $order->delivery_fee * 0.18, 2),
            (float) $order->delivery_gst_amount,
            0.01
        );
        $this->assertEqualsWithDelta(15.0, (float) $order->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(5.0, (float) $order->handling_fee, 0.01);

        $this->assertEqualsWithDelta(
            round($order->subtotal + $order->delivery_fee + $order->delivery_gst_amount + 15 + 5, 2),
            (float) $order->total_amount,
            0.02
        );

        $this->assertSame(GroceryDeliveryConfigService::MODE_SCHEDULED, $order->meta['delivery_pricing']['delivery_mode']);
        $this->assertSame(GroceryDeliveryConfigService::TYPE_CHARGEABLE, $order->meta['delivery_pricing']['scheduled_delivery_type']);
        $this->assertSame(
            'grocery_scheduled_delivery_fee_per_km',
            $order->meta['delivery_pricing']['setting_keys']['per_km']
        );
        $this->assertSame('per_km', $order->meta['delivery_pricing']['admin_delivery_cost_basis']);
    }

    public function test_scheduled_free_charges_the_customer_no_delivery_amount(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');
        $this->setSetting('grocery_scheduled_free_delivery_packaging_charge', '12');
        $this->setSetting('grocery_scheduled_free_delivery_handling_fee', '4');
        // Chargeable values that must be ignored entirely in free mode.
        $this->setSetting('grocery_scheduled_delivery_fee_per_km', '25');
        $this->setSetting('grocery_scheduled_delivery_gst_percent', '18');

        $order = $this->placeScheduledOrder();

        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_gst_amount, 0.001);
        $this->assertEqualsWithDelta(12.0, (float) $order->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(4.0, (float) $order->handling_fee, 0.01);

        $this->assertEqualsWithDelta(
            round($order->subtotal + 12 + 4, 2),
            (float) $order->total_amount,
            0.02
        );

        $snapshot = $order->meta['delivery_pricing'];
        $this->assertSame(GroceryDeliveryConfigService::TYPE_FREE, $snapshot['scheduled_delivery_type']);
        $this->assertEqualsWithDelta(30.0, (float) $snapshot['admin_delivery_cost'], 0.01);
        $this->assertSame('per_parcel', $snapshot['admin_delivery_cost_basis']);
        $this->assertArrayNotHasKey('per_km', $snapshot['setting_keys']);
    }

    public function test_editing_scheduled_settings_does_not_move_instant_grocery(): void
    {
        $this->setSetting('grocery_delivery_fee_per_km', '10');
        $this->clearSetting('grocery_free_delivery_above');
        $this->setSetting('grocery_free_delivery_km', '0');
        $this->setSetting('grocery_delivery_gst_percent', '5');

        $distanceKm = $this->deliveryDistanceKm();
        $instant = $this->placeInstantOrder();

        // Then change only the scheduled configuration.
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '40');
        $this->setSetting('grocery_scheduled_free_delivery_packaging_charge', '20');

        $scheduled = $this->placeScheduledOrder();

        $this->assertEqualsWithDelta(round($distanceKm * 10, 2), (float) $instant->delivery_fee, 0.02);
        $this->assertEqualsWithDelta(5.0, (float) $instant->delivery_gst_percent, 0.01);
        $this->assertEqualsWithDelta(0.0, (float) $instant->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $instant->handling_fee, 0.001);

        $this->assertEqualsWithDelta(0.0, (float) $scheduled->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(20.0, (float) $scheduled->packaging_fee, 0.01);

        $this->assertSame(GroceryDeliveryConfigService::MODE_INSTANT, $instant->meta['delivery_pricing']['delivery_mode']);
        $this->assertSame(
            'grocery_delivery_fee_per_km',
            $instant->meta['delivery_pricing']['setting_keys']['per_km']
        );
    }

    public function test_a_historical_order_keeps_its_own_pricing_and_earning(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');

        $order = $this->placeScheduledOrder();

        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(30.0, (float) $order->meta['delivery_pricing']['admin_delivery_cost'], 0.01);

        // The admin moves the funding to a different model afterwards.
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_CHARGEABLE);
        $this->setSetting('grocery_scheduled_delivery_fee_paid_by_admin_per_km', '1');
        $this->setSetting('grocery_scheduled_delivery_fee_per_km', '7');

        $refetched = $order->fresh();

        $this->assertEqualsWithDelta(0.0, (float) $refetched->delivery_fee, 0.001);
        $this->assertSame(GroceryDeliveryConfigService::TYPE_FREE, $refetched->meta['delivery_pricing']['scheduled_delivery_type']);
        $this->assertEqualsWithDelta(30.0, (float) $refetched->meta['delivery_pricing']['admin_delivery_cost'], 0.01);
        $this->assertEqualsWithDelta(30.0, $this->groceryAdminFundedAmount($refetched), 0.01);
    }

    public function test_scheduled_free_funds_the_partner_per_parcel_instead_of_per_km(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');

        $order = $this->placeScheduledOrder();
        $distanceKm = $this->deliveryDistanceKm();

        // Without the frozen per-parcel amount the partner would be paid per km.
        $this->setSetting('grocery_scheduled_delivery_fee_paid_by_admin_per_km', '5');

        $amount = app(DeliveryFeeService::class)->partnerEarning(
            'grocery',
            $distanceKm,
            (float) $order->delivery_fee,
            $this->groceryAdminFundedAmount($order->fresh())
        );

        $this->assertEqualsWithDelta(30.0, $amount['amount'], 0.01);
        $this->assertSame('customer_delivery_fee_plus_admin_funded_amount', $amount['breakdown']['basis']);
    }

    public function test_an_order_without_a_pricing_snapshot_keeps_the_per_km_earning(): void
    {
        $order = $this->placeInstantOrder();
        $order->forceFill(['meta' => null])->save();

        $this->assertNull($this->groceryAdminFundedAmount($order->fresh()));

        $amount = app(DeliveryFeeService::class)->partnerEarning(
            'grocery',
            $this->deliveryDistanceKm(),
            (float) $order->delivery_fee
        );

        // Without a frozen admin-funded amount the earning must fall back to the
        // standard per-km rule (fixed free-distance earning plus the Admin-funded
        // rate for the distance beyond the free allowance), never to the
        // Scheduled snapshot rule.
        $this->assertSame(
            'customer_delivery_fee_plus_free_distance_earning',
            $amount['breakdown']['basis']
        );
        $this->assertNotSame(
            'customer_delivery_fee_plus_admin_funded_amount',
            $amount['breakdown']['basis']
        );
    }

    public function test_grocery_cart_preview_follows_the_selected_delivery_mode(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');
        $this->setSetting('grocery_scheduled_free_delivery_packaging_charge', '12');
        $this->setSetting('grocery_scheduled_free_delivery_handling_fee', '4');
        $this->setSetting('grocery_delivery_fee_per_km', '10');
        $this->clearSetting('grocery_free_delivery_above');
        $this->setSetting('grocery_free_delivery_km', '0');
        $this->setSetting('grocery_delivery_gst_percent', '0');

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);

        // One cart, repriced as the customer switches mode in checkout.
        $cart = $this->makeGroceryCart($customer, GroceryDeliveryConfigService::MODE_INSTANT, $address->id);

        $instant = $this->recalculate($cart, GroceryDeliveryConfigService::MODE_INSTANT);
        $this->assertEqualsWithDelta(
            round($this->deliveryDistanceKm() * 10, 2),
            (float) $instant->delivery_fee,
            0.02
        );
        $this->assertEqualsWithDelta(0.0, (float) $instant->packaging_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $instant->handling_fee, 0.001);

        $scheduled = $this->recalculate($cart, GroceryDeliveryConfigService::MODE_SCHEDULED);
        $this->assertSame(GroceryDeliveryConfigService::MODE_SCHEDULED, $scheduled->delivery_mode);
        $this->assertEqualsWithDelta(0.0, (float) $scheduled->delivery_fee, 0.001);
        $this->assertEqualsWithDelta(0.0, (float) $scheduled->delivery_gst_amount, 0.001);
        $this->assertEqualsWithDelta(12.0, (float) $scheduled->packaging_fee, 0.01);
        $this->assertEqualsWithDelta(4.0, (float) $scheduled->handling_fee, 0.01);
        $this->assertEqualsWithDelta(
            round($scheduled->subtotal + 12 + 4, 2),
            (float) $scheduled->total,
            0.02
        );
    }

    public function test_the_customer_order_api_hides_the_admin_funded_amount(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');

        $order = $this->placeScheduledOrder();
        $customer = $order->user;

        // The stored snapshot must keep the amount that funds the partner.
        $this->assertEqualsWithDelta(
            30.0,
            (float) $order->fresh()->meta['delivery_pricing']['admin_delivery_cost'],
            0.01
        );

        Sanctum::actingAs($customer, ['*']);

        foreach (["/api/v1/orders/{$order->id}", '/api/v1/orders'] as $endpoint) {
            $payload = $this->getJson($endpoint)->assertOk()->json('data');

            $snapshot = $endpoint === '/api/v1/orders'
                ? $payload['data'][0]['meta']['delivery_pricing']
                : $payload['meta']['delivery_pricing'];

            $this->assertArrayNotHasKey('admin_delivery_cost', $snapshot);
            $this->assertArrayNotHasKey('resolved_settings', $snapshot);
            $this->assertArrayNotHasKey('setting_keys', $snapshot);
            $this->assertSame('scheduled', $snapshot['delivery_mode']);
            $this->assertSame('free', $snapshot['scheduled_delivery_type']);
            $this->assertEqualsWithDelta(0.0, (float) $snapshot['customer_delivery_fee'], 0.001);
        }
    }

    public function test_the_scheduled_gst_percentage_is_capped_like_the_other_gst_settings(): void
    {
        $setting = AppSetting::firstOrCreate(
            ['key' => 'grocery_scheduled_delivery_gst_percent'],
            ['label' => 'Delivery GST %', 'group' => 'test', 'type' => 'number', 'is_public' => false]
        );

        $this->actingAsAdmin();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => 18])
            ->assertOk()
            ->assertJsonPath('data.value', '18');

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => 150])
            ->assertStatus(422)
            ->assertJsonValidationErrors('value');
    }

    public function test_setting_only_the_address_does_not_reset_the_selected_delivery_mode(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);

        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);
        $cart = $this->makeGroceryCart($customer, GroceryDeliveryConfigService::MODE_SCHEDULED);

        Sanctum::actingAs($customer, ['*']);

        // Older clients send only the address, with no delivery_mode at all.
        $this->postJson('/api/v1/cart/delivery-address', [
            'cart_type' => 'grocery',
            'address_id' => $address->id,
        ])->assertOk();

        $this->assertSame(GroceryDeliveryConfigService::MODE_SCHEDULED, $cart->fresh()->delivery_mode);
    }

    public function test_scheduled_order_creation_is_unchanged_by_the_manual_dispatch_flag(): void
    {
        $this->setSetting('grocery_vendor_manual_dispatch', '1');

        $order = $this->placeScheduledOrder();

        $this->assertSame('SCHEDULED', $order->status);
        $this->assertNotNull($order->delivery_slot_id);
        $this->assertSame('scheduled', $order->timing_type);
        $this->assertSame(
            GroceryDeliveryConfigService::MODE_SCHEDULED,
            $order->meta['delivery_schedule']['delivery_mode']
        );
    }

    public function test_the_dispatch_offer_and_the_final_earning_both_use_the_frozen_per_parcel_amount(): void
    {
        $this->setSetting(GroceryDeliveryConfigService::TYPE_KEY, GroceryDeliveryConfigService::TYPE_FREE);
        $this->setSetting('grocery_scheduled_free_delivery_admin_fee_per_parcel', '30');

        $order = $this->placeScheduledOrder();
        $order->update(['status' => 'READY']);

        $partner = $this->makePartner();

        Sanctum::actingAs($this->vendor->user, ['*']);
        $this->postJson("/api/v1/vendor/orders/{$order->id}/assign-delivery-partner", [
            'delivery_partner_id' => $partner->id,
        ])->assertOk();

        $offer = DispatchLog::where('order_id', $order->id)->firstOrFail();

        // The partner is shown the frozen per-parcel funding, not a per-km amount.
        $this->assertEqualsWithDelta(30.0, (float) $offer->meta['estimated_earning'], 0.01);
        $this->assertSame(
            'customer_delivery_fee_plus_admin_funded_amount',
            $offer->meta['earning_breakdown']['basis']
        );

        Sanctum::actingAs($partner->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertOk();

        $order->update([
            'status' => 'ARRIVED',
            'delivery_otp_verified_at' => now(),
            'payment_status' => 'paid',
        ]);

        // The admin-funded per-km rate changes after the offer was created; the
        // already-accepted snapshot must still decide what is credited.
        $this->setSetting('grocery_scheduled_delivery_fee_paid_by_admin_per_km', '9');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk();

        $this->assertSame('DELIVERED', $order->fresh()->status);

        $earning = DeliveryPartnerEarning::where('order_id', $order->id)->firstOrFail();
        $this->assertEqualsWithDelta(30.0, (float) $earning->amount, 0.01);
    }

    /**
     * The reported regression, driven through the real Instant grocery flow: a
     * short drop inside the customer free radius froze an admin_delivery_cost of
     * (distance x per-km rate) on the order, and that stored amount short-
     * circuited the standard rule, so the partner was offered and credited 2.90
     * instead of the fixed free-distance guarantee.
     *
     * Instant grocery has no funding model of its own, so the frozen per-km cost
     * must never decide the earning; only Scheduled grocery keeps its override.
     */
    public function test_an_instant_grocery_order_pays_the_free_distance_guarantee_end_to_end(): void
    {
        $this->setSetting('grocery_free_delivery_km', '2');
        $this->setSetting('grocery_partner_free_distance_earning', '20');
        $this->setSetting('grocery_delivery_fee_paid_by_admin_per_km', '5');

        $partner = $this->makePartner();

        $customer = $this->makeCustomer();
        // ~0.58 km from the vendor: inside the free radius, so the customer is
        // charged nothing and the partner is owed the fixed guarantee.
        $address = $this->makeAddress($customer, 12.9768);

        $this->makeGroceryCart($customer, GroceryDeliveryConfigService::MODE_INSTANT, $address->id);

        $order = app(OrderService::class)->createOrder($customer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();

        $snapshot = $order->meta['delivery_pricing'];
        $distance = (float) $snapshot['distance_km'];

        // The customer pays nothing and the order still carries the old per-km
        // admin cost, which must not be allowed to decide the partner earning.
        $this->assertEqualsWithDelta(0.58, $distance, 0.05);
        $this->assertEqualsWithDelta(0.0, (float) $order->delivery_fee, 0.01);
        $this->assertEqualsWithDelta($distance * 5, (float) $snapshot['admin_delivery_cost'], 0.01);
        $this->assertNull($this->groceryAdminFundedAmount($order));

        // Instant grocery is dispatched automatically when the vendor accepts.
        Sanctum::actingAs($this->vendor->user, ['*']);
        $this->putJson("/api/v1/vendor/orders/{$order->id}/status", ['status' => 'accepted'])
            ->assertOk();

        // 1. The offer the partner is shown before accepting.
        $offer = DispatchLog::where('order_id', $order->id)->firstOrFail();
        $this->assertEqualsWithDelta(20.0, (float) $offer->meta['estimated_earning'], 0.01);
        $this->assertSame(
            'customer_delivery_fee_plus_free_distance_earning',
            $offer->meta['earning_breakdown']['basis']
        );
        $this->assertSame(
            'grocery_partner_free_distance_earning',
            $offer->meta['earning_breakdown']['first_distance_earning_key']
        );

        // 2. The accepted snapshot preserves the same amount.
        Sanctum::actingAs($partner->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$offer->id}/accept")->assertOk();

        $accepted = $order->fresh()->meta['accepted_partner_earning'];
        $this->assertEqualsWithDelta(20.0, (float) $accepted['amount'], 0.01);

        // An Admin edit after acceptance must not alter what was already agreed.
        $this->setSetting('grocery_partner_free_distance_earning', '55');

        $order->update([
            'status' => 'ARRIVED',
            'delivery_otp_verified_at' => now(),
            'payment_status' => 'paid',
        ]);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk();

        // 3. The stored earning record itself, not just the display.
        $earning = DeliveryPartnerEarning::where('order_id', $order->id)->firstOrFail();
        $this->assertEqualsWithDelta(20.0, (float) $earning->amount, 0.01);

        $breakdown = $earning->meta['earning_breakdown'];
        $this->assertSame('accepted_offer_snapshot', $breakdown['basis']);
        $this->assertSame('grocery', $breakdown['service']);
        $this->assertEqualsWithDelta(0.58, (float) $breakdown['distance_km'], 0.05);
        $this->assertEqualsWithDelta(0.0, (float) $breakdown['customer_delivery_fee'], 0.01);
        $this->assertEqualsWithDelta(2.0, (float) $breakdown['free_distance_km'], 0.01);
        $this->assertEqualsWithDelta(20.0, (float) $breakdown['first_distance_earning'], 0.01);
        $this->assertSame(
            'grocery_partner_free_distance_earning',
            $breakdown['first_distance_earning_key']
        );
        $this->assertEqualsWithDelta(0.0, (float) $breakdown['additional_distance_km'], 0.05);
        $this->assertEqualsWithDelta(0.0, (float) $breakdown['additional_admin_earning'], 0.01);

        // 4. The wallet is credited that same amount, exactly once.
        $transactions = WalletTransaction::where('reference_type', DeliveryPartnerEarning::class)
            ->where('reference_id', $earning->id)
            ->get();
        $this->assertCount(1, $transactions);
        $this->assertEqualsWithDelta(20.0, (float) $transactions->first()->amount, 0.01);

        // 5. The partner earnings screen is built from the same records.
        $payload = $this->getJson('/api/v1/delivery-partner/earnings')->assertOk()->json('data');
        $this->assertEqualsWithDelta(20.0, (float) $payload['total'], 0.01);
        $this->assertEqualsWithDelta(20.0, (float) $payload['earnings']['data'][0]['amount'], 0.01);
    }

    public static function groceryFreeDistanceEarningCases(): array
    {
        return [
            'zero distance still earns the guarantee' => [0.0, 0.0, 20.0],
            '0.1 km' => [0.1, 0.0, 20.0],
            '0.58 km (the reported order)' => [0.58, 0.0, 20.0],
            '1.5 km' => [1.5, 0.0, 20.0],
            '1.99 km' => [1.99, 0.0, 20.0],
            'exactly the free radius' => [2.0, 0.0, 20.0],
            'just beyond the free radius' => [2.01, 0.0, 20.05],
            '3 km' => [3.0, 0.0, 25.0],
            '4.67 km' => [4.67, 0.0, 33.35],
            'a paid customer fee is added on top' => [0.58, 7.0, 27.0],
            'a paid customer fee beyond the free radius' => [3.0, 7.0, 32.0],
        ];
    }

    /**
     * The guarantee is a fixed amount, never pro-rated by distance, and the
     * Admin-funded per-km rate only ever covers the distance past the free
     * radius. Grocery reads its own setting, independently of Food.
     */
    #[DataProvider('groceryFreeDistanceEarningCases')]
    public function test_the_grocery_free_distance_earning_is_fixed_up_to_the_free_radius(
        float $distance,
        float $customerFee,
        float $expected
    ): void {
        $this->setSetting('grocery_free_delivery_km', '2');
        $this->setSetting('grocery_partner_free_distance_earning', '20');
        $this->setSetting('grocery_delivery_fee_paid_by_admin_per_km', '5');

        $amount = app(DeliveryFeeService::class)->partnerEarning('grocery', $distance, $customerFee);

        $this->assertEqualsWithDelta($expected, $amount['amount'], 0.01);
        $this->assertSame('customer_delivery_fee_plus_free_distance_earning', $amount['breakdown']['basis']);
        $this->assertEqualsWithDelta(20.0, (float) $amount['breakdown']['first_distance_earning'], 0.01);
        $this->assertEqualsWithDelta(
            max(0.0, round($distance - 2, 4)),
            (float) $amount['breakdown']['additional_distance_km'],
            0.0001
        );

        // Food keeps its own independently configured guarantee, read from its
        // own setting key rather than Grocery's.
        $this->setSetting('food_partner_free_distance_earning', '35');
        $food = app(DeliveryFeeService::class)->partnerEarning('food', $distance, $customerFee);
        $this->assertEqualsWithDelta(35.0, (float) $food['breakdown']['first_distance_earning'], 0.01);
        $this->assertSame('food_partner_free_distance_earning', $food['breakdown']['first_distance_earning_key']);
        $this->assertSame('grocery_partner_free_distance_earning', $amount['breakdown']['first_distance_earning_key']);
    }

    private function makePartner(): DeliveryPartner
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => 'grocery',
            'is_online' => true,
            'is_busy' => false,
            'latitude' => 12.9720,
            'longitude' => 77.5950,
            'last_location_at' => now(),
        ]);
    }

    private function groceryAdminFundedAmount(Order $order): ?float
    {
        return app(GroceryDeliveryConfigService::class)->adminFundedAmountForOrder($order);
    }

    private function deliveryDistanceKm(): float
    {
        return app(DeliveryFeeService::class)->distanceKm(
            self::VENDOR_LAT,
            self::VENDOR_LNG,
            self::ADDRESS_LAT,
            self::ADDRESS_LNG
        );
    }

    private function placeScheduledOrder(): Order
    {
        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);

        $slot = DeliverySlot::create([
            'vendor_id' => $this->vendor->id,
            'store_id' => $this->store->id,
            'slot_date' => Carbon::now('Asia/Kolkata')->addDay()->format('Y-m-d'),
            'start_time' => '10:00:00',
            'end_time' => '12:00:00',
            'slot_timezone' => config('delivery_slots.timezone'),
            'max_orders' => 10,
            'booked_orders' => 0,
            'lead_time_min' => 0,
            'is_active' => true,
        ]);

        $this->makeGroceryCart($customer, GroceryDeliveryConfigService::MODE_SCHEDULED);

        return app(OrderService::class)->createOrder($customer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
            'delivery_slot_id' => $slot->id,
        ])->fresh();
    }

    private function placeInstantOrder(): Order
    {
        $customer = $this->makeCustomer();
        $address = $this->makeAddress($customer);

        $this->makeGroceryCart($customer, GroceryDeliveryConfigService::MODE_INSTANT);

        return app(OrderService::class)->createOrder($customer, [
            'order_type' => 'grocery',
            'payment_method' => 'cash_on_delivery',
            'address_id' => $address->id,
        ])->fresh();
    }

    private function makeGroceryCart(User $customer, string $deliveryMode, ?int $addressId = null): Cart
    {
        $product = Product::create([
            'vendor_id' => $this->vendor->id,
            'store_id' => $this->store->id,
            'name' => 'Groceries '.uniqid('g', true),
            'slug' => 'grocery-'.uniqid('s', true),
            'sku' => 'SKU_'.uniqid(),
            'price' => 120,
            'type' => 'grocery',
            'tax_rate' => 0,
            'is_active' => true,
            'is_available' => true,
        ]);

        $cart = Cart::create([
            'user_id' => $customer->id,
            'cart_type' => 'grocery',
            'vendor_id' => $this->vendor->id,
            'address_id' => $addressId ?? $customer->addresses()->value('id'),
            'delivery_mode' => $deliveryMode,
            'subtotal' => 240,
            'discount' => 0,
            'tax' => 0,
            'delivery_fee' => 0,
            'total' => 240,
            'items_count' => 2,
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

    /**
     * Recalculate the cart through the real customer endpoint, so the preview is
     * covered end to end rather than through a reimplementation of the pricing.
     */
    private function recalculate(Cart $cart, string $deliveryMode): Cart
    {
        Sanctum::actingAs($cart->user, ['*']);

        $this->postJson('/api/v1/cart/delivery-address', [
            'cart_type' => 'grocery',
            'address_id' => $cart->address_id,
            'delivery_mode' => $deliveryMode,
        ])->assertOk();

        return $cart->fresh();
    }

    private function makeCustomer(): User
    {
        return User::factory()->create([
            'user_type' => 'customer',
            'is_active' => true,
        ]);
    }

    private function actingAsAdmin(): void
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin', 'is_system' => true]);
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $admin->roles()->sync([$role->id]);

        $this->withHeader('Authorization', 'Bearer '.$admin->createToken('test')->plainTextToken);
    }

    private function makeAddress(User $customer, ?float $latitude = null): Address
    {
        return Address::create([
            'user_id' => $customer->id,
            'label' => 'Home',
            'contact_name' => 'Customer',
            'contact_phone' => '98123'.random_int(10000, 99999),
            'address_line_1' => '12 Test Street',
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'postal_code' => '560001',
            'formatted_address' => '12 Test Street, Bengaluru',
            'latitude' => $latitude ?? self::ADDRESS_LAT,
            'longitude' => self::ADDRESS_LNG,
            'is_default' => true,
        ]);
    }

    private function setSetting(string $key, string $value): void
    {
        AppSetting::updateOrCreate(
            ['key' => $key],
            ['value' => $value, 'label' => $key, 'group' => 'test', 'type' => 'number', 'is_public' => false]
        );
    }

    /**
     * A blank threshold means "no free-delivery-above rule", which is what a
     * distance-only chargeable test needs.
     */
    private function clearSetting(string $key): void
    {
        $this->setSetting($key, '');
    }
}
