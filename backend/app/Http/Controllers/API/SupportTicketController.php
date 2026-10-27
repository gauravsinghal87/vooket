<?php

namespace App\Http\Controllers\API;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Ride;
use App\Models\SupportMessage;
use App\Models\SupportTicket;
use App\Models\SupportTicketAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class SupportTicketController extends BaseController
{
    public const MODULE_FOOD = 'food';

    public const MODULE_GROCERY = 'grocery';

    public const MODULE_RIDE = 'ride';

    public const MODULE_GENERAL = 'general';

    private const ISSUE_CATEGORIES = [
        'food_quality',
        'missing_item',
        'wrong_item',
        'damaged_spilled',
        'not_received',
        'payment_refund',
        'late_incomplete',
        'quantity_pricing',
        'partial_fulfillment',
        'substitution_dispute',
        'driver_conduct',
        'fare_discrepancy',
        'ride_cancellation',
        'safety_issue',
        'route_trip',
        'other',
    ];

    private const MODULE_CATEGORIES = [
        'food' => ['food_quality', 'missing_item', 'wrong_item', 'damaged_spilled', 'not_received', 'payment_refund', 'late_incomplete', 'other'],
        'grocery' => ['missing_item', 'wrong_item', 'damaged_spilled', 'quantity_pricing', 'partial_fulfillment', 'substitution_dispute', 'not_received', 'payment_refund', 'other'],
        'ride' => ['driver_conduct', 'fare_discrepancy', 'ride_cancellation', 'safety_issue', 'route_trip', 'payment_refund', 'other'],
    ];

    /**
     * The issue categories a customer may pick for each module, in display
     * order, with the label shown next to them.
     *
     * This is the shared contract between the customer facing forms (Customer
     * Web and the Customer App) and the ticket API: every value listed here is
     * accepted by `store()` for that module, so a form can never offer a
     * category the API would reject. The labels match the ones already used
     * by Customer Web so both surfaces stay identical.
     *
     * @var array<string, list<array{value: string, label: string}>>
     */
    private const MODULE_ISSUE_OPTIONS = [
        self::MODULE_FOOD => [
            ['value' => 'food_quality', 'label' => 'Food quality or taste issue'],
            ['value' => 'missing_item', 'label' => 'Missing item'],
            ['value' => 'wrong_item', 'label' => 'Wrong item delivered'],
            ['value' => 'damaged_spilled', 'label' => 'Item damaged or spilled'],
            ['value' => 'not_received', 'label' => 'Order marked delivered but not received'],
            ['value' => 'late_incomplete', 'label' => 'Late or incomplete delivery'],
            ['value' => 'payment_refund', 'label' => 'Payment or refund issue'],
            ['value' => 'other', 'label' => 'Other order-related issue'],
        ],
        self::MODULE_GROCERY => [
            ['value' => 'missing_item', 'label' => 'Missing item'],
            ['value' => 'wrong_item', 'label' => 'Wrong item delivered'],
            ['value' => 'damaged_spilled', 'label' => 'Item damaged or spoiled'],
            ['value' => 'quantity_pricing', 'label' => 'Quantity or pricing discrepancy'],
            ['value' => 'partial_fulfillment', 'label' => 'Partial fulfillment / out of stock'],
            ['value' => 'not_received', 'label' => 'Order not received'],
            ['value' => 'payment_refund', 'label' => 'Payment or refund issue'],
            ['value' => 'other', 'label' => 'Other issue'],
        ],
        self::MODULE_RIDE => [
            ['value' => 'driver_conduct', 'label' => 'Driver conduct issue'],
            ['value' => 'fare_discrepancy', 'label' => 'Fare discrepancy'],
            ['value' => 'ride_cancellation', 'label' => 'Ride cancellation'],
            ['value' => 'safety_issue', 'label' => 'Safety issue'],
            ['value' => 'route_trip', 'label' => 'Route or trip problem'],
            ['value' => 'payment_refund', 'label' => 'Payment or refund issue'],
            ['value' => 'other', 'label' => 'Other ride-related issue'],
        ],
    ];

    /**
     * The category a form pre-selects for a module, matching Customer Web.
     */
    private const MODULE_DEFAULT_CATEGORY = [
        self::MODULE_FOOD => 'food_quality',
        self::MODULE_GROCERY => 'missing_item',
        self::MODULE_RIDE => 'fare_discrepancy',
    ];

    private const ALLOWED_STATUSES = ['open', 'in_progress', 'pending', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver', 'resolved', 'closed', 'rejected'];

    /**
     * The refund destinations the customer facing forms offer. Only the wallet
     * is offered today, matching Customer Web.
     *
     * @var list<array{value: string, label: string}>
     */
    private const REFUND_DESTINATIONS = [
        ['value' => 'wallet', 'label' => 'SuperBasket Wallet'],
    ];

    public function index(Request $request)
    {
        $tickets = SupportTicket::where('user_id', $request->user()->id)
            ->with(['attachments'])
            ->latest()
            ->paginate($request->get('per_page', 15));

        $tickets->getCollection()->transform(function ($t) {
            $meta = $t->meta ?? [];
            unset($meta['internal_notes'], $meta['admin_notes'], $meta['admin_decision_reason']);
            $t->meta = $meta;

            return $t;
        });

        return $this->success($tickets);
    }

    /**
     * The support form options for a module.
     *
     * Customer Web and the Customer App both render the support form from
     * this payload so the issue categories a customer can pick always match
     * what `store()` accepts for the module of the linked record.
     */
    public function issueCategories(Request $request)
    {
        $module = strtolower(trim((string) $request->query('module', '')));

        if (! array_key_exists($module, self::MODULE_ISSUE_OPTIONS)) {
            return $this->error('Unsupported support module', [
                'module' => ['The module must be one of: '.implode(', ', array_keys(self::MODULE_ISSUE_OPTIONS)).'.'],
            ], 422);
        }

        $categories = self::MODULE_ISSUE_OPTIONS[$module];
        $default = self::MODULE_DEFAULT_CATEGORY[$module] ?? $categories[0]['value'];

        return $this->success([
            'module' => $module,
            'categories' => $categories,
            'default_category' => $default,
            'refund_destinations' => self::REFUND_DESTINATIONS,
        ]);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ticket_type' => 'required|in:order,ride,account,payment,general',
            'subject' => 'sometimes|string|max:255',
            'description' => 'required|string|max:2000',
            'priority' => 'sometimes|in:low,medium,high,urgent',
            'reference_type' => 'sometimes|string',
            'reference_id' => 'sometimes|integer',
            'issue_category' => 'sometimes|string|in:'.implode(',', self::ISSUE_CATEGORIES),
            'subcategory' => 'sometimes|string|max:100',
            'requested_refund_amount' => 'sometimes|numeric|min:0',
            'refund_destination' => 'sometimes|in:wallet,bank,original_payment',
            'attachments' => 'sometimes|array|max:5',
            'attachments.*' => 'sometimes|file|mimes:jpg,jpeg,png,webp|max:5120',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        $ticketType = (string) $request->input('ticket_type');
        $referenceType = (string) $request->input('reference_type', '');
        $referenceId = $request->input('reference_id');

        // Prevent invalid module/record combinations.
        if ($ticketType === 'order') {
            if ($referenceType !== 'order' || ! $referenceId) {
                return $this->error('Order reference is required for order tickets', null, 422);
            }
        } elseif ($ticketType === 'ride') {
            if ($referenceType !== '' && $referenceType !== 'ride') {
                return $this->error('Invalid reference type for ride ticket', null, 422);
            }
            if ($referenceType === 'ride' && ! $referenceId) {
                return $this->error('Ride reference is required', null, 422);
            }
        } else {
            if ($referenceType !== '' && in_array($referenceType, ['order', 'ride'], true)) {
                return $this->error('Reference type does not match ticket type', null, 422);
            }
        }

        if ($referenceType === 'order' && $ticketType !== 'order') {
            return $this->error('Order references require an order ticket', null, 422);
        }
        if ($referenceType === 'ride' && $ticketType !== 'ride') {
            return $this->error('Ride references require a ride ticket', null, 422);
        }

        $user = $request->user();
        $module = self::MODULE_GENERAL;

        // Order-specific validation + duplicate-active-claim protection.
        if ($ticketType === 'order' && $referenceType === 'order') {
            $order = Order::where('id', $referenceId)
                ->where('user_id', $user->id)
                ->first();

            if (! $order) {
                return $this->error('Order not found', null, 404);
            }

            $orderType = strtolower((string) $order->order_type);
            if ($orderType === 'grocery') {
                $module = self::MODULE_GROCERY;
            } elseif ($orderType === 'food') {
                $module = self::MODULE_FOOD;
            } else {
                return $this->error('Unsupported order type for support', null, 422);
            }

            $active = SupportTicket::where('user_id', $user->id)
                ->where('reference_type', 'order')
                ->where('reference_id', $order->id)
                ->whereIn('status', ['open', 'in_progress', 'pending', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver'])
                ->exists();

            if ($active) {
                return $this->error('An active support request already exists for this order', null, 422);
            }
        }

        // Ride-specific validation.
        if ($ticketType === 'ride' && $referenceType === 'ride' && $referenceId) {
            $ride = Ride::where('id', $referenceId)
                ->where('user_id', $user->id)
                ->first();

            if (! $ride) {
                return $this->error('Ride not found', null, 404);
            }
            $module = self::MODULE_RIDE;

            $active = SupportTicket::where('user_id', $user->id)
                ->where('reference_type', 'ride')
                ->where('reference_id', $ride->id)
                ->whereIn('status', ['open', 'in_progress', 'pending', 'waiting_for_customer', 'waiting_for_vendor', 'waiting_for_driver'])
                ->exists();

            if ($active) {
                return $this->error('An active support request already exists for this ride', null, 422);
            }
        } elseif ($ticketType === 'ride') {
            $module = self::MODULE_RIDE;
        }

        // Validate issue category against module.
        $issueCategory = $request->input('issue_category');
        if ($issueCategory && isset(self::MODULE_CATEGORIES[$module])) {
            if (! in_array($issueCategory, self::MODULE_CATEGORIES[$module], true)) {
                return $this->error('Invalid issue category for this module', null, 422);
            }
        }

        // Validate requested refund amount does not exceed order total for order tickets.
        if ($ticketType === 'order' && $request->filled('requested_refund_amount')) {
            $order = Order::where('id', $referenceId)->where('user_id', $user->id)->first();
            if ($order && (float) $request->input('requested_refund_amount') > (float) $order->total_amount + 1e-9) {
                return $this->error('Requested refund amount exceeds order total', null, 422);
            }
        }

        $uploaded = [];
        DB::beginTransaction();
        try {
            $meta = [
                'issue_category' => $issueCategory,
                'subcategory' => $request->input('subcategory'),
                'requested_refund_amount' => $request->input('requested_refund_amount'),
                'refund_destination' => $request->input('refund_destination', 'wallet'),
                'evidence' => [],
                'module' => $module,
                'internal_notes' => [],
            ];

            $ticket = SupportTicket::create([
                'ticket_number' => 'TKT_'.strtoupper(Str::random(10)),
                'user_id' => $user->id,
                'ticket_type' => $ticketType,
                'subject' => $request->input('subject', ($module === self::MODULE_RIDE ? 'Ride support request' : 'Order support request')),
                'description' => $request->description,
                'priority' => $request->input('priority', 'medium'),
                'status' => 'open',
                'reference_id' => $referenceId,
                'reference_type' => $referenceType ?: null,
                'meta' => $meta,
            ]);

            SupportMessage::create([
                'ticket_id' => $ticket->id,
                'user_id' => $user->id,
                'message' => $request->description,
                'is_from_customer' => true,
            ]);

            if ($request->hasFile('attachments')) {
                $files = $request->file('attachments');
                if (! is_array($files)) {
                    $files = [$files];
                }
                foreach ($files as $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $mime = (string) $file->getMimeType();
                    if (! str_starts_with($mime, 'image/')) {
                        throw new \RuntimeException('Only image attachments are allowed');
                    }
                    if ($file->getSize() > 5 * 1024 * 1024) {
                        throw new \RuntimeException('Attachment exceeds 5 MB limit');
                    }
                    $path = $file->store('support-tickets/'.$ticket->id, 'local');
                    $att = SupportTicketAttachment::create([
                        'support_ticket_id' => $ticket->id,
                        'user_id' => $user->id,
                        'disk' => 'local',
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                        'mime_type' => $mime,
                        'size' => $file->getSize(),
                    ]);
                    $uploaded[] = $att;
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            foreach ($uploaded as $att) {
                try {
                    Storage::disk($att->disk)->delete($att->path);
                } catch (\Throwable $ignored) {
                }
            }

            return $this->error($e->getMessage(), null, 422);
        }

        $ticket->setRelation('attachments', $uploaded);
        $ticket->load(['attachments']);

        // Audit
        try {
            AuditLog::create([
                'user_id' => $user->id,
                'role' => 'customer',
                'action' => 'support_ticket.created',
                'entity_type' => 'SupportTicket',
                'entity_id' => $ticket->id,
                'new_values' => ['ticket_number' => $ticket->ticket_number, 'module' => $module, 'status' => 'open'],
                'description' => 'Support ticket created',
                'level' => 'info',
            ]);
        } catch (\Throwable $ignored) {
        }

        return $this->success($ticket, 'Ticket created', 201);
    }

    public function show(Request $request, $id)
    {
        $ticket = SupportTicket::where('user_id', $request->user()->id)
            ->with(['messages' => fn ($q) => $q->orderBy('created_at'), 'attachments'])
            ->find($id);

        if (! $ticket) {
            return $this->error('Ticket not found', null, 404);
        }

        // Hide internal messages from customer.
        $ticket->setRelation('messages', $ticket->messages->filter(fn ($m) => ! $m->is_internal)->values());

        $meta = $ticket->meta ?? [];
        unset($meta['internal_notes'], $meta['admin_notes'], $meta['admin_decision_reason']);
        $ticket->meta = $meta;

        return $this->success($ticket);
    }

    public function attachmentUrl(Request $request, $ticketId, $attachmentId)
    {
        $ticket = SupportTicket::where('user_id', $request->user()->id)->find($ticketId);
        if (! $ticket) {
            return $this->error('Ticket not found', null, 404);
        }
        $att = SupportTicketAttachment::where('support_ticket_id', $ticket->id)->find($attachmentId);
        if (! $att) {
            return $this->error('Attachment not found', null, 404);
        }

        return $this->success(['url' => $att->url]);
    }

    public function attachmentFile(Request $request, $ticketId, $attachmentId)
    {
        // Authenticated direct file access (requires bearer token; used for downloads).
        $ticket = SupportTicket::where('user_id', $request->user()->id)->find($ticketId);
        if (! $ticket) {
            abort(404);
        }
        $att = SupportTicketAttachment::where('support_ticket_id', $ticket->id)->find($attachmentId);
        if (! $att) {
            abort(404);
        }
        $disk = Storage::disk($att->disk);
        if (! $disk->exists($att->path)) {
            abort(404);
        }

        return response()->file($disk->path($att->path), ['Content-Type' => $att->mime_type]);
    }

    public function signedAttachmentFile(Request $request, $attachmentId)
    {
        $att = SupportTicketAttachment::find($attachmentId);
        if (! $att) {
            abort(404);
        }
        $disk = Storage::disk($att->disk);
        if (! $disk->exists($att->path)) {
            abort(404);
        }

        return response()->file($disk->path($att->path), ['Content-Type' => $att->mime_type]);
    }

    private function resolveModuleFromTicket(Request $request): string
    {
        if ($request->input('ticket_type') === 'ride') {
            return self::MODULE_RIDE;
        }

        if ($request->input('ticket_type') === 'order' && $request->input('reference_type') === 'order') {
            $order = Order::find($request->input('reference_id'));
            if ($order && strtolower((string) $order->order_type) === 'grocery') {
                return self::MODULE_GROCERY;
            }
            if ($order && strtolower((string) $order->order_type) === 'food') {
                return self::MODULE_FOOD;
            }
        }

        return self::MODULE_GENERAL;
    }

    public function sendMessage(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:2000',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed', $validator->errors(), 422);
        }

        try {
            $ticket = SupportTicket::where('user_id', $request->user()->id)->find($id);

            if (! $ticket) {
                return $this->error('Ticket not found', null, 404);
            }

            if (in_array($ticket->status, ['closed', 'resolved', 'rejected'])) {
                return $this->error('Cannot send messages to a closed ticket', null, 400);
            }

            $message = SupportMessage::create([
                'ticket_id' => $ticket->id,
                'user_id' => $request->user()->id,
                'message' => $request->message,
                'is_from_customer' => true,
            ]);

            // Move ticket back to open if it was waiting for customer? keep status but update timestamp.
            $ticket->touch();

            return $this->success($message, 'Message sent', 201);
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), null, 500);
        }
    }
}
