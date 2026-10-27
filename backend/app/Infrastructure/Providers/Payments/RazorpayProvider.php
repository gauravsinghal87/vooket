<?php

namespace App\Infrastructure\Providers\Payments;

use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use App\Infrastructure\Interfaces\TestableProvider;
use App\Infrastructure\Providers\AbstractIntegrationProvider;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

class RazorpayProvider extends AbstractIntegrationProvider implements PaymentGatewayInterface, TestableProvider
{
    protected string $baseUrl = 'https://api.razorpay.com';

    protected function client(): PendingRequest
    {
        return Http::connectTimeout(10)
            ->timeout(30)
            ->withBasicAuth($this->cred('key_id'), (string) $this->cred('key_secret'))
            ->acceptJson();
    }

    public function createPayment(array $data): array
    {
        $amount = (int) ($data['amount_paise'] ?? $this->toPaise($data['amount'] ?? 0));
        $res = $this->client()->post("{$this->baseUrl}/v1/payment_links", [
            'amount' => $amount,
            'currency' => $data['currency'] ?? 'INR',
            'description' => $data['description'] ?? null,
            'customer' => [
                'name' => $data['customer_name'] ?? null,
                'email' => $data['customer_email'] ?? null,
                'contact' => $data['customer_contact'] ?? null,
            ],
            'notes' => $data['notes'] ?? [],
        ]);

        $res->throw();

        return $res->json();
    }

    public function createOrder(array $data): array
    {
        $amount = (int) ($data['amount_paise'] ?? $this->toPaise($data['amount'] ?? 0));
        $res = $this->client()->post("{$this->baseUrl}/v1/orders", [
            'amount' => $amount,
            'currency' => $data['currency'] ?? 'INR',
            'receipt' => $data['receipt'] ?? null,
            'notes' => $data['notes'] ?? [],
        ]);

        $res->throw();

        return $res->json();
    }

    public function verifyPayment(string $paymentId): array
    {
        $res = $this->client()->get("{$this->baseUrl}/v1/payments/{$paymentId}");
        $res->throw();

        return $this->normalizePayment($res->json());
    }

    public function fetchOrderStatus(string $orderId): array
    {
        $res = $this->client()->get("{$this->baseUrl}/v1/orders/{$orderId}/payments");
        $res->throw();

        $body = $res->json();
        $items = $body['items'] ?? [];

        if (! is_array($items) || count($items) === 0) {
            return [
                'status' => 'pending',
                'payment_id' => null,
                'order_id' => $orderId,
                'amount' => null,
                'currency' => null,
                'method' => null,
                'raw' => $body,
            ];
        }

        $payment = end($items);

        return $this->normalizePayment($payment, $orderId);
    }

    public function refund(array $data): array
    {
        $paymentId = $data['payment_id'] ?? null;
        $res = $this->client()->post("{$this->baseUrl}/v1/payments/{$paymentId}/refund", [
            'amount' => $data['amount_paise'] ?? $data['amount'] ?? null,
            'notes' => $data['notes'] ?? [],
        ]);
        $res->throw();

        return $res->json();
    }

    public function verifyWebhookSignature(string $body, string $signature): bool
    {
        $secret = (string) $this->cred('webhook_secret');

        if (! $secret) {
            throw new \RuntimeException('RAZORPAY_WEBHOOK_SECRET is not configured.');
        }

        $expected = hash_hmac('sha256', $body, $secret);

        return hash_equals($expected, $signature);
    }

    public function verifyPaymentSignature(array $data, string $signature): bool
    {
        $orderId = $data['provider_order_id'] ?? $data['order_id'] ?? null;
        $paymentId = $data['provider_payment_id'] ?? $data['payment_id'] ?? null;

        if (! $orderId || ! $paymentId) {
            return false;
        }

        $secret = (string) $this->cred('key_secret');

        if (! $secret) {
            throw new \RuntimeException('RAZORPAY_KEY_SECRET is not configured.');
        }

        $expected = hash_hmac('sha256', "{$orderId}|{$paymentId}", $secret);

        return hash_equals($expected, $signature);
    }

    public function getPaymentStatus(string $paymentId): array
    {
        return $this->verifyPayment($paymentId);
    }

    /**
     * Normalize a Razorpay payment object into the shared status payload.
     */
    private function normalizePayment(array $payment, ?string $orderId = null): array
    {
        $rawStatus = strtolower((string) ($payment['status'] ?? ''));

        return [
            'status' => match ($rawStatus) {
                'captured', 'refunded', 'partially_refunded' => 'captured',
                'authorized' => 'authorized',
                'failed' => 'failed',
                'cancelled' => 'cancelled',
                'pending' => 'pending',
                default => 'attempted',
            },
            'payment_id' => $payment['id'] ?? null,
            'order_id' => $payment['order_id'] ?? $orderId,
            'amount' => (int) ($payment['amount'] ?? 0),
            'currency' => $payment['currency'] ?? null,
            'method' => $payment['method'] ?? null,
            'raw' => $payment,
        ];
    }

    public function autoVerifySignature(array $body, string $signature): bool
    {
        return $this->verifyWebhookSignature(json_encode($body, JSON_UNESCAPED_SLASHES), $signature);
    }

    public function testConnection(): array
    {
        try {
            $res = $this->client()->get("{$this->baseUrl}/v1/orders", ['count' => 1]);
            if ($res->successful()) {
                return ['success' => true, 'message' => 'Razorpay connection working.'];
            }

            return ['success' => false, 'message' => "Razorpay responded with HTTP {$res->status()}."];
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => $this->diagnose($e)];
        }
    }

    /**
     * Turn a connection failure into an actionable message without leaking
     * credentials. TLS trust problems (cURL error 60) are called out
     * explicitly because they are a server CA-bundle misconfiguration, not a
     * Razorpay credential problem.
     */
    private function diagnose(\Throwable $e): string
    {
        $raw = $e->getMessage();
        $isTls = str_contains($raw, 'cURL error 60')
            || stripos($raw, 'SSL certificate problem') !== false
            || stripos($raw, 'certificate verify failed') !== false;

        if ($isTls) {
            $bundle = (string) config('http.ca_bundle');

            return 'TLS certificate validation failed (cURL error 60). The server could not verify Razorpay\'s TLS certificate, which means PHP/cURL has no usable CA bundle. '
                .'Fix: configure `curl.cainfo` and `openssl.cafile` in php.ini to a valid CA bundle (restart Apache/PHP), or set HTTP_CA_BUNDLE to a readable bundle path. '
                .'Active CA bundle: '.($bundle !== '' ? $bundle : '(none)').'.';
        }

        if (str_contains($raw, 'cURL error 28') || stripos($raw, 'timed out') !== false) {
            return 'Timed out connecting to Razorpay. Check outbound network access/firewall.';
        }

        if (str_contains($raw, 'cURL error 6') || str_contains($raw, 'Could not resolve host')) {
            return 'Could not resolve api.razorpay.com. Check DNS/network connectivity.';
        }

        return 'Razorpay connection failed: '.$raw;
    }

    private function toPaise(mixed $major): int
    {
        $amount = (float) $major;

        return (int) round($amount * 100);
    }
}
