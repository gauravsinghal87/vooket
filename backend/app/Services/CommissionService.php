<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\Commission;
use App\Models\CommissionRule;
use App\Models\Order;
use App\Models\Settlement;
use App\Models\SettlementItem;
use App\Services\Dispatch\OrderServiceTypeResolver;
use App\Support\Money;

/**
 * Server-authoritative commission calculation for orders.
 *
 * Resolution order (first match wins):
 *   1. an active `commission_rules` row scoped to the order's service,
 *      active today, ordered by priority (highest first);
 *   2. the owning vendor's `commission_rate` override;
 *   3. the platform defaults in `app_settings` (group "commission",
 *      key "{food|grocery}_commission");
 *   4. nothing configured -> rate 0, no commission row is recorded.
 *
 * All math uses integer-paise Money. The commission is finalized only when
 * an order is delivered, exactly once, guarded by the
 * `commissions_source_once_unique` constraint.
 */
class CommissionService
{
    public function __construct(
        private OrderServiceTypeResolver $serviceTypeResolver,
        private WalletService $walletService,
        private JournalService $journalService,
    ) {}

    /**
     * Compute the commission resolution for a delivered order.
     *
     * @return array{
     *     service: string, rate: float, commission_amount: float,
     *     gross_amount: float, net_amount: float, source: string, configured: bool,
     *     breakdown: array<string, mixed>
     * }
     */
    public function calculateForOrder(Order $order): array
    {
        $order = $order->fresh() ?? $order;
        $service = $this->serviceTypeResolver->resolve($order);

        /**
         * Confirmed commercial rule:
         *   commission base = eligible merchandise subtotal after applicable
         *   (coupon) discounts. Product prices are tax-inclusive, so the
         *   extracted tax is part of the subtotal and is never added again.
         *   Delivery fees, delivery GST, packaging/handling fees, platform
         *   fees and tips are never part of the commission base.
         */
        $gross = Money::fromPaise(0)
            ->add(Money::fromMajor($order->subtotal ?? 0))
            ->sub(Money::fromMajor($order->discount_amount ?? 0));

        $base = $gross;
        $rate = 0.0;
        $source = 'app_settings';
        $type = 'percentage';
        $configured = false;
        $ruleId = null;

        $rule = CommissionRule::query()
            ->where('service', $service)
            ->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('effective_from')->orWhereDate('effective_from', '<=', today()))
            ->where(fn ($q) => $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', today()))
            ->where(fn ($q) => $q->whereNull('vendor_id')->orWhere('vendor_id', $order->vendor_id))
            ->where(fn ($q) => $q->whereNull('applicable_to')->orWhere('applicable_to', 'vendor'))
            ->orderByDesc('priority')
            ->orderByDesc('id')
            ->first();

        if ($rule) {
            $ruleId = $rule->id;
            $source = 'rule';

            if ($rule->type === 'fixed') {
                $type = 'fixed';
                $configured = true;
                $rate = (float) ($rule->fixed_amount ?? 0);
                $commission = Money::fromMajor($rule->fixed_amount ?? 0);
                $effectiveGross = $base;

                return $this->resolution($order, $service, $rate, $commission, $effectiveGross, $source, $type, $configured, $ruleId);
            }

            $type = 'percentage';
            $rate = (float) ($rule->percentage_rate ?? 0);

            if ($rule->max_amount !== null && $base->compareTo(Money::fromMajor($rule->max_amount)) > 0) {
                $base = Money::fromMajor($rule->max_amount);
            }
            if ($rule->min_amount !== null && $gross->compareTo(Money::fromMajor($rule->min_amount)) < 0) {
                return $this->resolution($order, $service, $rate, Money::zero(), $gross, $source, $type, true, $ruleId);
            }

            $configured = true;
        } else {
            $vendor = $order->vendor;
            if ($vendor && $vendor->commission_rate !== null) {
                $source = 'vendor';
                $rate = (float) $vendor->commission_rate;
                $configured = true;
            } else {
                $settingValue = AppSetting::where('group', 'commission')
                    ->where('key', $service.'_commission')
                    ->value('value');

                if ($settingValue !== null) {
                    $source = 'app_settings';
                    $rate = (float) $settingValue;
                    $configured = true;
                }
            }
        }

        $commission = $configured && $rate > 0 ? $base->percent((string) $rate) : Money::zero();

        return $this->resolution($order, $service, $rate, $commission, $base, $source, $type, $configured, $ruleId);
    }

