<?php

namespace App\Infrastructure\Providers\Payments;

use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/**
 * Deterministic payments provider for test/local/mock environments.
 *
 * Created orders/payments are remembered in-process so server-side
 * verification and reconciliation can be exercised end-to-end.
 */
class MockPaymentProvider extends AbstractIntegrationProvider implements PaymentGatewayInterface, TestableProvider
{
    /** @var array<string, array{payment_id: string, order_id: string, amount: int, currency: string}> */
    private static array $registry = [];

    public function createPayment(array $data): array
    {
        return $this->register($data);
    }

    public function createOrder(array $data): array
    {
        $payment = $this->register($data);

        return [
            'id' => $payment['order_id'],
            'order_id' => $payment['order_id'],
            'payment_id' => $payment['payment_id'],
            'amount' => $payment['amount'],
            'currency' => $payment['currency'],
            'status' => 'created',
            'mock' => true,
        ];
    }

    public function verifyPayment(string $paymentId): array
    {
        return $this->statusFor($paymentId);
    }

    public function fetchOrderStatus(string $orderId): array
    {
        foreach (self::$registry as $entry) {
            if ($entry['order_id'] === $orderId) {
                return $this->statusFor($entry['payment_id']);
            }
        }

        return [
            'status' => 'pending',
            'payment_id' => null,
            'order_id' => $orderId,
            'amount' => null,
            'currency' => null,
            'method' => null,
            'raw' => ['mock' => true],
        ];
    }

    public function refund(array $data): array
    {
        return [
            'id' => 'ref_'.Str::random(16),
            'payment_id' => $data['payment_id'] ?? null,
            'status' => 'refunded',
            'amount' => $data['amount_paise'] ?? $data['amount'] ?? 0,
            'currency' => $data['currency'] ?? 'INR',
            'mock' => true,
        ];
    }

    public function verifyWebhookSignature(string $body, string $signature): bool
    {
        return true;
    }

    public function verifyPaymentSignature(array $data, string $signature): bool
    {
        return true;
    }

    public function getPaymentStatus(string $paymentId): array
    {
        return $this->verifyPayment($paymentId);
    }

    public static function paymentIdForOrder(string $orderId): string
    {
        return 'pay_'.substr(hash('sha256', $orderId), 0, 16);
    }

    public function testConnection(): array
    {
        return ['success' => true, 'message' => 'Mock payments provider ready.'];
    }

    private function register(array $data): array
    {
        $orderId = 'order_'.Str::random(16);
        $paymentId = self::paymentIdForOrder($orderId);
        $amount = (int) ($data['amount_paise'] ?? (round((float) ($data['amount'] ?? 0) * 100)));
        $currency = (string) ($data['currency'] ?? 'INR');

        self::$registry[$paymentId] = [
            'payment_id' => $paymentId,
            'order_id' => $orderId,
            'amount' => $amount,
            'currency' => $currency,
        ];

        return self::$registry[$paymentId];
    }

    private function statusFor(string $paymentId): array
    {
        if (str_starts_with($paymentId, 'pay_fail_')) {
            return [
                'status' => 'failed',
                'payment_id' => $paymentId,
                'order_id' => null,
                'amount' => null,
                'currency' => null,
                'method' => null,
                'raw' => ['mock' => true, 'sentinel' => 'pay_fail_'],
            ];
        }

        $entry = Arr::get(self::$registry, $paymentId);

        if (! $entry) {
            return [
                'status' => 'unknown',
                'payment_id' => $paymentId,
                'order_id' => null,
                'amount' => null,
                'currency' => null,
                'method' => null,
                'raw' => ['mock' => true],
            ];
        }

        return [
            'status' => 'captured',
            'payment_id' => $entry['payment_id'],
            'order_id' => $entry['order_id'],
            'amount' => $entry['amount'],
            'currency' => $entry['currency'],
            'method' => null,
            'raw' => ['mock' => true],
        ];
    }
}
