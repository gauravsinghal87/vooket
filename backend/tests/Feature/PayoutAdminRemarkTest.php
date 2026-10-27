<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DeliveryPartner;
use App\Models\Payout;
use App\Models\Role;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PayoutAdminRemarkTest extends TestCase
{
    use RefreshDatabase;

    private const REMARK = 'Paid via SBI bank transfer on 23 October 2026. Reference: TXN123456.';

    public function test_admin_can_mark_pending_vendor_payout_paid_with_a_remark(): void
    {
        $admin = $this->makeAdmin();
        [, $vendor] = $this->makeVendor();
        $payout = $this->makeVendorPayout($vendor, 200);

        Sanctum::actingAs($admin, ['*']);

        $response = $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", [
            'admin_remark' => self::REMARK,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.admin_remark', self::REMARK);

        $payout->refresh();
        $this->assertSame('SUCCESS', $payout->status);
        $this->assertSame(self::REMARK, $payout->admin_remark);

        // The audit trail attributes the action to the admin and keeps the note.
        $audit = AuditLog::where('action', 'payout.paid')
            ->where('entity_type', Payout::class)
            ->where('entity_id', $payout->id)
            ->firstOrFail();

        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame(self::REMARK, $audit->new_values['admin_remark']);

        // The remark is part of the persisted admin detail payload.
        Sanctum::actingAs($admin, ['*']);
        $this->getJson("/api/v1/admin/payouts/{$payout->id}")
            ->assertOk()
            ->assertJsonPath('data.admin_remark', self::REMARK);
    }

    public function test_remark_persists_and_is_scoped_to_the_vendors_own_payout(): void
    {
        $admin = $this->makeAdmin();
        [$vendorUser, $vendor] = $this->makeVendor('Remark Kitchen');
        [$otherUser, $otherVendor] = $this->makeVendor('Other Kitchen');

        $payout = $this->makeVendorPayout($vendor, 200);
        $otherPayout = $this->makeVendorPayout($otherVendor, 300, 'WD_OTHER_VENDOR');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => self::REMARK])
            ->assertOk();

        // A fresh fetch (and therefore a page refresh / new session) keeps it.
        $this->assertSame(self::REMARK, Payout::find($payout->id)->admin_remark);

        Sanctum::actingAs($vendorUser, ['*']);
        $response = $this->getJson('/api/v1/vendor/payouts')->assertOk();

        $rows = collect($response->json('data'));
        $this->assertCount(1, $rows);
        $this->assertSame($payout->id, $rows[0]['id']);
        $this->assertSame(self::REMARK, $rows[0]['admin_remark']);
        $this->assertNotSame($otherPayout->id, $rows[0]['id']);

        // The other vendor cannot see this payout or its remark.
        Sanctum::actingAs($otherUser, ['*']);
        $otherRows = collect($this->getJson('/api/v1/vendor/payouts')->json('data'));
        $this->assertCount(1, $otherRows);
        $this->assertSame($otherPayout->id, $otherRows[0]['id']);
        $this->assertNull($otherRows[0]['admin_remark']);
    }

    public function test_admin_can_mark_pending_delivery_partner_payout_paid_with_a_remark(): void
    {
        $admin = $this->makeAdmin();
        [, $partner] = $this->makePartner();
        $payout = $this->makePartnerPayout($partner, 40);

        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", [
            'admin_remark' => self::REMARK,
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.admin_remark', self::REMARK);

        $this->assertSame('SUCCESS', $payout->fresh()->status);
        $this->assertSame(self::REMARK, $payout->fresh()->admin_remark);
    }

    public function test_delivery_partner_sees_the_remark_only_on_their_own_payout(): void
    {
        $admin = $this->makeAdmin();
        [$partnerUser, $partner] = $this->makePartner('Remark Partner');
        [, $otherPartner] = $this->makePartner('Other Partner');

        $payout = $this->makePartnerPayout($partner, 40);
        $otherPayout = $this->makePartnerPayout($otherPartner, 45, 'WD_OTHER_PARTNER');

        Sanctum::actingAs($admin, ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => self::REMARK])
            ->assertOk();

        Sanctum::actingAs($partnerUser, ['*']);
        $rows = collect($this->getJson('/api/v1/delivery-partner/withdrawals')->assertOk()->json('data.data'));

        $this->assertCount(1, $rows);
        $this->assertSame($payout->id, $rows[0]['id']);
        $this->assertSame(self::REMARK, $rows[0]['admin_remark']);
        $this->assertNotSame($otherPayout->id, $rows[0]['id']);
    }

    public function test_unauthorized_users_cannot_set_remarks_or_access_another_users_payout(): void
    {
        [$vendorUser] = $this->makeVendor();
        [$partnerUser, $partner] = $this->makePartner();
        $payout = $this->makePartnerPayout($partner, 40);

        // A vendor, delivery partner and customer cannot use the admin endpoint.
        Sanctum::actingAs($vendorUser, ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => 'hijack'])
            ->assertForbidden();

        Sanctum::actingAs($partnerUser, ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => 'hijack'])
            ->assertForbidden();

        Sanctum::actingAs($this->makeCustomer(), ['*']);
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => 'hijack'])
            ->assertForbidden();

        $this->assertSame('PENDING', $payout->fresh()->status);
        $this->assertNull($payout->fresh()->admin_remark);

        // A partner cannot read a payout belonging to another partner.
        [, $otherPartner] = $this->makePartner('Isolated Partner');
        $otherPayout = $this->makePartnerPayout($otherPartner, 60, 'WD_ISOLATED_PARTNER');

        Sanctum::actingAs($partnerUser, ['*']);
        $rows = collect($this->getJson('/api/v1/delivery-partner/withdrawals')->json('data.data'));
        $this->assertTrue($rows->every(fn ($row) => $row['delivery_partner_id'] === $partner->id));
        $this->assertTrue($rows->contains('id', $payout->id));
        $this->assertFalse($rows->contains('id', $otherPayout->id));
        $this->assertSame($partner->id, Payout::find($payout->id)->delivery_partner_id);
    }

    public function test_excessively_long_remarks_are_rejected(): void
    {
        $admin = $this->makeAdmin();
        [, $vendor] = $this->makeVendor();
        $payout = $this->makeVendorPayout($vendor, 200);

        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", [
            'admin_remark' => str_repeat('a', 1001),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('admin_remark');

        $payout->refresh();
        $this->assertSame('PENDING', $payout->status);
        $this->assertNull($payout->admin_remark);
    }

    public function test_duplicate_mark_paid_requests_do_not_duplicate_financial_effects(): void
    {
        $admin = $this->makeAdmin();
        [, $vendor] = $this->makeVendor();
        $payout = $this->makeVendorPayout($vendor, 200);

        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => self::REMARK])
            ->assertOk();

        $wallet = Wallet::where('user_id', $vendor->user_id)->where('wallet_type', 'vendor')->firstOrFail();
        $balanceAfterFirst = (float) $wallet->balance;

        // Replay with a different note: the payout stays paid, the original
        // remark is not overwritten and no second debit is recorded.
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid", ['admin_remark' => 'Second attempt'])
            ->assertOk()
            ->assertJsonPath('data.admin_remark', self::REMARK);

        $this->assertSame($balanceAfterFirst, (float) $wallet->fresh()->balance);
        $this->assertSame(self::REMARK, $payout->fresh()->admin_remark);
        $this->assertSame(1, Payout::whereKey($payout->id)->count());
        $this->assertSame(
            1,
            WalletTransaction::where('idempotency_key', 'admin-payout-paid:'.$payout->id)->count(),
        );
    }

    public function test_existing_failed_and_listing_workflows_still_work(): void
    {
        $admin = $this->makeAdmin();
        [, $vendor] = $this->makeVendor();
        $failedPayout = $this->makeVendorPayout($vendor, 200, 'WD_TO_FAIL');
        $paidPayout = $this->makeVendorPayout($vendor, 250, 'WD_TO_PASS');

        Sanctum::actingAs($admin, ['*']);

        $this->postJson("/api/v1/admin/payouts/{$failedPayout->id}/failed", ['reason' => 'Bank rejected'])
            ->assertOk()
            ->assertJsonPath('data.status', 'FAILED')
            ->assertJsonPath('data.failure_reason', 'Bank rejected');

        $this->postJson("/api/v1/admin/payouts/{$paidPayout->id}/paid", ['admin_remark' => self::REMARK])
            ->assertOk();

        $this->getJson('/api/v1/admin/payouts?party_type=vendor')
            ->assertOk()
            ->assertJsonStructure(['data' => ['data' => [['id', 'payout_number', 'amount', 'status', 'admin_remark']]]])
            ->assertJsonFragment([
                'id' => $paidPayout->id,
                'admin_remark' => self::REMARK,
            ]);
    }

    public function test_payouts_without_a_remark_remain_backward_compatible(): void
    {
        $admin = $this->makeAdmin();
        [$vendorUser, $vendor] = $this->makeVendor();
        $payout = $this->makeVendorPayout($vendor, 200);

        Sanctum::actingAs($admin, ['*']);

        // Existing clients may keep posting an empty body.
        $this->postJson("/api/v1/admin/payouts/{$payout->id}/paid")
            ->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.admin_remark', null);

        $this->assertNull($payout->fresh()->admin_remark);

        Sanctum::actingAs($vendorUser, ['*']);
        $rows = collect($this->getJson('/api/v1/vendor/payouts')->json('data'));
        $this->assertSame($payout->id, $rows[0]['id']);
        $this->assertNull($rows[0]['admin_remark']);
    }

    private function makeVendor(string $name = 'Remark Test Kitchen'): array
    {
        $user = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']));

        $vendor = Vendor::create([
            'user_id' => $user->id,
            'business_name' => $name,
            'owner_name' => 'Owner',
            'phone' => '9'.random_int(100000000, 999999999),
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
        ]);

        return [$user->fresh(), $vendor];
    }

    private function makePartner(string $name = 'Remark Test Partner'): array
    {
        $user = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true, 'name' => $name]);
        $user->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        $partner = DeliveryPartner::create([
            'user_id' => $user->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => false,
        ]);

        return [$user->fresh(), $partner];
    }

    private function makeVendorPayout(Vendor $vendor, float $amount, ?string $number = null): Payout
    {
        app(WalletService::class)->credit(
            $vendor->user,
            'vendor',
            $amount,
            'CREDIT',
            null,
            null,
            'Test wallet seed',
            'seed-vendor-'.$vendor->id.'-'.Str::random(8),
        );

        return Payout::create([
            'payout_number' => $number ?? 'WD_'.strtoupper(Str::random(12)),
            'party_type' => 'vendor',
            'vendor_id' => $vendor->id,
            'amount' => $amount,
            'currency' => 'INR',
            'bank_account_name' => 'Vendor Account',
            'bank_account_number' => '1234567890',
            'bank_ifsc' => 'SBIN000987',
            'bank_name' => 'SBI',
            'status' => 'PENDING',
            'mode' => 'bank_transfer',
            'idempotency_key' => 'TEST_VENDOR_'.Str::random(12),
            'meta' => ['service' => 'vendor'],
        ]);
    }

    private function makePartnerPayout(DeliveryPartner $partner, float $amount, ?string $number = null): Payout
    {
        app(WalletService::class)->credit(
            $partner->user,
            'delivery_partner',
            $amount,
            'CREDIT',
            null,
            null,
            'Test wallet seed',
            'seed-partner-'.$partner->id.'-'.Str::random(8),
        );

        return Payout::create([
            'payout_number' => $number ?? 'WD_'.strtoupper(Str::random(12)),
            'party_type' => 'delivery_partner',
            'delivery_partner_id' => $partner->id,
            'amount' => $amount,
            'currency' => 'INR',
            'bank_account_name' => 'Partner Account',
            'bank_account_number' => '0987654321',
            'bank_ifsc' => 'SBIN000876',
            'bank_name' => 'SBI',
            'status' => 'PENDING',
            'mode' => 'bank_transfer',
            'idempotency_key' => 'TEST_PARTNER_'.Str::random(12),
            'meta' => ['service' => 'delivery_partner'],
        ]);
    }

    private function makeAdmin(): User
    {
        $admin = User::factory()->create(['user_type' => 'super_admin', 'is_active' => true]);
        $role = Role::firstOrCreate(['slug' => 'super_admin'], ['name' => 'SUPER_ADMIN']);
        $admin->roles()->sync([$role->id]);

        return $admin;
    }

    private function makeCustomer(): User
    {
        return User::factory()->create(['user_type' => 'customer']);
    }
}
