<?php

namespace App\Http\Controllers\API;

use App\Services\PaymentService;
use App\Services\WalletService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class WalletController extends BaseController
{
    public function __construct(
        private WalletService $walletService,
        private PaymentService $paymentService,
    ) {}

    public function show(Request $request)
    {
        $wallet = $this->walletService->ensureWallet($request->user(), 'customer');

        return $this->success($wallet);
    }

    public function transactions(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'sometimes|in:CREDIT,DEBIT',
            'from' => 'sometimes|date',
            'to' => 'sometimes|date',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $transactions = $this->walletService->getTransactions(
            $request->user(),
            'customer',
            $validator->validated(),
            $request->get('per_page', 15)
        );

        return $this->success($transactions);
    }

    public function topup(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:upi,card,net_banking,wallet',
            'idempotency_key' => 'sometimes|string|max:120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            if (Str::contains((string) $request->input('amount'), [',', ' '])) {
                return $this->error('Invalid amount format', null, 422);
            }

            $payment = $this->paymentService->initiateWalletTopup(
                $request->user(),
                Money::fromMajor($request->input('amount')),
                $request->input('payment_method'),
                $request->input('idempotency_key')
            );

            $gateway = $this->paymentService->gateway();
            $isMock = str_contains(get_class($gateway), 'MockPaymentProvider');

            return $this->success([
                'payment_number' => $payment->payment_number,
                'provider_order_id' => $payment->provider_order_id,
                'amount_paise' => (int) $payment->amount_paise,
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency ?: 'INR',
                'method' => $payment->method,
                'key_id' => $isMock ? 'mock' : (config('integrations.credentials.payments.key_id') ?: null),
                'mock' => $isMock,
            ], 'Payment intent created', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function verifyTopup(Request $request)
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

            $wallet = $this->walletService->ensureWallet($request->user(), 'customer');

            return $this->success([
                'status' => $result['status'],
                'already_processed' => $result['already_processed'] ?? false,
                'wallet' => $wallet->fresh(),
                'payment_number' => $result['payment']->payment_number,
            ], 'Top-up verified');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }
}