    /**
     * Persist the commission on a delivered order and stamp the order's
     * payout fields. Safe to call more than once: the commissions row is
     * guarded by the unique (party_type, source_type, source_id) constraint
     * and order fields are only set, never accumulated.
     *
     * @return array{
     *     service: string, rate: float, commission_amount: float,
     *     gross_amount: float, net_amount: float, source: string, configured: bool,
     *     breakdown: array<string, mixed>
     * }
     */
    public function finalizeForOrder(Order $order, ?int $userId = null): array
    {
        $result = $this->calculateForOrder($order);
        $order = $order->fresh() ?? $order;

        $order->update([
            'commission_fee' => $result['commission_amount'],
            'net_vendor_payout' => $result['net_amount'],
            'vendor_payout_status' => 'pending',
        ]);

        if ($result['configured'] && $result['commission_amount'] > 0) {
            Commission::firstOrCreate(
                [
                    'party_type' => 'vendor',
                    'source_type' => 'order',
                    'source_id' => $order->id,
                    'service' => $result['service'],
                ],
                [
                    'commission_number' => 'CMM_'.date('YmdHis').'_'.strtoupper(substr(md5(microtime(true)), 0, 6)),
                    'service' => $result['service'],
                    'party_type' => 'vendor',
                    'vendor_id' => $order->vendor_id,
                    'source_type' => 'order',
                    'source_id' => $order->id,
                    'gross_amount' => $result['gross_amount'],
                    'commission_amount' => $result['commission_amount'],
                    'commission_rate' => $result['rate'],
                    'commission_type' => ($result['breakdown']['rule_type'] ?? 'percentage') === 'fixed' ? 'fixed' : 'percentage',
                    'net_amount' => $result['net_amount'],
                    'status' => 'calculated',
                    'breakdown' => array_merge($result['breakdown'], ['source' => $result['source'], 'recorded_by' => $userId]),
                ]
            );
        }

        $this->finalizeVendorSettlement($order, $result);

        $this->postCommissionJournal($order, $result);

        return $result;
    }

    /**
     * Book the platform's commission income: the commission part of the
     * order revenue stops being clearing liability and becomes revenue.
     * The vendor's net share is booked by its own wallet credit
     * (Dr order revenue clearing, Cr vendor wallet), so together the two
     * postings release the whole captured amount.
     */
    private function postCommissionJournal(Order $order, array $result): void
    {
        if (($result['commission_amount'] ?? 0) <= 0) {
            return;
        }

        $this->journalService->post(
            sourceType: Order::class,
            sourceId: $order->id,
            entryType: 'commission_accrued',
            lines: [
                ['account' => 'order_revenue_clearing', 'direction' => 'debit', 'amount' => $result['commission_amount'], 'memo' => 'Commission for order #'.$order->order_number],
                ['account' => 'platform_revenue', 'direction' => 'credit', 'amount' => $result['commission_amount'], 'party_type' => 'platform', 'memo' => 'Commission for order #'.$order->order_number],
            ],
            idempotencyKey: 'commission:accrued:order:'.$order->id,
            description: 'Platform commission for order #'.$order->order_number,
            meta: [
                'rate' => $result['rate'],
                'service' => $result['service'],
                'gross_amount' => $result['gross_amount'],
                'net_vendor_payout' => $result['net_amount'],
                'source' => $result['source'],
            ]
        );
    }

