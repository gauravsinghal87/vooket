<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Services\GroceryAdjustmentService;
use App\Services\RefundService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RefundController extends BaseController
{
    public function __construct(
        private RefundService $refundService,
        private GroceryAdjustmentService $groceryAdjustmentService,
    ) {}

    public function index(Request $request)
    {
        $query = Refund::query()->with(['user', 'payment']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('payment_id')) {
            $query->where('payment_id', $request->input('payment_id'));
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function show(Refund $refund)
    {
        $refund->load(['user', 'payment', 'approver']);

        return $this->success($refund);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|integer|exists:payments,id',
            'amount' => 'required|numeric|gt:0',
            'reason' => 'required|string|max:100',
            'notes' => 'sometimes|string|max:1000',
            'idempotency_key' => 'sometimes|string|max:120',
            'destination' => 'sometimes|in:wallet,bank,original_payment',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $payment = Payment::findOrFail($request->input('payment_id'));

            $refund = $this->refundService->request(
                $payment->user,
                $payment,
                Money::fromMajor($request->input('amount')),
                $request->input('reason'),
                $request->input('notes'),
                $request->input('idempotency_key'),
                $request->input('destination', RefundService::DESTINATION_ORIGINAL)
            );

            return $this->success($refund, 'Refund requested', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    /**
     * Super-admin one-click refund + revenue reversal for a CANCELLED order.
     * Reverses the order from the super-admin dashboard revenue and from the
     * vendor earnings board (settlement + commission + wallet) atomically;
     * downstream boards updated to treat payment_status REFUNDED as flat-zero.
     */
    public function refundCancelledOrder(Request $request, int $orderId)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'sometimes|string|max:100',
            'notes' => 'sometimes|string|max:1000',
            'destination' => 'sometimes|in:wallet,bank,original_payment',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $order = Order::findOrFail($orderId);
            $amountInput = $request->input('amount');
            $amount = $amountInput !== null
                ? Money::fromMajor((float) $amountInput)
                : Money::fromMajor((float) $order->total_amount);

            $refund = $this->refundService->refundCancelledOrder(
                $order,
                $request->user(),
                $amount,
                $request->input('reason', 'Admin refund for cancelled order'),
                $request->input('notes'),
                $request->input('destination', RefundService::DESTINATION_ORIGINAL),
            );

            return $this->success($refund, 'Order refunded, revenue reversed', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    /**
     * Item-level grocery adjustment: refund specific quantities of specific
     * order lines. The amount is derived server-side from the line prices, so
     * the client cannot inflate it, and each unit can be adjusted only once.
     */
    public function adjustItems(Request $request, int $orderId)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.order_item_id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:1000',
            'notes' => 'sometimes|nullable|string|max:1000',
            'destination' => 'sometimes|in:wallet,bank,original_payment',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $order = Order::findOrFail($orderId);

            $result = $this->groceryAdjustmentService->adjustItems(
                $request->user(),
                $order,
                $validator->validated()['items'],
                $request->input('reason'),
                $request->input('notes'),
                $request->input('destination'),
            );

            return $this->success([
                'refund' => $result['refund'],
                'adjustments' => $result['adjustments'],
                'refund_amount' => $result['refund_amount'],
            ], 'Grocery items adjusted and refunded', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function approve(Refund $refund, Request $request)
    {
        try {
            $refund = $this->refundService->approve($refund, $request->user());

            return $this->success($refund, 'Refund approved');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function process(Refund $refund)
    {
        try {
            $refund = $this->refundService->process($refund);

            return $this->success($refund, 'Refund processed');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function reject(Refund $refund, Request $request)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'sometimes|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $refund = $this->refundService->reject($refund, $request->user(), $request->input('reason'));

            return $this->success($refund, 'Refund rejected');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }
}
