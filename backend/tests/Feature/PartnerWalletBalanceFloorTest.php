<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Driver;
use App\Models\DriverEarning;
use App\Models\Order;
use App\Models\Payout;
use App\Models\Ride;
use App\Models\Role;
use App\Models\Settlement;
use App\Models\User;
use App\Models\Vendor;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the admin-controlled `partner_min_wallet_balance` floor on
 * `POST /api/v1/delivery-partner/withdrawals` and
 * `POST /api/v1/driver/withdrawals`.
 *
 * The floor constrains what must REMAIN in the wallet, not the size of the
 * request: a ₹1 payout against a ₹201 balance is valid while a ₹1 payout
 * against a ₹200 balance is not.
 */
class PartnerWalletBalanceFloorTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------
    // The rule: maximum payout = available balance - floor
    // -----------------------------------------------------------------

    public function test_migration_seeds_the_default_floor_of_200(): void
    {
        $setting = AppSetting::where('key', 'partner_min_wallet_balance')->first();

        $this->assertNotNull($setting, 'The setting row must exist on a migrated database.');
        $this->assertSame('200', $setting->value);
        $this->assertSame('partner_payout', $setting->group);
        $this->assertSame('Minimum Partner Wallet Balance', $setting->label);
        $this->assertSame(
            'Minimum amount that must remain in a delivery partner or rider wallet after payout.',
            $setting->help_text
        );
    }

    public function test_wallet_at_the_floor_cannot_request_any_payout(): void
    {
        $partner = $this->partnerWithEarnings(500, 200);

        // Wallet ₹200: neither ₹1 (leaves 199) nor ₹200 (leaves 0) is allowed.
        $this->requestPayout($partner, 1)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');

        $this->requestPayout($partner, 200)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');

        $this->assertSame(0, Payout::where('delivery_partner_id', $partner->id)->count());
    }

    public function test_wallet_one_rupee_above_the_floor_allows_exactly_one_rupee(): void
    {
        $partner = $this->partnerWithEarnings(500, 201);

        $this->requestPayout($partner, 1)->assertStatus(201);

        $this->assertDatabaseHas('payouts', ['delivery_partner_id' => $partner->id, 'amount' => '1.00']);
    }

    public function test_full_headroom_above_the_floor_is_allowed(): void
    {
        $partner = $this->partnerWithEarnings(500, 500);

        // ₹500 balance, ₹300 request, ₹200 remaining.
        $this->requestPayout($partner, 300)->assertStatus(201);

        $this->assertDatabaseHas('payouts', ['delivery_partner_id' => $partner->id, 'amount' => '300.00']);
    }

    public function test_one_rupee_over_the_headroom_is_rejected(): void
    {
        $partner = $this->partnerWithEarnings(500, 500);

        // ₹500 balance, ₹301 request, ₹199 remaining.
        $this->requestPayout($partner, 301)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout available is ₹300.00 because ₹200.00 must remain in your wallet.');

        $this->assertSame(0, Payout::where('delivery_partner_id', $partner->id)->count());
    }

    public function test_a_one_thousand_rupee_balance_allows_eight_hundred(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);

        $this->requestPayout($partner, 800)->assertStatus(201);
    }

    public function test_a_request_below_the_floor_value_is_allowed_when_the_balance_stays_above_it(): void
    {
        $partner = $this->partnerWithEarnings(500, 500);

        // The distinguishing case: ₹1 is below the ₹200 floor, but it leaves
        // ₹499 behind so the rule is satisfied.
        $this->requestPayout($partner, 1)->assertStatus(201);
    }

    // -----------------------------------------------------------------
    // All three partner types share the one setting
    // -----------------------------------------------------------------

    public function test_food_delivery_partner_follows_the_floor(): void
    {
        $partner = $this->partnerWithEarnings(500, 500, 'food');

        $this->requestPayout($partner, 300)->assertStatus(201);

        // 200 now remains, which is exactly the floor: nothing more is available.
        $this->requestPayout($partner, 1)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');
    }

    public function test_grocery_delivery_partner_follows_the_floor(): void
    {
        $partner = $this->partnerWithEarnings(500, 500, 'grocery');

        $this->requestPayout($partner, 300)->assertStatus(201);
    }

    public function test_ride_driver_follows_the_floor(): void
    {
        $driver = $this->driverWithEarnings(500, 500);

        $this->requestPayout($driver, 300)->assertStatus(201);

        // 200 now remains, which is exactly the floor: nothing more is available.
        $this->requestPayout($driver, 1)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');
    }

    public function test_ride_driver_at_the_floor_is_rejected(): void
    {
        $driver = $this->driverWithEarnings(500, 200);

        $this->requestPayout($driver, 100)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');
    }

    // -----------------------------------------------------------------
    // In-flight payouts and idempotency
    // -----------------------------------------------------------------

    public function test_in_flight_payouts_narrow_the_ceiling(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);

        $this->requestPayout($partner, 300)->assertStatus(201);

        // 1000 earned less 300 pending is 700 available, so headroom is 500.
        $this->requestPayout($partner, 501)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout available is ₹500.00 because ₹200.00 must remain in your wallet.');

        $this->requestPayout($partner, 500)->assertStatus(201);

        // Combined 800 leaves 200 behind, exactly the floor.
        $total = Payout::where('delivery_partner_id', $partner->id)->sum('amount');
        $this->assertSame(800, (int) round((float) $total));
    }

    public function test_replaying_the_same_idempotency_key_does_not_withdraw_twice(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);
        $this->actingAsPartner($partner);

        $first = $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 300, 'idempotency_key' => 'partner-retry-1']);
        $first->assertStatus(201);

        // The first request consumed its own headroom, so revalidating would
        // reject the retry. It must resolve to the payout already created.
        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 300, 'idempotency_key' => 'partner-retry-1'])
            ->assertStatus(201)
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame(1, Payout::where('delivery_partner_id', $partner->id)->count());
    }

    public function test_two_sequential_requests_cannot_combinedly_breach_the_floor(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);
        $this->actingAsPartner($partner);

        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 600])->assertStatus(201);

        // 1000 less 600 leaves 400, so at most 200 more may be taken.
        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 201])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout available is ₹200.00 because ₹200.00 must remain in your wallet.');

        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 200])->assertStatus(201);

        $this->assertSame(800, (int) round((float) Payout::where('delivery_partner_id', $partner->id)->sum('amount')));
    }

    // -----------------------------------------------------------------
    // Admin change takes effect on new requests only
    // -----------------------------------------------------------------

    public function test_raising_the_floor_applies_immediately_to_new_requests(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);
        $this->requestPayout($partner, 300)->assertStatus(201);

        $this->setFloor('300');

        // 1000 less 300 pending is 700 available, so headroom is now 400.
        $this->requestPayout($partner, 401)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout available is ₹400.00 because ₹300.00 must remain in your wallet.');

        $this->requestPayout($partner, 400)->assertStatus(201);
    }

    public function test_changing_the_floor_does_not_alter_existing_payouts_or_earnings(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);
        $this->requestPayout($partner, 300)->assertStatus(201);

        $payout = Payout::where('delivery_partner_id', $partner->id)->firstOrFail();
        $earning = DeliveryPartnerEarning::where('delivery_partner_id', $partner->id)->firstOrFail();

        $this->setFloor('900');

        $this->assertSame('300.00', $payout->fresh()->amount, 'A requested payout must not be rewritten.');
        $this->assertSame('1000.00', $earning->fresh()->amount, 'Earning must not be rewritten.');
    }

    public function test_re_running_the_migration_keeps_an_admin_configured_floor(): void
    {
        $this->setFloor('450');

        $this->artisan('migrate', ['--force' => true])->assertSuccessful();

        $this->assertSame('450', AppSetting::where('key', 'partner_min_wallet_balance')->value('value'));
    }

    public function test_a_zero_floor_lets_the_whole_balance_be_withdrawn(): void
    {
        $partner = $this->partnerWithEarnings(1000, 1000);
        $this->setFloor('0');

        $this->requestPayout($partner, 1000)->assertStatus(201);
    }

    // -----------------------------------------------------------------
    // Vendors are unaffected
    // -----------------------------------------------------------------

    public function test_the_partner_floor_does_not_apply_to_vendors(): void
    {
        $this->setFloor('900');

        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'vendor_type' => 'restaurant',
            'business_name' => 'Test Kitchen',
            'owner_name' => 'Test Owner',
            'phone' => '90000'.random_int(10000, 99999),
            'status' => 'approved',
            'bank_account_name' => 'Test Owner',
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'TEST0000001',
            'is_active' => true,
        ]);

        app(WalletService::class)->credit(
            user: $vendorUser,
            walletType: 'vendor',
            amount: 1000,
            type: 'EARNING',
            referenceType: 'test',
            referenceId: $vendor->id,
            description: 'Opening balance',
            idempotencyKey: 'vendor-floor-isolation:'.$vendor->id,
        );
        Settlement::create([
            'settlement_number' => 'STL_'.strtoupper(bin2hex(random_bytes(4))),
            'party_type' => 'vendor',
            'vendor_id' => $vendor->id,
            'gross_earnings' => 1000,
            'total_commission' => 0,
            'net_payable' => 1000,
            'status' => 'processing',
            'period_start' => now()->startOfDay(),
            'period_end' => now()->endOfDay(),
            'period_type' => 'daily',
        ]);

        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser->roles()->syncWithoutDetaching([$role->id]);
        Sanctum::actingAs($vendorUser, ['*']);

        // The vendor keeps its own ₹500 floor, so 500 of 1000 is still available
        // even though the partner floor is ₹900.
        $this->postJson('/api/v1/vendor/payouts', ['amount' => 500])->assertStatus(201);
    }

    public function test_the_vendor_floor_does_not_apply_to_partners(): void
    {
        AppSetting::where('key', 'vendor_min_wallet_balance')->update(['value' => '5000']);

        $partner = $this->partnerWithEarnings(1000, 1000);

        $this->requestPayout($partner, 300)->assertStatus(201);
    }

    // -----------------------------------------------------------------
    // The ceiling is published to the UI
    // -----------------------------------------------------------------

    public function test_partner_earnings_api_returns_the_floor_and_ceiling(): void
    {
        $partner = $this->partnerWithEarnings(529, 529);

        $this->actingAsPartner($partner);

        $this->getJson('/api/v1/delivery-partner/earnings')
            ->assertStatus(200)
            ->assertJsonPath('data.payout.minimum_wallet_balance', 200)
            ->assertJsonPath('data.payout.available_withdrawable_amount', 329)
            ->assertJsonPath('data.payout.wallet_balance', 529);
    }

    public function test_driver_earnings_api_returns_the_floor_and_ceiling(): void
    {
        $driver = $this->driverWithEarnings(529, 529);

        $this->actingAsDriver($driver);

        $this->getJson('/api/v1/driver/earnings')
            ->assertStatus(200)
            ->assertJsonPath('data.payout.minimum_wallet_balance', 200)
            ->assertJsonPath('data.payout.available_withdrawable_amount', 329)
            ->assertJsonPath('data.payout.wallet_balance', 529);
    }

    public function test_ceiling_is_zero_when_the_balance_sits_on_the_floor(): void
    {
        $partner = $this->partnerWithEarnings(200, 200);

        $this->actingAsPartner($partner);

        $this->getJson('/api/v1/delivery-partner/earnings')
            ->assertStatus(200)
            ->assertJsonPath('data.payout.available_withdrawable_amount', 0);
    }

    public function test_a_partner_cannot_borrow_another_partners_balance(): void
    {
        $rich = $this->partnerWithEarnings(5000, 5000);
        $poor = $this->partnerWithEarnings(1000, 300);

        $this->actingAsPartner($poor);
        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 400, 'delivery_partner_id' => $rich->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout available is ₹100.00 because ₹200.00 must remain in your wallet.');

        $this->assertSame(0, Payout::where('delivery_partner_id', $rich->id)->count());
    }

    public function test_unauthenticated_payout_request_returns_401(): void
    {
        $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => 100])->assertStatus(401);
    }

    // -----------------------------------------------------------------
    // Admin settings validation
    // -----------------------------------------------------------------

    public function test_admin_rejects_a_negative_floor_with_422(): void
    {
        $setting = $this->setFloor('200');
        $this->actingAsSuperAdmin();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '-1'])->assertStatus(422);

        $this->assertSame('200', $setting->fresh()->value);
    }

    public function test_admin_can_raise_the_partner_floor(): void
    {
        $setting = $this->setFloor('200');
        $this->actingAsSuperAdmin();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '350'])->assertStatus(200);

        $this->assertSame('350', $setting->fresh()->value);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function requestPayout($subject, float $amount)
    {
        $subject instanceof Driver
            ? $this->actingAsDriver($subject)
            : $this->actingAsPartner($subject);

        return $subject instanceof Driver
            ? $this->postJson('/api/v1/driver/withdrawals', ['amount' => $amount])
            : $this->postJson('/api/v1/delivery-partner/withdrawals', ['amount' => $amount]);
    }

    private function actingAsPartner(DeliveryPartner $partner): void
    {
        $role = Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']);
        $partner->user->roles()->syncWithoutDetaching([$role->id]);
        Sanctum::actingAs($partner->user, ['*']);
    }

    private function actingAsDriver(Driver $driver): void
    {
        $role = Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']);
        $driver->user->roles()->syncWithoutDetaching([$role->id]);
        Sanctum::actingAs($driver->user, ['*']);
    }

    private function actingAsSuperAdmin(): void
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        Sanctum::actingAs($user, ['*']);
    }

    /**
     * A partner whose credited earnings total the given amount. Earnings are what
     * makes a balance withdrawable, and the wallet is reconciled from them, so
     * both are seeded to keep the published ceiling and the enforced one aligned.
     */
    private function partnerWithEarnings(float $wallet, float $earnings, string $serviceType = 'food'): DeliveryPartner
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);

        $partner = DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => $serviceType,
            'is_online' => true,
            'is_busy' => false,
            'bank_account_name' => 'Test Partner',
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'TEST0000001',
        ]);

        if ($earnings > 0) {
            $order = $this->makeOrder($partner, $serviceType);

            DeliveryPartnerEarning::create([
                'delivery_partner_id' => $partner->id,
                'order_id' => $order->id,
                'earning_number' => 'EARN_'.strtoupper(bin2hex(random_bytes(6))),
                'amount' => $earnings,
                'currency' => 'INR',
                'type' => 'delivery',
                'status' => 'earned',
                'idempotency_key' => 'partner-floor-earning:'.uniqid(),
            ]);
        }

        $this->creditWallet($user, 'delivery_partner', $wallet, $partner->id);

        return $partner;
    }

    /** An earning must hang off a real order, matching how the app records them. */
    private function makeOrder(DeliveryPartner $partner, string $orderType = 'food'): Order
    {
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendor = Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Floor Test Kitchen',
            'owner_name' => 'Owner',
            'phone' => '90000'.random_int(10000, 99999),
            'vendor_type' => $orderType === 'grocery' ? 'grocery' : 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
        $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        return Order::create([
            'order_number' => 'ORD_'.strtoupper(bin2hex(random_bytes(4))),
            'idempotency_key' => 'partner-floor-'.uniqid(),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => 'DELIVERED',
            'payment_status' => 'paid',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 0,
            'total_amount' => 200,
            'delivery_partner_id' => $partner->id,
        ]);
    }

    private function driverWithEarnings(float $wallet, float $earnings): Driver
    {
        $user = User::factory()->create(['user_type' => 'driver', 'is_active' => true]);

        $driver = Driver::create([
            'user_id' => $user->id,
            'license_number' => 'DL-'.strtoupper(bin2hex(random_bytes(4))),
            'status' => 'approved',
            'is_online' => true,
            'is_busy' => false,
            'bank_account_name' => 'Test Driver',
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'TEST0000001',
        ]);

        if ($earnings > 0) {
            $customer = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);
            $ride = Ride::create([
                'ride_number' => 'RID_'.strtoupper(bin2hex(random_bytes(4))),
                'user_id' => $customer->id,
                'driver_id' => $driver->id,
                'status' => Ride::STATUS_COMPLETED,
                'pickup_latitude' => 12.9717,
                'pickup_longitude' => 77.5947,
                'destination_latitude' => 12.9617,
                'destination_longitude' => 77.6047,
                'final_fare' => $earnings,
                'payment_method' => 'online',
                'payment_status' => Ride::PAYMENT_STATUS_PAID,
            ]);

            DriverEarning::create([
                'driver_id' => $driver->id,
                'ride_id' => $ride->id,
                'trip_fare' => $earnings,
                'driver_percentage' => 100,
                'commission_percentage' => 0,
                'commission_amount' => 0,
                'earning_amount' => $earnings,
                'currency' => 'INR',
                'status' => DriverEarning::STATUS_PAID,
            ]);
        }

        $this->creditWallet($user, 'driver', $wallet, $driver->id);

        return $driver;
    }

    private function creditWallet(User $user, string $walletType, float $amount, int $referenceId): void
    {
        if ($amount <= 0) {
            return;
        }

        app(WalletService::class)->credit(
            user: $user,
            walletType: $walletType,
            amount: $amount,
            type: 'EARNING',
            referenceType: 'test',
            referenceId: $referenceId,
            description: 'Opening balance',
            idempotencyKey: "partner-floor-wallet:{$walletType}:{$referenceId}",
        );
    }

    private function setFloor(string $value): AppSetting
    {
        return AppSetting::updateOrCreate(
            ['key' => 'partner_min_wallet_balance'],
            [
                'group' => 'partner_payout',
                'label' => 'Minimum Partner Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a delivery partner or rider wallet after payout.',
                'value' => $value,
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
            ]
        );
    }
}
