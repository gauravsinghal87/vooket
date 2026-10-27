<?php

namespace App\Http\Controllers\API;

use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaymentWebhookController extends BaseController
{
    public function __construct(
        private PaymentService $paymentService,
    ) {}

    public function razorpay(Request $request): JsonResponse
    {
        $signature = (string) $request->header('X-Razorpay-Signature', '');

        if ($signature === '') {
            throw new HttpException(400, 'Missing signature header');
        }

        $gateway = $this->paymentService->gateway();

        if (! $gateway->verifyWebhookSignature($request->getContent(), $signature)) {
            throw new HttpException(401, 'Invalid webhook signature');
        }

        $payload = json_decode($request->getContent(), true);

        if (! is_array($payload)) {
            throw new HttpException(400, 'Invalid webhook payload');
        }

        $this->paymentService->processWebhookEvent(
            $gateway,
            'razorpay',
            $payload,
            $request->ip(),
            $request->userAgent()
        );

        return response()->json(['status' => 'ok']);
    }
}
