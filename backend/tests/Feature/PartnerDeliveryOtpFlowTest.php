<?php

namespace Tests\Feature;

use App\Infrastructure\Interfaces\SmsProviderInterface;
use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\Order;
use App\Models\OtpCode;
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

class PartnerDeliveryOtpFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

    public function test_resend_while_a_live_otp_exists_returns_the_active_code_without_minting_another(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        $existing = $this->liveDeliveryOtp($order);
        $this->assertNotNull($existing);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/delivery-otp")
            ->assertOk()
            ->assertJsonPath('data.active', true)
            ->assertJsonPath('data.expires_at', $existing->expires_at->toISOString())
            ->assertJsonPath('data.resend_count', 1)
            ->assertJsonPath('data.limit_reached', false);

        $this->assertSame($existing->id, $this->liveDeliveryOtp($order)->id, 'A live code must not be replaced');
        $this->assertSame(1, $order->fresh()->delivery_otp_resend_count, 'Resend of a live code must not burn budget');
    }

    public function test_resend_after_code_expiry_mints_a_fresh_code_despite_reaching_the_resend_cap(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        // The reported production failure: the resend cap (3) was exhausted and
        // the outstanding code had expired, so every resend failed with 400 and
        // the delivery could not complete. The corrected lifecycle starts a
        // fresh budget when no usable code survives.
        $order->update(['delivery_otp_resend_count' => 3]);

        $old = $this->liveDeliveryOtp($order);
        $old->forceFill([
            'created_at' => now()->subMinutes(5),
            'expires_at' => now()->subMinute(),
        ])->save();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/delivery-otp")
            ->assertOk()
            ->assertJsonPath('data.active', true)
            ->assertJsonPath('data.resend_count', 1)
            ->assertJsonPath('data.limit_reached', false);

        $fresh = $this->liveDeliveryOtp($order);
        $this->assertNotNull($fresh);
        $this->assertNotSame($old->id, $fresh->id, 'An expired code must be replaced by a fresh one');
        $this->assertSame(1, $order->fresh()->delivery_otp_resend_count, 'The dead lifecycle budget must reset');

        // The fresh code completes the flow end to end.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $fresh->otp])
            ->assertOk();

        $this->assertNotNull($order->fresh()->delivery_otp_verified_at);
    }

    public function test_invalid_delivery_otp_is_rejected_and_exhausted_after_max_attempts(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        // Capture before exhaustion: the record is deleted on the 5th miss.
        $realOtp = $this->liveDeliveryOtp($order)->otp;

        Sanctum::actingAs($partner->user, ['*']);

        for ($i = 0; $i < 4; $i++) {
            $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => '000000'])
                ->assertStatus(400)
                ->assertJsonPath('message', 'Invalid OTP');
        }

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => '000000'])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Too many attempts. Please request a new OTP.');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $realOtp])
            ->assertStatus(400)
            ->assertJsonPath('message', 'Invalid or expired OTP');

        $this->assertNull($order->fresh()->delivery_otp_verified_at);
    }

    public function test_confirm_cash_collection_is_wallet_neutral_and_settlement_is_single(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        // Partner already has own funds (from prior earnings) to settle.
        $this->fundPartnerWallet($partner, (float) $order->total_amount);

        Sanctum::actingAs($partner->user, ['*']);

        // Confirming cash must NOT credit the customer's money as a wallet
        // balance — it only records the cash collection.
        $confirm = $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'pending');

        $this->assertSame('cash', $order->fresh()->delivery_payment_collected_via);
        $this->assertNotNull($order->fresh()->delivery_payment_collected_at);
        $this->assertSame(0, WalletTransaction::where('user_id', $partner->user_id)
            ->whereIn('type', ['CASH_COLLECTION', 'SETTLEMENT'])
            ->count(), 'Confirming cash must not create any wallet transaction');

        // Settling creates exactly one SETTLEMENT debit.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        // Re-settling (double-click / retry / page refresh) is idempotent.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $settlements = WalletTransaction::where('user_id', $partner->user_id)
            ->where('type', 'SETTLEMENT')
            ->get();

        $this->assertSame(1, $settlements->count(), 'Only one settlement debit is allowed per order');
        $this->assertSame((float) $order->total_amount, (float) $settlements->first()->amount);
        $this->assertSame('SETTLEMENT', $settlements->first()->type);
        $this->assertNotNull($order->fresh()->delivery_payment_settled_at);
    }

    public function test_qr_attestation_is_rejected(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'qr'])
            ->assertStatus(422);

        $this->assertNull($order->fresh()->delivery_payment_collected_at);
        $this->assertSame(0, WalletTransaction::where('user_id', $partner->user_id)->count());
    }

    public function test_settlement_pends_when_wallet_cannot_cover_the_collected_cash(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        $this->fundPartnerWallet($partner, 50);

        Sanctum::actingAs($partner->user, ['*']);

        $res = $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertOk();

        $this->assertSame((float) $order->total_amount, (float) $res->json('data.payment.required'));
        $this->assertSame('pending', $res->json('data.payment.settlement'));
        $this->assertSame(50.0, (float) $res->json('data.payment.available'));
        $this->assertSame(round((float) $order->total_amount - 50, 2), (float) $res->json('data.payment.shortfall'));

        $fresh = $order->fresh();
        $this->assertSame('cash', $fresh->delivery_payment_collected_via);
        $this->assertNull($fresh->delivery_payment_settled_at);

        // An uncovered settle attempt books no debit at all.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'pending')
            ->assertJsonPath('data.settled', false);

        $this->assertSame(0, WalletTransaction::where('user_id', $partner->user_id)
            ->whereIn('type', ['CASH_COLLECTION', 'SETTLEMENT'])
            ->count(), 'Confirming or attempting an uncovered settlement must not create a wallet transaction');

        // The food delivery gate refuses delivery until the cash is settled.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Cash collected for this order must be settled in the partner wallet before marking as delivered');
    }

    public function test_partner_funds_the_wallet_then_settles_cash_and_delivers_with_a_single_earning(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        $this->fundPartnerWallet($partner, 50);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertJsonPath('data.payment.settlement', 'pending');

        // Balance of 50 cannot cover a 230 settlement yet.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'pending');

        // Partner tops up the shortfall; settling now succeeds — and a retry
        // stays at exactly one debit.
        $this->fundPartnerWallet($partner, (float) $order->total_amount - 50);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $this->assertNotNull($order->fresh()->delivery_payment_settled_at);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $this->liveDeliveryOtp($order)->otp])
            ->assertOk();

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DELIVERED');

        $this->assertSame(1, $partner->fresh()->total_deliveries);

        $types = WalletTransaction::where('user_id', $partner->user_id)
            ->where('service', 'food')
            ->orderBy('id')
            ->pluck('type')
            ->all();
        $this->assertSame(['SETTLEMENT', 'EARNING'], $types);
    }

    private function fundPartnerWallet(DeliveryPartner $partner, float $amount): void
    {
        app(WalletService::class)->credit(
            $partner->user,
            'delivery_partner',
            $amount,
            'TOP_UP',
            null,
            null,
            'Test funding',
            'test-funding:'.$partner->id.':'.$amount.':'.Str::random(4)
        );
    }

    public function test_verify_otp_is_idempotent_after_success(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        Sanctum::actingAs($partner->user, ['*']);

        $otp = $this->liveDeliveryOtp($order)->otp;

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $otp])
            ->assertOk();

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $otp])
            ->assertOk();

        $this->assertNotNull($order->fresh()->delivery_otp_verified_at);
    }

    public function test_grocery_delivery_uses_the_shared_delivery_otp_and_is_gated_by_payment_and_otp(): void
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedGroceryOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up'])
            ->assertOk();
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'out_for_delivery'])
            ->assertOk();
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertOk()
            ->assertJsonPath('data.status', 'ARRIVED');

        $otp = $this->liveDeliveryOtp($order);
        $this->assertNotNull($otp, 'Arrival should auto-generate a delivery OTP for grocery orders');

        // Only the order's owner can read the active grocery OTP.
        Sanctum::actingAs($order->user, ['*']);
        $this->getJson("/api/v1/orders/{$order->id}/delivery-otp")
            ->assertOk()
            ->assertJsonPath('data.otp', $otp->otp);

        // Pay the grocery order online through the Razorpay flow.
        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'card',
            'idempotency_key' => 'groc:'.$order->id,
        ])->assertStatus(201);

        $providerOrderId = $initiate->json('data.provider_order_id');
        $providerPaymentId = MockPaymentProvider::paymentIdForOrder($providerOrderId);

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => $providerPaymentId,
            'signature' => 'mock',
        ])->assertOk();

        $this->assertSame('paid', $order->fresh()->payment_status);

        // Grocery has no cash collection path once paid online; backend must refuse.
        Sanctum::actingAs($partner->user, ['*']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'No cash to collect for this order');

        // Even with payment satisfied, delivered is blocked until the OTP is verified.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Customer delivery OTP must be verified before marking as delivered');

        $this->assertNull($order->fresh()->delivery_otp_verified_at);
        $this->assertSame('ARRIVED', $order->fresh()->status);

        // Verify the customer's shared grocery OTP once, then mark delivered.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $otp->otp])
            ->assertOk();

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DELIVERED');

        $this->assertNotNull($order->fresh()->delivery_otp_verified_at);
        $this->assertNotNull($order->fresh()->delivered_at);
    }

    public function test_delivery_otp_is_never_sent_via_sms(): void
    {
        $recorder = new class
        {
            public array $otps = [];
        };

        $this->app->instance(SmsProviderInterface::class, new class($recorder) implements SmsProviderInterface
        {
            public function __construct(private object $recorder) {}

            public function send(string $phoneNumber, string $message, array $options = []): bool
            {
                return true;
            }

            public function sendOtp(string $phoneNumber, string $otp): bool
            {
                $this->recorder->otps[] = $otp;

                return true;
            }
        });

        [$order, $partner] = $this->makeArrivedOrder();

        $this->assertSame([], $recorder->otps, 'Delivery OTPs must not be sent over SMS');
        $this->assertStringOfDigits($this->liveDeliveryOtp($order)->otp);
    }

    public function test_customer_can_fetch_the_active_delivery_otp(): void
    {
        [$order] = $this->makeArrivedOrder();

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/delivery-otp")
            ->assertOk()
            ->assertJsonPath('data.otp', $this->liveDeliveryOtp($order)->otp)
            ->assertJsonStructure(['data' => ['otp', 'expires_at']]);
    }

    public function test_another_customer_cannot_fetch_someone_elses_delivery_otp(): void
    {
        [$order] = $this->makeArrivedOrder();

        $stranger = User::factory()->create(['user_type' => 'customer', 'is_active' => true]);

        Sanctum::actingAs($stranger, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/delivery-otp")
            ->assertStatus(404);
    }

    public function test_customer_cannot_fetch_otp_for_an_order_still_at_the_restaurant(): void
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedOrder($partner);

        // Still PARTNER_ASSIGNED — the OTP window (out-for-delivery/arrived)
        // has not opened yet.
        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/delivery-otp")
            ->assertStatus(422);
    }

    public function test_customer_cannot_fetch_delivery_otp_after_it_is_verified(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $this->liveDeliveryOtp($order)->otp])
            ->assertOk();

        Sanctum::actingAs($order->user, ['*']);

        $this->getJson("/api/v1/orders/{$order->id}/delivery-otp")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Delivery OTP has already been verified');
    }

    public function test_customer_can_pay_a_cod_order_online_and_cash_collection_is_then_blocked(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        Sanctum::actingAs($order->user, ['*']);

        $initiate = $this->postJson('/api/v1/payments/initiate', [
            'payable_type' => 'order',
            'payable_id' => $order->id,
            'payment_method' => 'card',
            'idempotency_key' => 'cod-pay:'.$order->id,
        ])->assertStatus(201);

        $providerOrderId = $initiate->json('data.provider_order_id');
        $providerPaymentId = MockPaymentProvider::paymentIdForOrder($providerOrderId);

        $this->postJson('/api/v1/payments/verify', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => $providerPaymentId,
            'signature' => 'mock',
        ])->assertOk();

        $fresh = $order->fresh();
        $this->assertSame('paid', $fresh->payment_status);
        $this->assertSame('online', $fresh->payment_method);
        $this->assertNull($fresh->delivery_payment_collected_at);

        // The partner can no longer collect cash for an online-paid order.
        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'No cash to collect for this order');
    }

    public function test_partner_can_top_up_their_wallet_through_the_razorpay_flow(): void
    {
        [$order, $partner] = $this->makeArrivedOrder();

        Sanctum::actingAs($partner->user, ['*']);

        $initiate = $this->postJson('/api/v1/delivery-partner/wallet/topup', [
            'amount' => 250,
            'payment_method' => 'upi',
            'idempotency_key' => 'partner-topup:'.$partner->id,
        ])->assertStatus(201);

        $this->assertStringNotContainsString('key_secret', strtolower($initiate->getContent()));

        $providerOrderId = $initiate->json('data.provider_order_id');
        $providerPaymentId = MockPaymentProvider::paymentIdForOrder($providerOrderId);

        $verify = $this->postJson('/api/v1/delivery-partner/wallet/verify-topup', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => $providerPaymentId,
            'signature' => 'mock',
        ])->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.wallet.balance', 250);

        // Re-verifying the same payment does not credit the wallet twice.
        $this->postJson('/api/v1/delivery-partner/wallet/verify-topup', [
            'payment_number' => $initiate->json('data.payment_number'),
            'provider_order_id' => $providerOrderId,
            'provider_payment_id' => $providerPaymentId,
            'signature' => 'mock',
        ])->assertOk()
            ->assertJsonPath('data.already_processed', true);

        $wallet = Wallet::where('user_id', $partner->user_id)
            ->where('wallet_type', 'delivery_partner')
            ->firstOrFail();
        $this->assertSame(250.0, (float) $wallet->fresh()->balance);
        $this->assertSame(1, WalletTransaction::where('wallet_id', $wallet->id)->where('type', 'TOP_UP')->count());
    }

    public function test_grocery_cod_cash_collection_and_wallet_settlement_is_single(): void
    {
        [$order, $partner] = $this->makeArrivedGroceryOrder();

        // Partner already has own funds to account for the collected cash.
        $this->fundPartnerWallet($partner, (float) $order->total_amount);

        Sanctum::actingAs($partner->user, ['*']);

        // Confirming cash is wallet-neutral for grocery too.
        $confirm = $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/confirm-payment", ['method' => 'cash'])
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'pending');

        $this->assertSame((float) $order->total_amount, (float) $confirm->json('data.payment.required'));
        $this->assertSame('cash', $order->fresh()->delivery_payment_collected_via);
        $this->assertSame(0, WalletTransaction::where('user_id', $partner->user_id)
            ->whereIn('type', ['CASH_COLLECTION', 'SETTLEMENT'])
            ->count(), 'Confirming grocery cash must not credit the customer money to the wallet');

        // Settle creates exactly one SETTLEMENT debit and is idempotent.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/settle-cash")
            ->assertOk()
            ->assertJsonPath('data.payment.settlement', 'settled');

        $settlements = WalletTransaction::where('user_id', $partner->user_id)
            ->where('type', 'SETTLEMENT')
            ->get();

        $this->assertSame(1, $settlements->count(), 'Only one settlement debit is allowed per grocery order');
        $this->assertSame((float) $order->total_amount, (float) $settlements->first()->amount);
        $this->assertSame('grocery', $settlements->first()->service);
        $this->assertNotNull($order->fresh()->delivery_payment_settled_at);

        // The uncollected-balance gate refuses delivery before OTP for a COD order.
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertStatus(422);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/verify-delivery-otp", ['otp' => $this->liveDeliveryOtp($order)->otp])
            ->assertOk();

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('data.status', 'DELIVERED');

        // Only the configured grocery earning is credited — never the ₹328.
        $grocery = WalletTransaction::where('user_id', $partner->user_id)
            ->where('service', 'grocery')
            ->orderBy('id')
            ->pluck('type')
            ->all();
        $this->assertSame(['SETTLEMENT', 'EARNING'], $grocery);

        $earning = WalletTransaction::where('user_id', $partner->user_id)
            ->where('service', 'grocery')
            ->where('type', 'EARNING')
            ->first();
        $this->assertSame((float) $order->delivery_fee, (float) $earning->amount);
        $this->assertSame('credit', $earning->direction);

        $this->assertSame(1, DeliveryPartnerEarning::where('order_id', $order->id)->count());
        $this->assertSame((float) $order->delivery_fee, (float) $partner->fresh()->total_earnings);
    }

    private function makeArrivedOrder(): array
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'out_for_delivery']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertJsonPath('data.status', 'ARRIVED');

        $this->assertNotNull($this->liveDeliveryOtp($order), 'Arrival should auto-generate a delivery OTP');

        return [$order, $partner];
    }

    private function makeArrivedGroceryOrder(): array
    {
        $partner = $this->makePartner();
        $order = $this->makeAssignedGroceryOrder($partner);

        Sanctum::actingAs($partner->user, ['*']);

        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'picked_up']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'out_for_delivery']);
        $this->postJson("/api/v1/delivery-partner/orders/{$order->id}/status", ['status' => 'arrived'])
            ->assertJsonPath('data.status', 'ARRIVED');

        $this->assertNotNull($this->liveDeliveryOtp($order), 'Arrival should auto-generate a delivery OTP');

        return [$order, $partner];
    }

    private function liveDeliveryOtp(Order $order): ?OtpCode
    {
        return OtpCode::where('order_id', $order->id)
            ->where('purpose', 'delivery')
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->first();
    }

    private function assertStringOfDigits(string $value): void
    {
        $this->assertMatchesRegularExpression('/^\d{6}$/', $value);
    }

    private function makeVendorUser(): User
    {
        $role = Role::firstOrCreate(['slug' => 'vendor'], ['name' => 'Vendor']);
        $vendorUser = User::factory()->create(['user_type' => 'vendor', 'is_active' => true]);
        $vendorUser->roles()->attach($role->id);

        return $vendorUser;
    }

    private function makeVendor(User $vendorUser): Vendor
    {
        return Vendor::create([
            'user_id' => $vendorUser->id,
            'business_name' => 'Otp Kitchen',
            'owner_name' => 'Otp Owner',
            'phone' => '9898989801',
            'vendor_type' => 'restaurant',
            'status' => 'approved',
            'is_active' => true,
            'latitude' => 12.9716,
            'longitude' => 77.5946,
        ]);
    }

    private function makeOrder(Vendor $vendor, string $orderType = 'food'): Order
    {
        $customer = User::factory()->create([
            'user_type' => 'customer',
            'is_active' => true,
            'phone' => '91'.substr((string) hrtime(true), -9).mt_rand(10, 99),
        ]);

        return Order::create([
            'order_number' => 'ORD_'.Str::upper(Str::random(8)),
            'user_id' => $customer->id,
            'vendor_id' => $vendor->id,
            'order_type' => $orderType,
            'status' => 'PARTNER_ASSIGNED',
            'payment_status' => 'pending',
            'payment_method' => 'cash_on_delivery',
            'subtotal' => 200,
            'delivery_fee' => 30,
            'total_amount' => 230,
        ]);
    }

    private function makePartner(): DeliveryPartner
    {
        $partnerUser = User::factory()->create(['user_type' => 'delivery_partner', 'is_active' => true]);
        $partnerUser->roles()->attach(Role::firstOrCreate(['slug' => 'delivery_partner'], ['name' => 'Delivery Partner']));

        return DeliveryPartner::create([
            'user_id' => $partnerUser->id,
            'status' => 'approved',
            'service_type' => 'food',
            'is_online' => true,
            'is_busy' => true,
            'latitude' => 12.9717,
            'longitude' => 77.5947,
            'last_location_at' => now(),
        ]);
    }

    private function makeAssignedOrder(DeliveryPartner $partner): Order
    {
        $vendor = $this->makeVendor($this->makeVendorUser());
        $order = $this->makeOrder($vendor);
        $order->update(['delivery_partner_id' => $partner->id, 'partner_assigned_at' => now()]);

        return $order;
    }

    private function makeAssignedGroceryOrder(DeliveryPartner $partner): Order
    {
        $vendor = $this->makeVendor($this->makeVendorUser());
        $order = $this->makeOrder($vendor, 'grocery');
        $order->update(['delivery_partner_id' => $partner->id, 'partner_assigned_at' => now()]);

        return $order;
    }
}
