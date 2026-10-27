<?php

namespace App\Http\Controllers\API\Admin;

use App\Http\Controllers\API\BaseController;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Ride;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\SupportTicketAttachment;
use App\Services\RefundService;
use App\Support\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class SupportTicketController extends BaseController
{
    private const TRANSITIONS = [
        'open' => ['in_progress', 'pending', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver', 'resolved', 'rejected', 'closed', 'approved'],
        'in_progress' => ['open', 'pending', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver', 'resolved', 'rejected', 'closed', 'approved'],
        'pending' => ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver', 'resolved', 'rejected', 'closed', 'approved'],
        'waiting_for_customer' => ['in_progress', 'resolved', 'rejected', 'closed'],
        'waiting_for_vendor' => ['in_progress', 'resolved', 'rejected', 'closed'],
        'waiting_for_driver' => ['in_progress', 'resolved', 'rejected', 'closed'],
        'resolved' => ['closed', 'open'],
        'closed' => ['open'],
        'rejected' => ['open'],
        'approved' => ['resolved', 'closed'],
    ];

    public function __construct(private RefundService $refundService) {}

    public function index(Request $request)
    {
        $query = SupportTicket::query()->with(['user', 'attachments']);

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->input('priority'));
        }

        if ($request->filled('ticket_type')) {
            $query->where('ticket_type', $request->input('ticket_type'));
        }

        if ($request->filled('module')) {
            $query->whereJsonContains('meta->module', $request->input('module'));
        }

        if ($request->filled('category')) {
            $category = $request->input('category');
            $query->where(function ($q) use ($category) {
                $q->whereJsonContains('meta->issue_category', $category)
                    ->orWhere('meta->issue_category', $category);
            });
        }

        if ($request->filled('assigned_to')) {
            $query->where('assigned_to', $request->input('assigned_to'));
        }

        if ($request->filled('search')) {
            $s = $request->input('search');
            $query->where(function ($q) use ($s) {
                $q->where('ticket_number', 'like', "%{$s}%")
                    ->orWhere('subject', 'like', "%{$s}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%")->orWhere('phone', 'like', "%{$s}%"))
                    ->orWhere('reference_id', $s);
            });
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        return $this->success($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function show(SupportTicket $supportTicket)
    {
        $supportTicket->load(['user', 'messages.user', 'attachments']);

        $order = null;
        $ride = null;
        if ($supportTicket->reference_type === 'order' && $supportTicket->reference_id) {
            $order = Order::with([
                'items',
                'vendor',
                'restaurant',
                'store',
                'payments',
                'refunds',
                'settlementItems',
                'deliveryPartnerEarnings',
            ])->find($supportTicket->reference_id);
        } elseif ($supportTicket->reference_type === 'ride' && $supportTicket->reference_id) {
            $ride = Ride::find($supportTicket->reference_id);
        }

        $payment = $order?->payments?->first();
        $originalPaid = $payment ? (float) $payment->amount : (float) ($order?->total_amount ?? ($ride?->final_fare ?? $ride?->estimated_fare ?? 0));
        $completedRefunds = $order?->refunds?->where('status', 'COMPLETED') ?? collect();
        $previouslyRefunded = (float) $completedRefunds->sum('amount');
        $remaining = max(0.0, $originalPaid - $previouslyRefunded);

        $requested = $supportTicket->meta['requested_refund_amount'] ?? null;
        $suggested = $remaining;
        if (is_numeric($requested) && (float) $requested > 0 && (float) $requested <= $remaining) {
            $suggested = (float) $requested;
        }

        $canApprove = $remaining > 0;
        $blockReason = $canApprove ? null : 'No refundable amount remaining.';

        $payload = $supportTicket->toArray();

        $metaForAdmin = $supportTicket->meta ?? [];

        $payload['order'] = $order ? $order->toArray() : null;
        $payload['ride'] = $ride ? $ride->toArray() : null;
        $payload['refund_summary'] = [
            'original_paid_amount' => $originalPaid,
            'previously_refunded_amount' => $previouslyRefunded,
            'remaining_refundable_amount' => $remaining,
            'suggested_refund_amount' => $suggested,
            'refund_destination' => $metaForAdmin['refund_destination'] ?? 'wallet',
            'requested_refund_amount' => $metaForAdmin['requested_refund_amount'] ?? null,
            'can_approve_refund' => $canApprove,
            'approval_block_reason' => $blockReason,
        ];
        $payload['financial_review'] = [
            'transaction_summary' => [
                'subtotal' => $order?->subtotal ?? null,
                'tax_amount' => $order?->tax_amount ?? $ride?->tax_amount ?? null,
                'delivery_fee' => $order?->delivery_fee ?? null,
                'discount_amount' => $order?->discount_amount ?? $ride?->discount_amount ?? null,
                'total_amount' => $order?->total_amount ?? $ride?->final_fare ?? $ride?->estimated_fare ?? null,
                'payment_amount' => $payment?->amount ?? null,
                'payment_method' => $payment?->payment_method ?? $order?->payment_method ?? $ride?->payment_method ?? null,
                'payment_status' => $payment?->status ?? $order?->payment_status ?? $ride?->payment_status ?? null,
            ],
            'refund_summary' => [
                'original_paid' => $originalPaid,
                'previously_refunded' => $previouslyRefunded,
                'pending' => 0,
                'remaining' => $remaining,
            ],
            'stakeholder_impact' => [
                'vendor' => [
                    'net_vendor_payout' => $order?->net_vendor_payout,
                    'note' => 'Vendor reversals are proportional and audited via settlement items.',
                ],
                'commission' => [
                    'note' => 'Platform commission may be partially/full reversed per refund share.',
                ],
                'delivery_partner' => [
                    'earnings' => $order?->deliveryPartnerEarnings?->toArray() ?? [],
                    'note' => 'Delivery-partner earnings are never reversed by ordinary merchandise refunds.',
                ],
                'driver' => [
                    'note' => 'Ride driver compensation follows ride-specific cancellation/refund policy.',
                ],
            ],
            'settlement_items' => $order?->settlementItems?->toArray() ?? [],
            'delivery_partner_earnings' => $order?->deliveryPartnerEarnings?->toArray() ?? [],
            'note' => 'Values are server-calculated from verified transactions.',
        ];

        return $this->success($payload);
    }

    public function update(Request $request, SupportTicket $supportTicket)
    {
        $validator = Validator::make($request->all(), [
            'status' => 'sometimes|in:open,in_progress,pending,resolved,closed,rejected,approved,waiting_for_customer,waiting_for_vendor,waiting_for_driver',
            'priority' => 'sometimes|in:low,medium,high,urgent',
            'assigned_to' => 'sometimes|nullable|integer|exists:users,id',
            'admin_notes' => 'sometimes|string|max:2000',
            'internal_note' => 'sometimes|string|max:2000',
            'reply' => 'sometimes|string|max:2000',
            'refund_id' => 'sometimes|integer',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $oldStatus = $supportTicket->status;
        $oldPriority = $supportTicket->priority;
        $oldAssigned = $supportTicket->assigned_to;

        // Status transition validation.
        if ($request->filled('status') && $request->input('status') !== $supportTicket->status) {
            $allowed = self::TRANSITIONS[$supportTicket->status] ?? [];
            if (! in_array($request->input('status'), $allowed, true)) {
                return $this->error('Invalid status transition', null, 422);
            }
        }

        $meta = $supportTicket->meta ?? [];
        if ($request->filled('admin_notes')) {
            $meta['admin_notes'] = $request->input('admin_notes');
        }
        if ($request->filled('refund_id')) {
            $meta['refund_id'] = $request->input('refund_id');
        }

        if ($request->filled('internal_note')) {
            $internal = $meta['internal_notes'] ?? [];
            $internal[] = [
                'note' => $request->input('internal_note'),
                'added_by' => $request->user()?->id,
                'added_at' => now()->toISOString(),
            ];
            $meta['internal_notes'] = $internal;
        }

        $data = $validator->validated();
        unset($data['internal_note'], $data['reply']);
        $data['meta'] = $meta;

        if ($request->filled('status') && $request->input('status') === 'resolved' && ! $supportTicket->resolved_at) {
            $data['resolved_at'] = now();
        }
        if ($request->filled('status') && $request->input('status') === 'closed' && ! $supportTicket->closed_at) {
            $data['closed_at'] = now();
        }
        if ($request->filled('status') && in_array($request->input('status'), ['open', 'in_progress'], true) && $supportTicket->resolved_at) {
            // reopening
            $data['resolved_at'] = null;
        }

        $supportTicket->update($data);

        if ($request->filled('reply')) {
            SupportMessage::create([
                'ticket_id' => $supportTicket->id,
                'user_id' => $request->user()?->id,
                'message' => $request->input('reply'),
                'is_from_customer' => false,
                'is_internal' => false,
            ]);
        }

        // Audit
        try {
            if ($request->filled('status') && $request->input('status') !== $oldStatus) {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'role' => 'admin',
                    'action' => 'support_ticket.status_changed',
                    'entity_type' => 'SupportTicket',
                    'entity_id' => $supportTicket->id,
                    'old_values' => ['status' => $oldStatus],
                    'new_values' => ['status' => $request->input('status')],
                    'description' => 'Support ticket status changed',
                    'level' => 'info',
                ]);
            }
            if ($request->filled('priority') && $request->input('priority') !== $oldPriority) {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'role' => 'admin',
                    'action' => 'support_ticket.priority_changed',
                    'entity_type' => 'SupportTicket',
                    'entity_id' => $supportTicket->id,
                    'old_values' => ['priority' => $oldPriority],
                    'new_values' => ['priority' => $request->input('priority')],
                    'description' => 'Support ticket priority changed',
                    'level' => 'info',
                ]);
            }
            if ($request->filled('assigned_to') && (int) $request->input('assigned_to') !== (int) $oldAssigned) {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'role' => 'admin',
                    'action' => 'support_ticket.assigned',
                    'entity_type' => 'SupportTicket',
                    'entity_id' => $supportTicket->id,
                    'old_values' => ['assigned_to' => $oldAssigned],
                    'new_values' => ['assigned_to' => $request->input('assigned_to')],
                    'description' => 'Support ticket assignment changed',
                    'level' => 'info',
                ]);
            }
            if ($request->filled('internal_note')) {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'role' => 'admin',
                    'action' => 'support_ticket.internal_note_added',
                    'entity_type' => 'SupportTicket',
                    'entity_id' => $supportTicket->id,
                    'description' => 'Internal note added',
                    'level' => 'info',
                ]);
            }
        } catch (\Throwable $ignored) {
        }

        return $this->success($supportTicket->fresh(['user', 'messages.user', 'attachments']), 'Support ticket updated');
    }

    public function approveRefund(Request $request, SupportTicket $supportTicket)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|gt:0',
            'reason' => 'required|string|max:1000',
            'destination' => 'sometimes|in:wallet,bank,original_payment',
            'notes' => 'sometimes|string|max:2000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        if ($supportTicket->reference_type !== 'order' || ! $supportTicket->reference_id) {
            // Ride refunds not wired to existing refund service; reject for now.
            return $this->error('Refund approval is only supported for linked orders', null, 422);
        }

        $order = Order::find($supportTicket->reference_id);
        if (! $order) {
            return $this->error('Linked order not found', null, 404);
        }

        // Duplicate approval guard: if refund already linked and completed, block.
        $meta = $supportTicket->meta ?? [];
        if (! empty($meta['refund_id'])) {
            return $this->error('A refund has already been processed for this ticket', null, 409);
        }

        try {
            $amount = Money::fromMajor((float) $request->input('amount'));
            $destination = $request->input('destination', $meta['refund_destination'] ?? 'wallet');

            $refund = $this->refundService->refundDeliveredOrder(
                $order,
                $request->user(),
                $amount,
                $request->input('reason'),
                $request->input('notes'),
                $destination,
                $supportTicket->id,
            );

            $meta['refund_id'] = $refund->id;
            $meta['refund_amount'] = $refund->amount;
            $meta['refund_destination'] = $destination;
            $meta['admin_decision_reason'] = $request->input('reason');

            $supportTicket->update([
                'status' => $refund->status === 'COMPLETED' ? 'resolved' : 'in_progress',
                'meta' => $meta,
                'resolved_at' => $refund->status === 'COMPLETED' ? now() : $supportTicket->resolved_at,
            ]);

            try {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'role' => 'admin',
                    'action' => 'support_ticket.refund_approved',
                    'entity_type' => 'SupportTicket',
                    'entity_id' => $supportTicket->id,
                    'new_values' => ['refund_id' => $refund->id, 'amount' => $refund->amount],
                    'description' => 'Refund approved from support ticket',
                    'level' => 'info',
                ]);
            } catch (\Throwable $ignored) {
            }

            return $this->success($refund, 'Refund processed', 201);
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function reconcile(Request $request, SupportTicket $supportTicket)
    {
        return $this->reconciliation($request, $supportTicket);
    }

    public function reconciliation(Request $request, SupportTicket $supportTicket)
    {
        if ($supportTicket->reference_type !== 'order' || ! $supportTicket->reference_id) {
            return $this->error('Ticket is not linked to an order', null, 422);
        }

        $order = Order::find($supportTicket->reference_id);
        if (! $order) {
            return $this->error('Linked order not found', null, 404);
        }

        try {
            $result = $this->refundService->reconcileDeliveredRefund($order, $request->user());

            return $this->success($result, 'Reconciliation completed');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), null, 422);
        }
    }

    public function attachmentFile(Request $request, $supportTicket, $attachmentId)
    {
        // supportTicket may be model bound or id
        $ticketId = $supportTicket instanceof SupportTicket ? $supportTicket->id : (int) $supportTicket;
        $att = SupportTicketAttachment::where('support_ticket_id', $ticketId)->find($attachmentId);
        if (! $att) {
            abort(404);
        }
        $disk = Storage::disk($att->disk);
        if (! $disk->exists($att->path)) {
            abort(404);
        }
        return response()->file($disk->path($att->path), ['Content-Type' => $att->mime_type]);
    }

    public function attachmentUrl(Request $request, $supportTicket, $attachmentId)
    {
        $ticketId = $supportTicket instanceof SupportTicket ? $supportTicket->id : (int) $supportTicket;
        $att = SupportTicketAttachment::where('support_ticket_id', $ticketId)->find($attachmentId);
        if (! $att) {
            return $this->error('Attachment not found', null, 404);
        }
        return $this->success(['url' => $att->url]);
    }
}
