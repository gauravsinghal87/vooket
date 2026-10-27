<?php

namespace App\Http\Controllers\API\Admin;

use App\Events\OrderReady;
use App\Exceptions\InvalidOrderTransitionException;
use App\Exceptions\ManualDispatchException;
use App\Http\Controllers\API\BaseController;
use App\Jobs\BroadcastOrderTracking;
use App\Models\Commission;
use App\Models\DeliveryPartner;
use App\Models\DeliveryPartnerEarning;
use App\Models\DispatchLog;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\Ride;
use App\Models\WalletTransaction;
use App\Services\DeliveryService;
use App\Services\Dispatch\ManualVendorDispatchService;
use App\Services\Integration\WebhookNotifier;
use App\Services\OrderStateMachine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class OrderManagementController extends BaseController
{
    public function index(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 20), 1), 100);
        $page = max($request->integer('page', 1), 1);

        $status = $request->query('status') ? strtoupper((string) $request->query('status')) : null;
        $service = $request->query('service')
            ? strtolower((string) $request->query('service'))
            : ($request->query('order_type') ? strtolower((string) $request->query('order_type')) : null);
        $vendorId = $request->query('vendor_id');
        $search = $request->query('search');
        $from = $request->query('from');
        $to = $request->query('to');

        $records = collect();

        if ($service === null || in_array($service, ['food', 'grocery'], true)) {
            $records = $records->concat(
                Order::query()
                    ->with(['user:id,name,email,phone', 'vendor:id,business_name,vendor_type', 'items'])
                    ->when($service !== null, fn ($q) => $q->where('order_type', $service))
                    ->when($status, fn ($q) => $q->where('status', $status))
                    ->when($vendorId, fn ($q) => $q->where('vendor_id', $vendorId))
                    ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                        $q->where('order_number', 'like', "%{$search}%")
                            ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
                    }))
                    ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                    ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                    ->latest('id')
                    ->get()
                    ->map(fn (Order $order) => $this->orderIndexItem($order))
            );
        }

        if ($service === null || $service === 'ride') {
            $records = $records->concat(
                Ride::query()
                    ->with([
                        'user:id,name,email,phone',
                        'driver.user:id,name,phone',
                        'driver.vehicleType:id,name',
                        'vehicleType:id,name',
                        'earning',
                    ])
                    ->when($status, fn ($q) => $q->where('status', $status))
                    ->when($search, fn ($q) => $q->where(function ($q) use ($search) {
                        $q->where('ride_number', 'like', "%{$search}%")
                            ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"))
                            ->orWhereHas('driver.user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
                    }))
                    ->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                    ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to))
                    ->latest('id')
                    ->get()
                    ->map(fn (Ride $ride) => $this->rideIndexItem($ride))
            );
        }

        $records = $records->sortByDesc(fn (array $item) => $item['created_at'])->values();

        return $this->success($records->forPage($page, $perPage)->values(), 'Orders retrieved', 200, [
            'pagination' => [
                'current_page' => $page,
                'last_page' => max((int) ceil($records->count() / $perPage), 1),
                'per_page' => $perPage,
                'total' => $records->count(),
            ],
        ]);
    }

    private function orderIndexItem(Order $order): array
    {
        return [
            'id' => $order->id,
            'service' => (string) $order->order_type,
            'order_number' => $order->order_number,
            'order_type' => (string) $order->order_type,
            'status' => strtoupper((string) $order->status),
            'manual_assignable' => app(ManualVendorDispatchService::class)->isManualAssignable($order),
            'payment_status' => (string) $order->payment_status,
            'payment_method' => $order->payment_method,
            'total_amount' => (string) $order->total_amount,
            'subtotal' => (string) $order->subtotal,
            'discount_amount' => (string) $order->discount_amount,
            'tax_amount' => (string) $order->tax_amount,
            'delivery_fee' => (string) $order->delivery_fee,
            'coupon_code' => $order->coupon_code,
            'created_at' => $order->created_at?->toISOString(),
            'user' => $order->user ? [
                'id' => $order->user->id,
                'name' => $order->user->name,
                'email' => $order->user->email,
                'phone' => $order->user->phone,
            ] : null,
            'vendor' => $order->vendor ? [
                'id' => $order->vendor->id,
                'business_name' => $order->vendor->business_name,
                'vendor_type' => $order->vendor->vendor_type,
            ] : null,
            'items' => $order->items->map(fn ($item) => [
                'id' => $item->id,
                'product_name' => $item->product_name,
                'quantity' => $item->quantity,
                'unit_price' => (string) $item->unit_price,
                'line_total' => (string) $item->line_total,
                'selected_options' => $item->selected_options,
            ]),
        ];
    }

    private function rideIndexItem(Ride $ride): array
    {
        $earning = $ride->earning;

        return [
            'id' => $ride->id,
            'service' => 'ride',
            'order_number' => $ride->ride_number,
            'status' => (string) $ride->status,
            'payment_status' => (string) $ride->payment_status,
            'payment_method' => $ride->payment_method,
            'total_amount' => (string) ($ride->final_fare ?? $ride->estimated_fare),
            'discount_amount' => (string) $ride->discount_amount,
            'tax_amount' => (string) $ride->tax_amount,
            'coupon_code' => $ride->coupon_code,
            'created_at' => $ride->created_at?->toISOString(),
            'completed_at' => $ride->trip_completed_at?->toISOString(),
            'user' => $ride->user ? [
                'id' => $ride->user->id,
                'name' => $ride->user->name,
                'email' => $ride->user->email,
                'phone' => $ride->user->phone,
            ] : null,
            'driver' => $ride->driver ? [
                'id' => $ride->driver->id,
                'name' => $ride->driver->user?->name,
                'phone' => $ride->driver->user?->phone,
                'vehicle_number' => $ride->driver->vehicle_number,
            ] : null,
            'vehicle_type' => $ride->vehicleType?->name,
            'pickup' => [
                'address' => $ride->pickup_address,
                'latitude' => $ride->pickup_latitude !== null ? (float) $ride->pickup_latitude : null,
                'longitude' => $ride->pickup_longitude !== null ? (float) $ride->pickup_longitude : null,
            ],
            'drop' => [
                'address' => $ride->destination_address,
                'latitude' => $ride->destination_latitude !== null ? (float) $ride->destination_latitude : null,
                'longitude' => $ride->destination_longitude !== null ? (float) $ride->destination_longitude : null,
            ],
            'distance_km' => $ride->distance_km !== null ? (float) $ride->distance_km : null,
            'duration_min' => $ride->duration_min !== null ? (int) $ride->duration_min : null,
            'base_fare' => (string) $ride->base_fare,
            'distance_charge' => (string) $ride->distance_charge,
            'time_charge' => (string) $ride->time_charge,
            'waiting_charge' => (string) $ride->waiting_charge,
            'platform_fee' => (string) $ride->platform_fee,
            'estimated_fare' => (string) $ride->estimated_fare,
            'final_fare' => (string) $ride->final_fare,
            'driver_earning' => (string) $earning?->earning_amount,
            'admin_commission' => (string) $earning?->commission_amount,
            'commission_percentage' => $earning?->commission_percentage !== null ? (float) $earning->commission_percentage : null,
        ];
    }

    public function show(Request $request, int $id)
    {
        $order = Order::with([
            'user:id,name,email,phone',
            'vendor:id,business_name,vendor_type',
            'restaurant:id,name',
            'store:id,name',
            'deliveryPartner.user:id,name,phone',
            'address',
            'dispatchLogs.deliveryPartner.user:id,name,phone',
            'items' => fn ($q) => $q->with('product:id,name,image'),
            'statusHistory',
            'payments.paymentTransactions',
            'deliveryPartnerEarnings.payout',
            'refunds',
            'settlementItems.settlement.payout',
            'walletTransactions',
        ])->find($id);

        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        return $this->success($this->orderDetailItem($order), 'Order retrieved');
    }

    /**
     * Admin order detail payload. Mirrors the list item shape and adds the
     * persisted pricing/payout columns plus a structured financial object
     * assembled only from canonical records (never recomputed).
     *
     * @return array<string, mixed>
     */
    private function orderDetailItem(Order $order): array
    {
        $dispatchLogs = $order->dispatchLogs ?? collect();

        $activeOffer = $dispatchLogs
            ->filter(fn (DispatchLog $log) => in_array($log->status, [DispatchLog::STATUS_PENDING, DispatchLog::STATUS_ACCEPTED], true))
            ->sortByDesc('id')
            ->first();

        return array_merge($this->orderIndexItem($order), [
            'subtotal' => (string) $order->subtotal,
            'discount_amount' => (string) $order->discount_amount,
            'tax_amount' => (string) $order->tax_amount,
            'delivery_fee' => (string) $order->delivery_fee,
            'packaging_fee' => (string) $order->packaging_fee,
            'handling_fee' => (string) $order->handling_fee,
            'platform_fee' => (string) $order->platform_fee,
            'tip_amount' => (string) $order->tip_amount,
            'wallet_used' => (string) $order->wallet_used,
            'round_off' => (string) $order->round_off,
            'coupon_code' => $order->coupon_code,
            'completed_at' => $order->delivered_at?->toISOString(),
            'commission_fee' => $order->commission_fee !== null ? (string) $order->commission_fee : null,
            'net_vendor_payout' => $order->net_vendor_payout !== null ? (string) $order->net_vendor_payout : null,
            'vendor_payout_status' => $order->vendor_payout_status,
            'vendor_payout_at' => $order->vendor_payout_at?->toISOString(),
            'partner_payout' => $order->partner_payout !== null ? (string) $order->partner_payout : null,
            'partner_payout_status' => $order->partner_payout_status,
            'partner_payout_at' => $order->partner_payout_at?->toISOString(),
            'refund_amount' => $order->refund_amount !== null ? (string) $order->refund_amount : null,
            'refund_status' => $order->refund_status,
            'refunded_at' => $order->refunded_at?->toISOString(),
            'delivery_partner' => $order->deliveryPartner ? [
                'id' => $order->deliveryPartner->id,
                'name' => $order->deliveryPartner->user?->name,
                'phone' => $order->deliveryPartner->user?->phone,
            ] : null,
            'active_dispatch_offer' => $activeOffer ? [
                'id' => $activeOffer->id,
                'status' => $activeOffer->status,
                'partner_id' => (int) $activeOffer->candidate_id,
                'distance_km' => $activeOffer->distance_km !== null ? (float) $activeOffer->distance_km : null,
                'mode' => (string) ($activeOffer->meta['assignment']['mode'] ?? 'auto'),
                'assigned_by' => (string) ($activeOffer->meta['assignment']['assigned_by'] ?? 'system'),
                'expires_at' => $activeOffer->expires_at?->toIso8601String(),
            ] : null,
            'financial' => $this->financialForOrder($order),
        ]);
    }

    /**
     * Persisted financial record for an order: how the customer paid, the
     * customer bill, the vendor settlement, partner earnings, the platform's
     * ledger lines and any refunds. Every figure comes from a stored record;
     * nothing is recomputed from live settings.
     *
     * @return array<string, mixed>
     */
    private function financialForOrder(Order $order): array
    {
        $settlement = $order->settlementItems->first()?->settlement;

        $adminFundedDelivery = 0.0;
        foreach ($order->deliveryPartnerEarnings as $earning) {
            $breakdown = $earning->meta['earning_breakdown'] ?? $earning->meta['breakdown'] ?? [];
            $adminFundedDelivery += (float) ($breakdown['platform_funded'] ?? 0);
        }

        return [
            'order_bill' => [
                'subtotal' => (string) $order->subtotal,
                'packaging_fee' => (string) $order->packaging_fee,
                'handling_fee' => (string) $order->handling_fee,
                'platform_fee' => (string) $order->platform_fee,
                'delivery_fee' => (string) $order->delivery_fee,
                'tip_amount' => (string) $order->tip_amount,
                'wallet_used' => (string) $order->wallet_used,
                'discount_amount' => (string) $order->discount_amount,
                'tax_amount' => (string) $order->tax_amount,
                'round_off' => (string) $order->round_off,
                'coupon_code' => $order->coupon_code,
                'total_amount' => (string) $order->total_amount,
            ],
            'payments' => $order->payments->map(fn (Payment $payment) => [
                'id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'amount' => (string) $payment->amount,
                'method' => $payment->method,
                'gateway' => $payment->gateway,
                'provider_reference' => $payment->provider_reference,
                'status' => (string) $payment->status,
                'paid_at' => $payment->paid_at?->toISOString(),
                'verified_at' => $payment->verified_at?->toISOString(),
                'failed_at' => $payment->failed_at?->toISOString(),
                'failure_reason' => $payment->failure_reason,
                'transaction_statuses' => $payment->paymentTransactions->pluck('status')->all(),
            ])->values()->all(),
            'wallet_transactions' => $order->walletTransactions->map(fn (WalletTransaction $walletTransaction) => [
                'id' => $walletTransaction->id,
                'transaction_id' => $walletTransaction->transaction_id,
                'type' => $walletTransaction->type,
                'service' => $walletTransaction->service,
                'amount' => (string) $walletTransaction->amount,
                'direction' => $walletTransaction->direction,
                'status' => (string) $walletTransaction->status,
                'description' => $walletTransaction->description,
                'created_at' => $walletTransaction->created_at?->toISOString(),
            ])->values()->all(),
            'vendor_settlement' => $settlement ? [
                'settlement_number' => $settlement->settlement_number,
                'status' => (string) $settlement->status,
                'period_type' => (string) $settlement->period_type,
                'period_start' => $settlement->period_start?->toISOString(),
                'period_end' => $settlement->period_end?->toISOString(),
                'gross_earnings' => (string) $settlement->gross_earnings,
                'total_commission' => (string) $settlement->total_commission,
                'total_incentives' => (string) $settlement->total_incentives,
                'total_bonuses' => (string) $settlement->total_bonuses,
                'total_adjustments' => (string) $settlement->total_adjustments,
                'total_refunds' => (string) $settlement->total_refunds,
                'net_payable' => (string) $settlement->net_payable,
                'paid_at' => $settlement->paid_at?->toISOString(),
                'payout_status' => $settlement->payout?->status,
            ] : null,
            'commissions' => Commission::query()
                ->where('party_type', 'vendor')
                ->where('source_type', 'order')
                ->where('source_id', $order->id)
                ->get()
                ->map(fn (Commission $commission) => [
                    'commission_number' => $commission->commission_number,
                    'gross_amount' => (string) $commission->gross_amount,
                    'commission_amount' => (string) $commission->commission_amount,
                    'commission_rate' => (string) $commission->commission_rate,
                    'net_amount' => (string) $commission->net_amount,
                    'status' => (string) $commission->status,
                ])
                ->values()
                ->all(),
            'partner_earnings' => $order->deliveryPartnerEarnings->map(fn (DeliveryPartnerEarning $earning) => [
                'earning_number' => $earning->earning_number,
                'amount' => (string) $earning->amount,
                'type' => $earning->type,
                'status' => (string) $earning->status,
                'paid_at' => $earning->paid_at?->toISOString(),
                'payout_status' => $earning->payout?->status,
                'customer_delivery_fee' => number_format((float) ($earning->meta['earning_breakdown']['customer_delivery_fee'] ?? $earning->meta['customer_delivery_fee'] ?? 0), 2, '.', ''),
                'admin_funded' => number_format((float) ($earning->meta['earning_breakdown']['platform_funded'] ?? $earning->meta['platform_funded'] ?? 0), 2, '.', ''),
            ])->values()->all(),
            'platform' => [
                'platform_fee' => (string) $order->platform_fee,
                'commission_fee' => $order->commission_fee !== null ? (string) $order->commission_fee : null,
                'admin_funded_delivery' => number_format($adminFundedDelivery, 2, '.', ''),
            ],
            'refunds' => $order->refunds->map(fn (Refund $refund) => [
                'refund_number' => $refund->refund_number,
                'amount' => (string) $refund->amount,
                'status' => (string) $refund->status,
                'reason' => $refund->reason,
                'approved_at' => $refund->approved_at?->toISOString(),
                'processed_at' => $refund->processed_at?->toISOString(),
            ])->values()->all(),
        ];
    }

    public function updateStatus(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:placed,pending,accepted,confirmed,preparing,picking,packed,processing,ready,out_for_delivery,arrived,delivered,cancelled',
            'note' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $order = Order::find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $status = strtoupper($request->input('status'));

        try {
            if ($status === 'CANCELLED') {
                $order = app(DeliveryService::class)->cancelOrder(
                    $order,
                    $request->user(),
                    $request->input('note')
                );
            } elseif ($status === 'DELIVERED' && $order->delivery_partner_id) {
                $partner = $order->deliveryPartner;

                if ($partner) {
                    $order = app(DeliveryService::class)->markDelivered($order, $partner, $request->input('note'), false);
                } else {
                    OrderStateMachine::assertCanTransition($order, $status);
                    $oldStatus = (string) $order->status;
                    $order->update(['status' => $status] + $this->statusTimestamps($status));
                    $this->recordHistory($order, $status, $request->user(), 'admin', $request->input('note'), $oldStatus);
                }
            } else {
                OrderStateMachine::assertCanTransition($order, $status);
                $oldStatus = (string) $order->status;
                $order->update(['status' => $status] + $this->statusTimestamps($status));
                $this->recordHistory($order, $status, $request->user(), 'admin', $request->input('note'), $oldStatus);
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
            'ARRIVED' => $notifier->orderArrived($order->fresh()),
            'DELIVERED' => $notifier->orderDelivered($order->fresh()),
            default => null,
        };
        $notifier->orderUpdated($order->fresh());

        BroadcastOrderTracking::dispatch($order->id, [
            ['type' => 'order_updated'],
        ]);

        if ($status === 'READY') {
            OrderReady::dispatch($order);
        }

        return $this->success($order->fresh('statusHistory'), 'Order status updated');
    }

    public function assignPartner(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'partner_id' => 'required|integer|exists:delivery_partners,id',
            'note' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $order = Order::find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $partner = DeliveryPartner::find($request->input('partner_id'));
        if (! $partner) {
            return $this->error('Delivery partner not found', null, 404);
        }

        try {
            $order = app(DeliveryService::class)->claimOrder(
                $order,
                $partner,
                $request->user(),
                $request->input('note') ?? 'Assigned by admin'
            );

            return $this->success($order->fresh('statusHistory'), 'Delivery partner assigned');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 409);
        }
    }

    /**
     * All service-eligible delivery partners for a manual Food/Grocery order
     * that still needs a partner.
     *
     * The admin sees the whole service pool (the same list the vendor's manual
     * assignment uses): partners that are offline, far away or lack a live
     * location are still listed so an order can always be recovered, and each
     * partner carries `available_for_assignment` so the UI can disable the
     * ones the assign step would refuse.
     */
    public function eligibleDeliveryPartners(Request $request, int $id)
    {
        $order = Order::find($id);
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
     * Manually target a delivery partner for an order via an offer (the same
     * path as the vendor). The partner still has to accept; no direct claim.
     */
    public function assignDeliveryPartner(Request $request, int $id)
    {
        $validator = Validator::make($request->all(), [
            'delivery_partner_id' => 'required|integer|exists:delivery_partners,id',
            'note' => 'sometimes|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $order = Order::find($id);
        if (! $order) {
            return $this->error('Order not found', null, 404);
        }

        $partner = DeliveryPartner::find((int) $request->input('delivery_partner_id'));
        if (! $partner) {
            return $this->error('Delivery partner not found', null, 404);
        }

        try {
            $result = app(ManualVendorDispatchService::class)->assign(
                $order,
                $partner,
                $request->user(),
                $request->input('note'),
                'admin'
            );
        } catch (ManualDispatchException $e) {
            return $this->error($e->getMessage(), null, 422);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 500);
        }

        return $this->success([
            'order' => $result['order']->load('deliveryPartner.user', 'dispatchLogs'),
            'offer' => $result['offer'],
        ], 'Delivery partner assigned');
    }

    protected function statusTimestamps(string $status): array
    {
        return match ($status) {
            'CONFIRMED' => ['confirmed_at' => now()],
            'PREPARING' => ['preparing_at' => now()],
            'PICKING' => ['picking_at' => now()],
            'PACKED' => ['packed_at' => now()],
            'READY' => ['ready_at' => now()],
            'OUT_FOR_DELIVERY' => ['out_for_delivery_at' => now()],
            'ARRIVED' => ['arrived_at' => now()],
            'DELIVERED' => ['delivered_at' => now()],
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