    /**
     * Credit the vendor's net payout into a processing settlement so it shows
     * up as due settlement and is immediately requestable as a payout.
     *
     * Idempotent per order: the settlement_item row is keyed on
     * (source_type=order, source_id=order.id). Net/gross/commission columns
     * are recomputed from the settlement's items, never accumulated, so re-
     * finalizing an order can't double-credit the vendor.
     */
    protected function finalizeVendorSettlement(Order $order, array $result): void
    {
        if (($result['net_amount'] ?? 0) <= 0) {
            return;
        }

        $settledOn = $order->delivered_at ?? $order->updated_at ?? now();
        $vendor = $order->vendor;

        if ($vendor && $vendor->user_id) {
            $this->walletService->credit(
                $vendor->user,
                'vendor',
                $result['net_amount'],
                type: 'SETTLEMENT',
                referenceType: 'order',
                referenceId: $order->id,
                description: 'Net vendor earnings for order '.$order->order_number,
                idempotencyKey: 'vendor-settle:order:'.$order->id,
                meta: [
                    'order_number' => $order->order_number,
                    'gross' => $result['gross_amount'],
                    'commission' => $result['commission_amount'],
                    'net' => $result['net_amount'],
                ],
            );
        }

        $partyType = 'vendor';

        $settlement = Settlement::firstOrCreate(
            [
                'party_type' => $partyType,
                'vendor_id' => $order->vendor_id,
                'status' => 'processing',
                'period_type' => 'daily',
                'period_start' => $settledOn->copy()->startOfDay(),
                'period_end' => $settledOn->copy()->endOfDay(),
            ],
            [
                'settlement_number' => 'STL_'.date('YmdHis').'_'.strtoupper(substr(md5(microtime(true)), 0, 6)),
                'gross_earnings' => 0,
                'total_commission' => 0,
                'net_payable' => 0,
            ]
        );

        SettlementItem::updateOrCreate(
            [
                'settlement_id' => $settlement->id,
                'source_type' => 'order',
                'source_id' => $order->id,
            ],
            [
                'amount' => $result['net_amount'],
                'direction' => 'credit',
                'description' => 'Net payout for order '.$order->order_number,
                'meta' => [
                    'order_number' => $order->order_number,
                    'gross' => $result['gross_amount'],
                    'commission' => $result['commission_amount'],
                    'net' => $result['net_amount'],
                ],
            ]
        );

        $gross = 0.0;
        $commission = 0.0;
        $net = 0.0;

        foreach ($settlement->settlementItems()->get() as $item) {
            $meta = $item->meta;
            $gross += (float) ($meta['gross'] ?? 0);
            $commission += (float) ($meta['commission'] ?? 0);
            $net += (float) ($meta['net'] ?? $item->amount);
        }

        $settlement->update([
            'gross_earnings' => $gross,
            'total_commission' => $commission,
            'net_payable' => $net,
        ]);
    }

    /**
     * @return array{
     *     service: string, rate: float, commission_amount: float,
     *     gross_amount: float, net_amount: float, source: string, configured: bool,
     *     breakdown: array<string, mixed>
     * }
     */
    private function resolution(
        Order $order,
        string $service,
        float $rate,
        Money $commission,
        Money $effectiveGross,
        string $source,
        string $type,
        bool $configured,
        ?int $ruleId
    ): array {
        $net = $effectiveGross->sub($commission);

        return [
            'service' => $service,
            'rate' => $rate,
            'commission_amount' => (float) $commission->major(),
            'gross_amount' => (float) $effectiveGross->major(),
            'net_amount' => (float) $net->major(),
            'source' => $source,
            'configured' => $configured,
            'breakdown' => [
                'rule_type' => $type,
                'rule_id' => $ruleId,
                'order_number' => $order->order_number,
                'subtotal' => $order->subtotal,
                'tax_amount' => $order->tax_amount,
                'tax_included_in_subtotal' => true,
                'tax_excluded_from_commission' => true,
                'tip_excluded_from_commission' => true,
                'discount_amount' => $order->discount_amount,
                'tip_amount' => $order->tip_amount,
                'delivery_fee' => $order->delivery_fee,
                'delivery_excluded_from_commission' => true,
                'gross_paise' => $effectiveGross->paise(),
                'commission_paise' => $commission->paise(),
            ],
        ];
    }
}
