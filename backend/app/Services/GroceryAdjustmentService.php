<?php

namespace App\Services;

use App\Models\FinancialAdjustment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Refund;
use App\Models\User;
use App\Support\Money;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Item-level adjustments for grocery orders (missing / damaged / spoiled
 * items, short-shipped weights, rejected substitutions).
 *
 * An adjustment names ONE OR MORE order lines and a quantity per line. The
 * refundable amount is DERIVED from the line's own price (never admin-typed),
 * reduced by the order's proportional discount, and can never exceed the
 * remaining refundable balance on the order's payment. Every unit of a line
 * can be adjusted at most once, tracked on `order_items.adjusted_quantity`.
 *
 * Money movement is delegated to RefundService::refundDeliveredOrder so the
 * vendor/platform reversal and the reimbursement destination follow exactly
 * the same single orchestration as every other refund. Each line also writes
 * a FinancialAdjustment audit row linked to the resulting refund.
 */
class GroceryAdjustmentService
{
    public function __construct(
        private RefundService $refundService,
    ) {}

    /**
     * A single line to adjust: `order_item_id` plus the number of units to
     * refund from that line.
     *
     * @param  array<int, array{order_item_id: int, quantity: int}>  $lines
     * @return array{refund: Refund, adjustments: array<int, FinancialAdjustment>, refund_amount: string}
     */
    public function adjustItems(
        User $admin,
        Order $order,
        array $lines,
        string $reason,
        ?string $notes,
        ?string $destination = null,
        ?int $ticketId = null,
    ): array {
        return DB::transaction(function () use ($admin, $order, $lines, $reason, $notes, $destination, $ticketId) {
            $locked = Order::whereKey($order->id)->lockForUpdate()->first();

            if (! $locked) {
                throw new RuntimeException('Order not found');
            }

            if (strtolower((string) $locked->order_type) !== 'grocery') {
                throw new RuntimeException('Item-level adjustments are only available for grocery orders');
            }

            if (! in_array(strtoupper((string) $locked->status), ['DELIVERED', 'CANCELLED'], true)) {
                throw new RuntimeException('Only a delivered or cancelled order can be adjusted');
            }

            $payment = $locked->payments()->lockForUpdate()->first();
            if (! $payment) {
                throw new RuntimeException('No payment found for this order');
            }

            if (! in_array(strtoupper((string) $payment->status), ['SUCCESS', 'PAID', 'PARTIALLY_REFUNDED'], true)) {
                throw new RuntimeException('Payment is not refundable');
            }

            if ($lines === []) {
                throw new RuntimeException('At least one order item must be adjusted');
            }

            $itemIds = array_map(fn (array $line) => (int) $line['order_item_id'], $lines);
            $items = OrderItem::where('order_id', $locked->id)
                ->whereIn('id', $itemIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $remainingRefundable = $this->refundService->refundableAmount($payment);

            $totalRefundPaise = 0;
            $computed = [];

            foreach ($lines as $line) {
                $itemId = (int) $line['order_item_id'];
                $quantity = (int) $line['quantity'];

                if ($quantity <= 0) {
                    throw new RuntimeException('Adjustment quantity must be positive');
                }

                /** @var OrderItem|null $item */
                $item = $items->get($itemId);
                if (! $item) {
                    throw new RuntimeException('Order item '.$itemId.' does not belong to this order');
                }

                $remainingUnits = (int) $item->quantity - (int) $item->adjusted_quantity;
                if ($quantity > $remainingUnits) {
                    throw new RuntimeException(
                        'Cannot adjust '.$quantity.' unit(s) of "'.$item->product_name
                        .'"; only '.$remainingUnits.' remain on this line'
                    );
                }

                $lineRefund = $this->lineRefundAmount($locked, $item, $quantity);
                $computed[] = ['item' => $item, 'quantity' => $quantity, 'amount' => $lineRefund];
                $totalRefundPaise += $lineRefund->paise();
            }

            $totalRefund = Money::fromPaise($totalRefundPaise);

            if ($totalRefund->isZero() || $totalRefund->isNegative()) {
                throw new RuntimeException('Adjustment amount must be positive');
            }

            if ($totalRefund->compareTo($remainingRefundable) > 0) {
                throw new RuntimeException('Adjustment amount exceeds the refundable balance of the order');
            }

            $idempotencyKey = 'GROCERY_ADJ_'.$locked->id.'_'.substr(hash(
                'sha256',
                implode('|', array_map(fn (array $c) => $c['item']->id.':'.$c['quantity'], $computed))
                .'|'.$reason
            ), 0, 16);

            // Idempotency is anchored on the adjustment rows we own, since the
            // underlying refund is keyed per order/ticket by RefundService.
            $existingAdjustment = FinancialAdjustment::where('reference_type', Refund::class)
                ->where('idempotency_key', 'like', $idempotencyKey.':item:%')
                ->first();

            if ($existingAdjustment) {
                $existingRefund = Refund::find($existingAdjustment->reference_id);

                return [
                    'refund' => $existingRefund,
                    'adjustments' => FinancialAdjustment::where('reference_type', Refund::class)
                        ->where('reference_id', $existingAdjustment->reference_id)
                        ->get()
                        ->all(),
                    'refund_amount' => $existingRefund ? (string) $existingRefund->amount : '0.00',
                ];
            }

            $destination ??= RefundService::DESTINATION_WALLET;

            $refund = $this->refundService->refundDeliveredOrder(
                $locked,
                $admin,
                $totalRefund,
                $reason,
                $notes,
                $destination,
                $ticketId,
            );

            $adjustments = [];
            foreach ($computed as $entry) {
                /** @var OrderItem $item */
                $item = $entry['item'];
                $quantity = $entry['quantity'];
                $amount = $entry['amount'];

                $adjustments[] = FinancialAdjustment::create([
                    'adjustment_number' => 'ADJ_'.date('YmdHis').'_'.strtoupper(substr(uniqid(), -5)),
                    'user_id' => $locked->user_id,
                    'amount' => $amount->major(),
                    'direction' => 'credit',
                    'reason' => $reason,
                    'notes' => $notes,
                    'adjusted_by' => $admin->id,
                    'reference_type' => Refund::class,
                    'reference_id' => $refund->id,
                    'idempotency_key' => $idempotencyKey.':item:'.$item->id,
                    'meta' => [
                        'order_id' => $locked->id,
                        'order_item_id' => $item->id,
                        'product_name' => $item->product_name,
                        'quantity' => $quantity,
                        'destination' => $destination,
                        'ticket_id' => $ticketId,
                    ],
                ]);

                $item->update([
                    'adjusted_quantity' => (int) $item->adjusted_quantity + $quantity,
                    'refunded_amount' => Money::fromMajor($item->refunded_amount)
                        ->add($amount)
                        ->major(),
                    'meta' => array_merge($item->meta ?? [], [
                        'last_adjustment_id' => $adjustments[array_key_last($adjustments)]->id,
                    ]),
                ]);
            }

            return [
                'refund' => $refund->fresh(),
                'adjustments' => $adjustments,
                'refund_amount' => $totalRefund->major(),
            ];
        });
    }

    /**
     * Refundable amount for `quantity` units of a line: the line's unit price
     * times the quantity, reduced by the order's proportional discount so the
     * customer never receives back more than they were charged. Product prices
     * are tax-inclusive, so the line total already contains its tax.
     */
    private function lineRefundAmount(Order $order, OrderItem $item, int $quantity): Money
    {
        $unit = Money::fromMajor($item->unit_price);
        $lineShare = $unit->multiply($quantity);

        $grossSubtotal = $this->grossSubtotalPaise($order);
        if ($grossSubtotal <= 0) {
            return $lineShare;
        }

        $discountPaise = Money::fromMajor($order->discount_amount)->paise();
        if ($discountPaise <= 0) {
            return $lineShare;
        }

        $linePaise = $lineShare->paise();
        $discountShare = intdiv($discountPaise * $linePaise, $grossSubtotal);

        return Money::fromPaise(max(0, $linePaise - $discountShare));
    }

    /**
     * Sum of the order's item line totals, used as the discount allocation
     * base (discount is charged on merchandise, not on delivery/fees).
     */
    private function grossSubtotalPaise(Order $order): int
    {
        $total = 0;
        foreach ($order->items as $item) {
            $total += Money::fromMajor($item->line_total)->paise();
        }

        return $total;
    }
}
