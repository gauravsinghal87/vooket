<?php

namespace App\Http\Controllers\API;

use App\Exceptions\DeliveryConfigurationException;
use App\Exceptions\DeliveryGateException;
use App\Exceptions\DeliverySlotException;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Restaurant;
use App\Models\Review;
use App\Models\Ride;
use App\Models\Store;
use App\Models\SupportTicket;
use App\Services\DeliveryOtpService;
use App\Services\OrderService;
use App\Services\PreparationInstructionService;
use App\Services\RefundService;
use App\Services\Tracking\OrderTrackingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class OrderController extends BaseController
{
    public function __construct(
        private OrderService $orderService,
        private RefundService $refundService,
        private OrderTrackingService $trackingService,
        private DeliveryOtpService $deliveryOtpService,
    ) {}

    /**
     * Module-scoped order history for the signed-in customer.
     *
     * `module` is the switch the customer apps send: `food` / `grocery` page the
     * orders table filtered on `order_type` inside the SQL query, `rides` pages
     * the separate ride-bookings table, so a module can never receive another
     * module's records. The legacy `order_type` filter is still honoured (and
     * now validated) for older clients, and with neither parameter the response
     * keeps the original "every order" behaviour. Sorting, pagination and the
     * per-user scope are unchanged.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'module' => 'sometimes|nullable|in:food,grocery,rides',
            'order_type' => 'sometimes|nullable|in:food,grocery',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $module = $request->query('module');

        if ($module === 'rides') {
            return $this->success($this->rideHistory($request));
        }

        $query = Order::where('user_id', $request->user()->id);

        if ($request->has('status')) {
            $query->where('status', $request->get('status'));
        }

        // The module filter belongs in the query, never in the client: only
        // rows of the requested module are ever retrieved.
        $orderType = $module ?? $request->query('order_type');
        if ($orderType !== null && $orderType !== '') {
            $query->where('order_type', $orderType);
        }

        // The delivered-at timestamp powers the history card's "Arrived in X
        // minutes" copy. Only the DELIVERED row is eager-loaded so the extra
        // query stays bounded to one small row per order at most.
        $orders = $query
            ->with([
                'items',
                'restaurant.vendor',
                'store.vendor',
                'statusHistory' => fn ($q) => $q->where('status', 'DELIVERED'),
            ])
            ->latest()
            ->paginate($request->get('per_page', 15));

        // Internal pricing (the Admin-funded delivery cost) never reaches a customer.
        $orders->getCollection()->each(fn (Order $order) => $order->hideInternalPricingSnapshot());

        return $this->success($orders);
    }

    /**
     * Ride bookings for `?module=rides`: the `rides` table itself rather than
     * restaurant orders, still scoped to the caller and paginated the same way,
     * eager-loading the driver and vehicle the ride history card renders.
     */
    private function rideHistory(Request $request)
    {
        return Ride::where('user_id', $request->user()->id)
            ->with(['driver.user', 'vehicleType'])
            ->latest()
            ->paginate($request->get('per_page', 15));
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order_type' => 'required|in:food,grocery',
            'idempotency_key' => 'sometimes|string|max:100',
            'address_id' => 'sometimes|exists:addresses,id',
            'payment_method' => 'sometimes|in:cash_on_delivery,wallet,online',
            'tip_amount' => 'sometimes|numeric|min:0',
            'customer_note' => 'sometimes|string|max:500',
            'substitution_preference' => 'sometimes|in:allow,contact_me,do_not_substitute',
            'scheduled_at' => 'sometimes|date|after:now',
            'delivery_slot_id' => 'prohibited_unless:order_type,grocery|nullable|integer|exists:delivery_slots,id',
            // Food-only pre-order preparation instructions. Optional, and the
            // only two keys a customer may ever store.
            PreparationInstructionService::NOTE_KEY => 'prohibited_unless:order_type,food|nullable|string|max:'.PreparationInstructionService::MAX_NOTE_LENGTH,
            PreparationInstructionService::CUTLERY_KEY => 'prohibited_unless:order_type,food|nullable|boolean',
            // Order meta is assembled server-side only, so a customer can never
            // inject an arbitrary instruction (or any other) structure.
            'meta' => 'prohibited',
            'preparation_instructions' => 'prohibited',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        if ($request->input('order_type') === 'grocery'
            && $request->filled('scheduled_at')
            && ! $request->filled('delivery_slot_id')) {
            return $this->error('Select a delivery slot to schedule this order.', null, 422);
        }

        $data = $request->all();

        try {
            if ($request->input('order_type') === 'food') {
                $data['meta'] = [
                    PreparationInstructionService::META_KEY => app(PreparationInstructionService::class)
                        ->buildCartSnapshot([
                            PreparationInstructionService::NOTE_KEY => $request->input(PreparationInstructionService::NOTE_KEY),
                            PreparationInstructionService::CUTLERY_KEY => $request->input(PreparationInstructionService::CUTLERY_KEY),
                        ]),
                ];
            }

            $order = $this->orderService->createOrder($request->user(), $data);

            return $this->success($order->hideInternalPricingSnapshot(), 'Order placed successfully', 201);
        } catch (DeliverySlotException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (DeliveryConfigurationException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (ValidationException $e) {
            return $this->error('Validation failed', $e->errors(), 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function show(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with(['items', 'statusHistory', 'deliveryPartner.user', 'restaurant.vendor', 'store.vendor'])
            ->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $snapshot = $order->hideInternalPricingSnapshot()->toArray();

        $tickets = SupportTicket::where('user_id', $request->user()->id)
            ->where('reference_type', 'order')
            ->where('reference_id', $id)
            ->get();

        $resolvedRefunded = $tickets->contains(function ($ticket) {
            if (strtolower((string) $ticket->status) !== 'resolved') {
                return false;
            }

            $refundId = $ticket->meta['refund_id'] ?? null;
            if (! $refundId) {
                return false;
            }

            $refund = Refund::find($refundId);

            return $refund !== null && strtolower((string) $refund->status) === 'completed';
        });

        $snapshot['help_available'] = ! $resolvedRefunded;

        return $this->success($snapshot);
    }

    /**
     * Food preparation instructions for an order the customer owns.
     *
     * Returns the server-approved option list so the customer UI never has to
     * hardcode instruction keys, plus the stored snapshot and whether the
     * current order status still allows changes.
     */
    public function preparationInstructions(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with('items')
            ->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $service = app(PreparationInstructionService::class);

        if (! $service->supports($order)) {
            return $this->error('Food preparation instructions are only available for food orders', null, 422);
        }

        return $this->success($service->payload($order));
    }

    public function updatePreparationInstructions(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with('items')
            ->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $service = app(PreparationInstructionService::class);

        if (! $service->supports($order)) {
            return $this->error('Food preparation instructions are only available for food orders', null, 422);
        }

        if (! $service->canEdit($order)) {
            return $this->error(
                'Preparation instructions can no longer be changed because the restaurant has started preparing your order.',
                null,
                422
            );
        }

        $validator = Validator::make($request->all(), [
            'selected' => ['sometimes', 'array'],
            'selected.*' => ['string', 'distinct'],
            'note' => ['nullable', 'string', 'max:'.PreparationInstructionService::MAX_NOTE_LENGTH],
            'items' => ['sometimes', 'array', 'max:50'],
            'items.*.order_item_id' => ['required', 'integer'],
            'items.*.selected' => ['sometimes', 'array'],
            'items.*.selected.*' => ['string', 'distinct'],
            'items.*.note' => ['nullable', 'string', 'max:'.PreparationInstructionService::MAX_NOTE_LENGTH],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $selected = $request->input('selected', []);
        $note = $request->input('note');
        $items = $request->has('items') ? $request->input('items') : null;

        try {
            $service->validate(is_array($selected) ? $selected : [], is_string($note) ? $note : null);
            $this->validateItems($service, is_array($items) ? $items : []);
        } catch (ValidationException $e) {
            return $this->error('Validation failed', $e->errors(), 422);
        }

        $service->write(
            $order,
            is_array($selected) ? $selected : [],
            is_string($note) ? $note : null,
            is_array($items) ? $items : null
        );

        return $this->success(
            $service->payload($order->refresh()->load('items')),
            'Food preparation instructions saved'
        );
    }

    /**
     * Apply the same whitelist and length rules to per-item instructions.
     *
     * @param  array<int, mixed>  $items
     */
    private function validateItems(PreparationInstructionService $service, array $items): void
    {
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }

            $service->validate(
                is_array($item['selected'] ?? null) ? $item['selected'] : [],
                isset($item['note']) && is_string($item['note']) ? $item['note'] : null
            );
        }
    }

    public function deliveryOtp(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        try {
            $otp = $this->deliveryOtpService->getActiveOtp($order);

            return $this->success($otp, 'Delivery OTP');
        } catch (DeliveryGateException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function cancel(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'sometimes|string|max:500',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $order = Order::where('user_id', $request->user()->id)->find($id);

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $order = $this->orderService->cancelOrder($order, $request->user(), $request->reason ?? null);

            return $this->success($order->hideInternalPricingSnapshot(), 'Order cancelled');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function reorder(Request $request, $id)
    {
        try {
            $originalOrder = Order::where('user_id', $request->user()->id)
                ->with('items')
                ->find($id);

            if (! $originalOrder) {
                return $this->error('Order not found', null, 404);
            }

            $cartData = [
                'order_type' => $originalOrder->order_type,
                'address_id' => $originalOrder->address_id,
                'payment_method' => $originalOrder->payment_method,
            ];

            $order = $this->orderService->createOrder($request->user(), $cartData);

            return $this->success($order->hideInternalPricingSnapshot(), 'Order placed', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 400);
        }
    }

    public function rate(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'rating' => 'required|numeric|min:1|max:5',
            'comment' => 'sometimes|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $order = Order::where('user_id', $request->user()->id)->find($id);

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            if ($order->status !== 'DELIVERED') {
                return $this->error('Can only rate delivered orders', null, 400);
            }

            $existingReview = Review::where('user_id', $request->user()->id)
                ->where('order_id', $order->id)
                ->first();

            if ($existingReview) {
                return $this->error('Already rated this order', null, 400);
            }

            $reviewableType = $order->restaurant_id ? Restaurant::class : Store::class;
            $reviewableId = $order->restaurant_id ?? $order->store_id;

            $review = Review::create([
                'user_id' => $request->user()->id,
                'reviewable_type' => $reviewableType,
                'reviewable_id' => $reviewableId,
                'order_id' => $order->id,
                'rating' => $request->rating,
                'comment' => $request->comment,
                'status' => 'approved',
            ]);

            return $this->success($review, 'Rating submitted', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function invoice(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with(['items', 'address'])
            ->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        return $this->success([
            'order_number' => $order->order_number,
            'date' => $order->created_at,
            'items' => $order->items,
            'subtotal' => $order->subtotal,
            'tax_amount' => $order->tax_amount,
            'delivery_fee' => $order->delivery_fee,
            'delivery_gst_percent' => $order->delivery_gst_percent,
            'delivery_gst_amount' => $order->delivery_gst_amount,
            'packaging_fee' => $order->packaging_fee,
            'handling_fee' => $order->handling_fee,
            'discount_amount' => $order->discount_amount,
            'coupon_discount' => $order->coupon_discount,
            'tip_amount' => $order->tip_amount,
            'total_amount' => $order->total_amount,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'delivery_address' => $order->delivery_address_snapshot,
        ]);
    }

    public function refundRequest(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $order = Order::where('user_id', $request->user()->id)->find($id);

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            if (! in_array($order->status, ['DELIVERED', 'CANCELLED'], true)) {
                return $this->error('Order is not eligible for refund', null, 400);
            }

            $openRefund = Refund::where('refundable_type', Order::class)
                ->where('refundable_id', $order->id)
                ->whereIn('status', ['REQUESTED', 'APPROVED', 'PROCESSING'])
                ->first();

            if ($openRefund) {
                return $this->error('Refund already requested', null, 400);
            }

            $payment = Payment::where('payable_type', Order::class)
                ->where('payable_id', $order->id)
                ->whereIn('status', ['SUCCESS', 'PARTIALLY_REFUNDED'])
                ->latest()
                ->first();

            if (! $payment) {
                return $this->error('No refundable payment found for this order', null, 400);
            }

            $amount = $this->refundService->refundableAmount($payment);

            if ($amount->isZero()) {
                return $this->error('Nothing left to refund', null, 400);
            }

            $refund = $this->refundService->request(
                $request->user(),
                $payment,
                $amount,
                $request->input('reason'),
                null,
                null
            );

            return $this->success($refund, 'Refund request submitted', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }

    public function tracking(Request $request, $id)
    {
        $order = Order::where('user_id', $request->user()->id)
            ->with(['deliveryPartner.user'])
            ->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        if (! $this->trackingService->canTrack($request->user(), $order)) {
            return $this->error('Forbidden', null, 403);
        }

        return $this->success($this->trackingService->payload($order));
    }
}
