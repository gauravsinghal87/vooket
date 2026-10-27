<?php

namespace App\Infrastructure\Providers\Implementations;

use App\Infrastructure\Interfaces\PaymentGatewayInterface;
use Illuminate\Support\Facades\Log;

class LogPaymentGateway implements PaymentGatewayInterface
{
    public function createPayment(array $data): array
    {
        Log::info('[PAYMENT] createPayment', $data);

        return [
            'id' => 'pay_'.uniqid(),
            'status' => 'created',
            'link' => null,
        ];
    }

    public function createOrder(array $data): array
    {
        Log::info('[PAYMENT] createOrder', $data);

        return [
            'id' => 'order_'.uniqid(),
            'amount' => $data['amount'] ?? 0,
            'status' => 'created',
        ];
    }

    public function verifyPayment(string $paymentId): array
    {
        Log::info('[PAYMENT] verifyPayment', ['id' => $paymentId]);

        return [
            'id' => $paymentId,
            'status' => 'captured',
            'amount' => 0,
        ];
    }

    public function refund(array $data): array
    {
        Log::info('[PAYMENT] refund', $data);

        return [
            'id' => 'refund_'.uniqid(),
            'status' => 'processed',
        ];
    }

    public function verifyWebhookSignature(array $payload, string $signature): bool
    {
        return true;
    }

    public function getPaymentStatus(string $paymentId): array
    {
        Log::info('[PAYMENT] getPaymentStatus', ['id' => $paymentId]);

        return ['id' => $paymentId, 'status' => 'captured'];
    }
}
