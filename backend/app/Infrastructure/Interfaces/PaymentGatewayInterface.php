<?php

namespace App\Infrastructure\Interfaces;

interface PaymentGatewayInterface
{
    /**
     * Initialize a payment
     */
    public function createPayment(array $data): array;

    /**
     * Create an order for payment
     */
    public function createOrder(array $data): array;

    /**
     * Verify and confirm a payment by provider payment id.
     *
     * Returns a normalized status payload:
     *   status: captured|authorized|attempted|failed|pending|unknown
     *   payment_id, order_id, amount (paise), currency, method, raw
     */
    public function verifyPayment(string $paymentId): array;

    /**
     * Fetch the status of an order from the provider (server-side).
     * Same normalized payload shape as verifyPayment().
     */
    public function fetchOrderStatus(string $orderId): array;

    /**
     * Process a refund
     */
    public function refund(array $data): array;

    /**
     * Verify a webhook signature against the raw request body.
     */
    public function verifyWebhookSignature(string $body, string $signature): bool;

    /**
     * Verify the client payment signature (order_id|payment_id HMAC).
     */
    public function verifyPaymentSignature(array $data, string $signature): bool;

    /**
     * Get payment status
     */
    public function getPaymentStatus(string $paymentId): array;
}
