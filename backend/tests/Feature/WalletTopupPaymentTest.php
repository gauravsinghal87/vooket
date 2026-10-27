<?php

namespace Tests\Feature;

use App\Infrastructure\Providers\Payments\MockPaymentProvider;
use App\Models\Payment;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WalletTopupPaymentTest extends TestCase
{
    use RefreshDatabase;

    private function makeCustomer(string $phone = '9110000001'): User
    {
        return User::create(['name' => 'Customer', 'phone' => $phone, 'user_type' => 'customer', 'is_active' => true]);
    }

    public function test_topup_initiates_a_payment_intent(): void
    {
        $customer = $this->makeCustomer();

        Sanctum::actingAs($customer, ['*']);

        $response = $this->postJson('/api/v1/wallet/topup', [
            'amount' => 250.0,
            'payment_method' => 'upi',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.payment_number', Payment::first()->payment_number)
            ->assertJsonPath('data.provider_order_id', Payment::first()->provider_order_id)
            ->assertJsonPath('data.amount_paise', 25000)
            ->assertJsonPath('data.mock', true);

        $this->assertDatabaseHas('payments', [
            'status' => 'INITIATED',
            'payable_type' => Wallet::class,
            'amount_paise' => 25000,
        ]);
    }

    public function test_verify_topup_credits_the_wallet_exactly_once(): void
    {
        $customer = $this->makeCustomer();

        Sanctum::actingAs($customer, ['*']);

        $initiate = $this->postJson('/api/v1/wallet/topup', [
            'amount' => 250.0,
            'payment_method' => 'upi',
        ])->assertStatus(201);

        $payload = $initiate->json('data');

        $verify = $this->postJson('/api/v1/wallet/verify-payment', [
            'payment_number' => $payload['payment_number'],
            'provider_order_id' => $payload['provider_order_id'],
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($payload['provider_order_id']),
            'signature' => 'sig_test',
        ]);

        $verify->assertOk()
            ->assertJsonPath('data.status', 'SUCCESS')
            ->assertJsonPath('data.wallet.balance', '250.00');

        $this->assertDatabaseHas('payments', ['payment_number' => $payload['payment_number'], 'status' => 'SUCCESS']);
        $this->assertDatabaseHas('wallet_transactions', [
            'user_id' => $customer->id,
            'type' => 'TOP_UP',
            'direction' => 'credit',
            'status' => 'completed',
        ]);

        $second = $this->postJson('/api/v1/wallet/verify-payment', [
            'payment_number' => $payload['payment_number'],
            'provider_order_id' => $payload['provider_order_id'],
            'provider_payment_id' => MockPaymentProvider::paymentIdForOrder($payload['provider_order_id']),
            'signature' => 'sig_test',
        ]);

        $second->assertOk()->assertJsonPath('data.already_processed', true);
        $this->assertSame('250.00', (string) Wallet::where('user_id', $customer->id)->value('balance'));
        $this->assertSame(1, WalletTransaction::where('user_id', $customer->id)->where('type', 'TOP_UP')->count());
    }

    public function test_topup_outside_allowed_range_is_rejected(): void
    {
        $customer = $this->makeCustomer();

        Sanctum::actingAs($customer, ['*']);

        $this->postJson('/api/v1/wallet/topup', [
            'amount' => 2.0,
            'payment_method' => 'upi',
        ])->assertStatus(422);
    }
}
