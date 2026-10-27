<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Driver;
use App\Models\Payout;
use App\Models\Role;
use App\Models\Settlement;
use App\Models\User;
use App\Models\Vendor;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the admin-controlled `vendor_min_wallet_balance` floor on
 * `POST /api/v1/vendor/payouts`.
 *
 * The floor constrains what must REMAIN in the wallet, not the size of the
 * request, so a ₹29 request against a ₹529 wallet is valid while a ₹30 request
 * is not.
 */
class VendorWalletBalanceFloorTest extends TestCase
{
    use RefreshDatabase;

    // -----------------------------------------------------------------
    // The rule: maximum payout = wallet balance - floor
    // -----------------------------------------------------------------

    public function test_migration_seeds_the_default_floor_of_500(): void
    {
        $setting = AppSetting::where('key', 'vendor_min_wallet_balance')->first();

        $this->assertNotNull($setting, 'The setting row must exist on a migrated database.');
        $this->assertSame('500', $setting->value);
        $this->assertSame('vendor_payout', $setting->group);
        $this->assertSame('Minimum Vendor Wallet Balance', $setting->label);
        $this->assertSame(
            'Minimum amount that must remain in a Food/Grocery vendor wallet after payout.',
            $setting->help_text
        );
    }

    public function test_rejects_a_payout_when_the_wallet_exactly_meets_the_floor(): void
    {
        $vendor = $this->vendorWithWallet(500);

        // 500 - 1 would leave 499 behind, and 500 itself leaves nothing, so the
        // balance must be strictly above the floor before anything is allowed.
        $this->requestPayout($vendor, 1)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Wallet balance must be more than the minimum vendor wallet balance of ₹500.');

        $this->requestPayout($vendor, 500)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Wallet balance must be more than the minimum vendor wallet balance of ₹500.');

        $this->assertSame(0, Payout::count());
    }

    public function test_allows_the_whole_headroom_above_the_floor(): void
    {
        $vendor = $this->vendorWithWallet(529);
        $this->addSettlement($vendor, 529);

        $this->requestPayout($vendor, 29)
            ->assertStatus(201)
            ->assertJsonPath('data.amount', '29.00');

        $this->assertDatabaseHas('payouts', ['vendor_id' => $vendor->id, 'amount' => '29.00']);
    }

    public function test_rejects_a_single_rupee_more_than_the_headroom(): void
    {
        $vendor = $this->vendorWithWallet(529);
        $this->addSettlement($vendor, 529);

        $this->requestPayout($vendor, 30)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout amount is ₹29.');

        $this->assertSame(0, Payout::count());
    }

    public function test_allows_one_rupee_of_headroom(): void
    {
        $vendor = $this->vendorWithWallet(501);
        $this->addSettlement($vendor, 501);

        $this->requestPayout($vendor, 1)->assertStatus(201);
    }

    public function test_a_one_thousand_rupee_wallet_offers_five_hundred_rupees_of_headroom(): void
    {
        $vendor = $this->vendorWithWallet(1000);
        $this->addSettlement($vendor, 1000);

        $this->requestPayout($vendor, 500)->assertStatus(201);

        $this->assertDatabaseHas('payouts', ['vendor_id' => $vendor->id, 'amount' => '500.00']);
    }

    public function test_a_small_request_under_the_floor_is_allowed_when_the_balance_stays_above_it(): void
    {
        $vendor = $this->vendorWithWallet(529);
        $this->addSettlement($vendor, 529);

        // The distinguishing case: ₹1 is far below the ₹500 floor, but it leaves
        // ₹528 behind so the rule is satisfied.
        $this->requestPayout($vendor, 1)->assertStatus(201);
    }

    public function test_no_settlement_still_blocks_the_payout_even_with_wallet_headroom(): void
    {
        $vendor = $this->vendorWithWallet(529);

        // The floor would allow 29, but nothing is settled yet, so the ceiling
        // collapses to zero.
        $this->requestPayout($vendor, 29)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout amount is ₹0.');
    }

    // -----------------------------------------------------------------
    // The settlement balance still caps the request
    // -----------------------------------------------------------------

    public function test_the_settlement_balance_caps_the_ceiling_below_the_wallet_headroom(): void
    {
        $vendor = $this->vendorWithWallet(1000);
        $this->addSettlement($vendor, 200);

        // Headroom allows 500, but only 200 is settled, so the published ceiling
        // is the lower of the two and 500 is refused against it.
        $this->requestPayout($vendor, 500)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout amount is ₹200.');

        $this->requestPayout($vendor, 200)->assertStatus(201);
    }

    public function test_in_flight_payouts_narrow_the_ceiling_so_they_cannot_overdraw(): void
    {
        $vendor = $this->vendorWithWallet(2000);
        $this->addSettlement($vendor, 700);

        $this->requestPayout($vendor, 500)->assertStatus(201);

        // The pending 500 is netted off the settlement balance, so the ceiling
        // drops to 200 even though the wallet alone would still allow 1000.
        $this->requestPayout($vendor, 600)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout amount is ₹200.');

        $this->requestPayout($vendor, 200)->assertStatus(201);

        $total = Payout::where('vendor_id', $vendor->id)->sum('amount');
        $this->assertSame(700, (int) round((float) $total), 'Combined payouts must not exceed the settled balance.');
    }

