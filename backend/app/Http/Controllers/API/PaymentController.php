<?php

namespace App\Http\Controllers\API;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Ride;
use App\Services\Integration\IntegrationConfigResolver;
use App\Services\PaymentService;
use App\Services\WalletService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PaymentController extends BaseController
{
    public function __construct(
        private PaymentService $paymentService,
        private WalletService $walletService,
        private IntegrationConfigResolver $integrationConfigResolver,
    ) {}

    public function initiate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payable_type' => 'required|in:order,ride',
            'payable_id' => 'required|integer',
            'payment_method' => 'required|in:upi,card,net_banking,wallet',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $modelClass = match ($request->payable_type) {
                'order' => Order::class,
                'ride' => Ride::class,
                default => null,
            };

            if (! $modelClass) {
                return $this->error('Unsupported payable type', null, 422);
            }

            $payable = $modelClass::find($request->payable_id);

            if (! $payable) {
                return $this->error('Payable not found', null, 404);
            }

            $payment = $this->paymentService->initiatePayable(
                $request->user(),
                $payable,
                $request->input('payment_method'),
                $request->input('idempotency_key')
            );

            return $this->success($this->checkoutPayload($payment), 'Payment initiated', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function verify(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_number' => 'required|string',
            'provider_payment_id' => 'required|string',
            'provider_order_id' => 'required|string',
            'signature' => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $result = $this->paymentService->verifyPayment(
                $request->user(),
                $request->input('payment_number'),
                $request->input('provider_order_id'),
                $request->input('provider_payment_id'),
                $request->input('signature'),
                $request->ip(),
                $request->userAgent()
            );

            $payment = $result['payment'];

            return $this->success([
                'status' => $result['status'],
                'already_processed' => $result['already_processed'] ?? false,
                'payment_number' => $payment->payment_number,
                'paid_at' => $payment->paid_at,
                'wallet' => $this->walletService->ensureWallet($request->user(), 'customer'),
            ], 'Payment verified');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    private function checkoutPayload(Payment $payment): array
    {
        $gateway = $this->paymentService->gateway();
        $isMock = str_contains(get_class($gateway), 'MockPaymentProvider');

        return [
            'payment_number' => $payment->payment_number,
            'provider_order_id' => $payment->provider_order_id,
            'amount_paise' => (int) $payment->amount_paise,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency ?: 'INR',
            'method' => $payment->method,
            'key_id' => $isMock ? 'mock' : ($this->integrationConfigResolver->credentials('payments')['key_id'] ?? null),
            'mock' => $isMock,
        ];
    }
}
