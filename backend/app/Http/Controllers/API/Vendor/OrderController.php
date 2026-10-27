<?php

namespace App\Http\Controllers\API\Vendor;

use App\Events\OrderReady;
use App\Exceptions\InvalidOrderTransitionException;
use App\Exceptions\ManualDispatchException;
use App\Http\Controllers\API\BaseController;
use App\Jobs\BroadcastOrderTracking;
use App\Models\DeliveryPartner;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Services\DeliveryService;
use App\Services\Dispatch\ManualVendorDispatchService;
use App\Services\Dispatch\OrderDispatchService;
use App\Services\Dispatch\OrderServiceTypeResolver;
use App\Services\Integration\WebhookNotifier;
use App\Services\OrderStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class OrderController extends BaseController
{
    /**
     * A scheduled grocery order may be accepted and prepared before its slot
     * starts. Everything past packing belongs to the delivery partner.
     */
    private const SCHEDULED_PREPARATION_STATUSES = ['ACCEPTED', 'CONFIRMED'];

    private const PARTNER_OWNED_STATUSES = [
        'PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED', 'DELIVERED',
    ];

    public function index(Request $request)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $query = Order::with([
            'user:id,name,phone',
            'items' => fn ($q) => $q->select('order_id', 'product_name', 'quantity', 'unit_price', 'line_total', 'selected_options'),
            'deliveryPartner.user:id,name,phone',
            'dispatchLogs' => fn ($q) => $q->where('status', DispatchLog::STATUS_PENDING)->latest('id'),
        ]);

        if ($status = $request->query('status')) {
            $query->where('status', strtoupper($status));
        } else {
            $query->whereIn('status', ['SCHEDULED', 'PENDING', 'PLACED', 'ACCEPTED', 'CONFIRMED', 'PREPARING', 'PICKING', 'PACKED', 'READY', 'PARTNER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'ARRIVED']);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
            });
        }

        if ($from = $request->query('from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $orders = $query->where('vendor_id', $vendor->id)
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return $this->success($orders->items(), 'Orders retrieved', 200, [
            'pagination' => [
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $order = Order::with([
            'user:id,name,phone',
            'deliveryPartner.user:id,name,phone',
            'address',
            'dispatchLogs',
            'items' => fn ($q) => $q->with('product:id,name,image'),
            'statusHistory',
        ])->where('vendor_id', $vendor->id)->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        return $this->success($order);
    }

    public function updateStatus(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;

        $order = Order::where('vendor_id', $vendor->id)->find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:accepted,confirmed,preparing,picking,packed,processing,ready,out_for_delivery,cancelled',
            'note' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $status = strtoupper($request->input('status'));

        $isScheduled = $order->delivery_slot_id !== null;

        if ($order->status === 'SCHEDULED'
            && $status !== 'CANCELLED'
            && ! in_array($status, self::SCHEDULED_PREPARATION_STATUSES, true)) {
            return $this->error(
                'This order is scheduled for a later delivery slot. It moves into your queue when the slot starts.',
                null,
                422
            );
        }

        if ($isScheduled && in_array($status, self::PARTNER_OWNED_STATUSES, true)) {
            return $this->error(
                'This order is delivered by a delivery partner and cannot be moved by the vendor.',
                null,
                422
            );
        }

        if ($status === 'OUT_FOR_DELIVERY' && $order->delivery_partner_id !== null) {
            return $this->error('Out for delivery is managed by the assigned delivery partner', null, 422);
        }

        try {
            if ($status === 'CANCELLED') {
                $order = app(DeliveryService::class)->cancelOrder(
                    $order,
                    $request->user(),
                    $request->input('note') ?? 'Cancelled by vendor'
                );
            } else {
                OrderStateMachine::assertCanTransition($order, $status);

                $oldStatus = (string) $order->status;

                $order->update(['status' => $status] + $this->statusTimestamps($status));

                $this->recordHistory($order, $status, $request->user(), 'vendor', $request->input('note'), $oldStatus);
            }
        } catch (InvalidOrderTransitionException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 500);
        }

        $notifier = app(WebhookNotifier::class);
        match ($status) {
            'CANCELLED' => $notifier->orderCancelled($order->fresh()),
            'OUT_FOR_DELIVERY' => $notifier->orderOutForDelivery($order->fresh()),
            default => null,
        };
        $notifier->orderUpdated($order->fresh());

        DB::afterCommit(function () use ($order, $status) {
            BroadcastOrderTracking::dispatch($order->id, [
                ['type' => 'order_updated'],
                ['type' => 'vendor_order_updated'],
            ]);

            // ASAP grocery dispatches on acceptance. A scheduled grocery order
            // is held back by the dispatch-eligibility gate inside
            // OrderDispatchService until its slot start minus the configured
            // dispatch lead, and until it has been packed.
            if ($status === 'ACCEPTED'
                && $order->delivery_slot_id === null
                && app(OrderServiceTypeResolver::class)->resolve($order) === OrderServiceTypeResolver::GROCERY) {
                try {
                    app(OrderDispatchService::class)->dispatchForOrder($order->fresh());
                } catch (\Throwable $e) {
                    report($e);
                }
            }
        });

        if ($status === 'READY') {
            OrderReady::dispatch($order);
        }

        return $this->success($order->fresh('statusHistory'), 'Order status updated');
    }

    /**
     * All service-eligible delivery partners for a manual Food/Grocery order
     * that is ready (or packed) for vendor-manual assignment.
     *
     * Uses the same candidate source as the admin list: the whole service
     * pool, with no automatic-dispatch radius filter — distance is display
     * only and every partner carries `available_for_assignment`. Access is
     * still restricted to the authenticated vendor's own order.
     */
    public function eligibleDeliveryPartners(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $order = Order::where('vendor_id', $vendor->id)->find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        try {
            $result = app(ManualVendorDispatchService::class)->manualCandidates($order);
        } catch (ManualDispatchException $e) {
            return $this->error($e->getMessage(), null, 422);
        }

        return $this->success($result['partners'], 'Eligible delivery partners retrieved', 200, [
            'pickup' => $result['pickup'],
            'service' => $result['service'],
            'service_label' => $result['service_label'],
        ]);
    }

    /**
     * Target a delivery partner for a scheduled grocery order. The partner
     * still has to accept the request through the existing offer flow — this
     * never assigns the order directly.
     */
    public function assignDeliveryPartner(Request $request, int $id)
    {
        $vendor = $request->user()->vendor;
        if (! $vendor) {
            return $this->error('Vendor profile not found', null, 404);
        }

        $order = Order::where('vendor_id', $vendor->id)->find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $validator = Validator::make($request->all(), [
            'delivery_partner_id' => 'required|integer',
            'note' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $partner = DeliveryPartner::find((int) $request->input('delivery_partner_id'));
        if (! $partner) {
            return $this->error('Delivery partner not found', null, 422);
        }

        try {
            $result = app(ManualVendorDispatchService::class)->assign(
                $order,
                $partner,
                $request->user(),
                $request->input('note'),
            );
        } catch (ManualDispatchException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            report($e);

            return $this->error($e->getMessage(), null, 500);
        }

        $order = $result['order']->load('deliveryPartner.user', 'dispatchLogs');

        return $this->success([
            'order' => $order,
            'offer' => [
                'id' => $result['offer']->id,
                'status' => $result['offer']->status,
                'expires_at' => $result['offer']->expires_at?->toIso8601String(),
                'partner_id' => $result['offer']->candidate_id,
            ],
        ], 'Delivery partner assigned');
    }

    protected function statusTimestamps(string $status): array
    {
        return match ($status) {
            'ACCEPTED', 'CONFIRMED' => ['confirmed_at' => now()],
            'PREPARING' => ['preparing_at' => now()],
            'PICKING' => ['picking_at' => now()],
            'PACKED' => ['packed_at' => now()],
            'READY' => ['ready_at' => now()],
            'OUT_FOR_DELIVERY' => ['out_for_delivery_at' => now()],
            default => [],
        };
    }

    protected function recordHistory(Order $order, string $newStatus, $user, string $changedByType, ?string $note, ?string $oldStatus = null): void
    {
        $previous = strtoupper((string) ($oldStatus ?? $order->status));

        if ($previous === strtoupper($newStatus)) {
            return;
        }

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $newStatus,
            'old_status' => $previous,
            'new_status' => strtoupper($newStatus),
            'changed_at' => now(),
            'notes' => $note,
            'changed_by' => $user->id,
            'changed_by_type' => $changedByType,
        ]);
    }
}