    public function test_replaying_the_same_idempotency_key_does_not_withdraw_twice(): void
    {
        $vendor = $this->vendorWithWallet(1000);
        $this->addSettlement($vendor, 1000);
        $this->actingAsVendor($vendor);

        $first = $this->postJson('/api/v1/vendor/payouts', ['amount' => 400, 'idempotency_key' => 'floor-retry-1']);
        $first->assertStatus(201);

        // The first request consumed its own headroom, so re-validating would
        // reject the retry. It must resolve to the payout already created.
        $this->postJson('/api/v1/vendor/payouts', ['amount' => 400, 'idempotency_key' => 'floor-retry-1'])
            ->assertStatus(201)
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertSame(1, Payout::where('vendor_id', $vendor->id)->count());
    }

    // -----------------------------------------------------------------
    // Admin change takes effect on new requests only
    // -----------------------------------------------------------------

    public function test_raising_the_floor_applies_immediately_to_new_requests(): void
    {
        $vendor = $this->vendorWithWallet(1000);
        $this->addSettlement($vendor, 1000);
        $this->setFloor('1000');

        // A floor sitting exactly on the balance is the strict-inequality case.
        $this->requestPayout($vendor, 500)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Wallet balance must be more than the minimum vendor wallet balance of ₹1000.');

        $this->setFloor('100');

        $this->requestPayout($vendor, 900)->assertStatus(201);
    }

    public function test_re_running_the_migration_keeps_an_admin_configured_floor(): void
    {
        $this->setFloor('1200');

        $this->artisan('migrate', ['--force' => true])->assertSuccessful();

        $this->assertSame('1200', AppSetting::where('key', 'vendor_min_wallet_balance')->value('value'));
    }

    public function test_changing_the_floor_does_not_alter_existing_payouts_or_settlements(): void
    {
        $vendor = $this->vendorWithWallet(1000);
        $settlement = $this->addSettlement($vendor, 1000);

        $this->requestPayout($vendor, 400)->assertStatus(201);
        $payout = Payout::where('vendor_id', $vendor->id)->firstOrFail();

        $this->setFloor('900');

        $this->assertSame('400.00', $payout->fresh()->amount, 'A completed payout must not be rewritten.');
        $this->assertSame('1000.00', $settlement->fresh()->net_payable, 'Settlement value must not be rewritten.');
    }

    // -----------------------------------------------------------------
    // Food + grocery only
    // -----------------------------------------------------------------

    public function test_food_vendor_follows_the_configured_floor(): void
    {
        $vendor = $this->vendorWithWallet(529, 'restaurant');
        $this->setFloor('1000');

        $this->requestPayout($vendor, 29)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Wallet balance must be more than the minimum vendor wallet balance of ₹1000.');
    }

    public function test_grocery_vendor_follows_the_configured_floor(): void
    {
        $vendor = $this->vendorWithWallet(529, 'grocery');
        $this->setFloor('1000');

        $this->requestPayout($vendor, 29)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Wallet balance must be more than the minimum vendor wallet balance of ₹1000.');
    }

    public function test_the_vendor_floor_is_not_applied_to_a_ride_driver(): void
    {
        $this->setFloor('5000');

        $driverUser = User::factory()->create(['user_type' => 'driver', 'is_active' => true]);
        Driver::create([
            'user_id' => $driverUser->id,
            'license_number' => 'DL-'.uniqid(),
            'status' => 'approved',
            'is_active' => true,
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'TEST0000001',
        ]);

        $role = Role::firstOrCreate(['slug' => 'driver'], ['name' => 'Driver']);
        $driverUser->roles()->syncWithoutDetaching([$role->id]);
        Sanctum::actingAs($driverUser, ['*']);

        // The driver earns nothing here, so their own ₹200 partner floor is what
        // answers. A ₹5000 *vendor* floor must never be consulted for a rider.
        $this->postJson('/api/v1/driver/withdrawals', ['amount' => 120])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Minimum wallet balance of ₹200.00 must remain after payout. No payout amount is currently available.');
    }

    public function test_a_vendor_cannot_borrow_another_vendors_balance(): void
    {
        $rich = $this->vendorWithWallet(5000);
        $this->addSettlement($rich, 5000);
        $poor = $this->vendorWithWallet(600);
        $this->addSettlement($poor, 600);

        $this->actingAsVendor($poor);
        $this->postJson('/api/v1/vendor/payouts', ['amount' => 400, 'vendor_id' => $rich->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Maximum payout amount is ₹100.');

        $this->assertDatabaseMissing('payouts', ['vendor_id' => $rich->id]);
        $this->assertSame(0, Payout::where('vendor_id', $poor->id)->count());
    }

    public function test_unauthenticated_payout_request_returns_401(): void
    {
        $this->postJson('/api/v1/vendor/payouts', ['amount' => 100])->assertStatus(401);
    }

    // -----------------------------------------------------------------
    // The ceiling is published to the vendor
    // -----------------------------------------------------------------

    public function test_earnings_overview_returns_the_floor_and_the_maximum(): void
    {
        $vendor = $this->vendorWithWallet(529);
        $this->addSettlement($vendor, 529);

        $this->actingAsVendor($vendor);

        $this->getJson('/api/v1/vendor/earnings')
            ->assertStatus(200)
            ->assertJsonPath('data.minimum_wallet_balance', 500)
            ->assertJsonPath('data.max_withdrawable_amount', 29);
    }

    public function test_maximum_is_zero_when_the_wallet_sits_on_the_floor(): void
    {
        $vendor = $this->vendorWithWallet(500);
        $this->addSettlement($vendor, 500);

        $this->actingAsVendor($vendor);

        $this->getJson('/api/v1/vendor/earnings')
            ->assertStatus(200)
            ->assertJsonPath('data.max_withdrawable_amount', 0);
    }

    // -----------------------------------------------------------------
    // Admin settings validation
    // -----------------------------------------------------------------

    public function test_admin_rejects_a_negative_floor_with_422(): void
    {
        $setting = $this->setFloor('500');
        $this->actingAsSuperAdmin();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '-1'])->assertStatus(422);

        $this->assertSame('500', $setting->fresh()->value);
    }

    public function test_admin_can_raise_the_floor(): void
    {
        $setting = $this->setFloor('500');
        $this->actingAsSuperAdmin();

        $this->putJson("/api/v1/admin/app-settings/{$setting->id}", ['value' => '1500'])->assertStatus(200);

        $this->assertSame('1500', $setting->fresh()->value);
    }

    public function test_a_zero_floor_lets_the_whole_balance_be_withdrawn(): void
    {
        $vendor = $this->vendorWithWallet(300);
        $this->addSettlement($vendor, 300);
        $this->setFloor('0');

        $this->requestPayout($vendor, 300)->assertStatus(201);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function requestPayout(Vendor $vendor, float $amount)
    {
        $this->actingAsVendor($vendor);

        return $this->postJson('/api/v1/vendor/payouts', ['amount' => $amount]);
    }

    private function actingAsVendor(Vendor $vendor): void
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendor->user->roles()->syncWithoutDetaching([$role->id]);
        Sanctum::actingAs($vendor->user, ['*']);
    }

    private function actingAsSuperAdmin(): void
    {
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'Super Admin']);
        $user = User::factory()->create();
        $user->roles()->attach($role->id);
        Sanctum::actingAs($user, ['*']);
    }

    /**
     * A vendor whose wallet holds exactly the given amount, with no settlement
     * yet. The settlement is what the payout request is ultimately measured
     * against, so tests add it only where that cap is the point.
     */
    private function vendorWithWallet(float $balance, string $type = 'restaurant'): Vendor
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'vendor_type' => $type,
            'business_name' => $type === 'grocery' ? 'Test Market' : 'Test Kitchen',
            'owner_name' => 'Test Owner',
            'phone' => '90000'.random_int(10000, 99999),
            'status' => 'approved',
            'bank_account_name' => 'Test Owner',
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'TEST0000001',
            'is_active' => true,
        ]);

        if ($balance > 0) {
            app(WalletService::class)->credit(
                user: $user,
                walletType: 'vendor',
                amount: $balance,
                type: 'EARNING',
                referenceType: 'test',
                referenceId: $vendor->id,
                description: 'Opening balance',
                idempotencyKey: 'vendor-opening-balance:'.$vendor->id,
            );
        }

        return $vendor;
    }

    /**
     * One settled-but-unpaid settlement, the other half of what makes a balance
     * withdrawable. CommissionService creates both together.
     */
    private function addSettlement(Vendor $vendor, float $netPayable): Settlement
    {
        return Settlement::create([
            'settlement_number' => 'STL_'.strtoupper(bin2hex(random_bytes(4))),
            'party_type' => 'vendor',
            'vendor_id' => $vendor->id,
            'gross_earnings' => $netPayable,
            'total_commission' => 0,
            'net_payable' => $netPayable,
            'status' => 'processing',
            'period_start' => now()->startOfDay(),
            'period_end' => now()->endOfDay(),
            'period_type' => 'daily',
        ]);
    }

    private function setFloor(string $value): AppSetting
    {
        return AppSetting::updateOrCreate(
            ['key' => 'vendor_min_wallet_balance'],
            [
                'group' => 'vendor_payout',
                'label' => 'Minimum Vendor Wallet Balance',
                'help_text' => 'Minimum amount that must remain in a Food/Grocery vendor wallet after payout.',
                'value' => $value,
                'type' => 'number',
                'is_public' => false,
                'sort_order' => 1,
            ]
        );
    }
}
