# Open Questions

Business rules that cannot be determined from repository code.

## Resolved during Phase A–F implementation

1. **RESOLVED:** product prices are **tax-inclusive**. Per-line tax is extracted
   as `lineTotal * rate / (100 + rate)` from `products.tax_rate`; `total_amount`
   does not add `tax_amount` back (Phase A).
2. **RESOLVED:** commission is calculated on `subtotal − discount_amount`
   (eligible item subtotal minus applicable discounts). No tax, tips, delivery,
   packaging, or handling in the commission base (Phase A).
3. **RESOLVED:** coupons with null `vendor_id` are platform-funded; commission
   gross subtracts discounts (platform effectively shares) (Phase A).
6. **RESOLVED:** grocery partial fulfillment handled via item-level
   adjustments (`GroceryAdjustmentService`, `order_items.adjusted_quantity` /
   `refunded_amount`) (Phase C).
7. **RESOLVED:** delivery-partner earnings are **not** reversed by ordinary
   Food/Grocery refunds (confirmed intended).
8. **RESOLVED:** cancelled-order refunds have an explicit destination
   (wallet / original / bank) with exactly one reimbursement path
   (`RefundService`) (Phase A).
9. **RESOLVED:** for original/bank refunds the customer wallet is **not** also
   credited; exactly one path is applied (Phase A).
13. **RESOLVED:** ride cancellation fee is charged when a `FareRule` configures
   `cancellation_fee > 0`; wallet rides are debited, cash/online rides are
   deferred/uncollected (no invented receivable) (Phase D). No fee rate is
   invented if unconfigured.
14. **RESOLVED:** ride refunds supported via `RefundService::refundRide` (Phase D).
17. **RESOLVED:** dashboard now exposes gross order value and platform revenue as
   distinct, labeled metrics (Phase F).
19. **RESOLVED:** dashboard no longer treats all non-failed order totals as
   "revenue" (Phase F).
22. **RESOLVED:** refunds/debits respect the pending (reserved) balance and the
   configured payout floors (Phases A/D/E).

## Still open (need product/finance input)

4. Are delivery fees, packaging, handling, platform fees part of vendor
   commission base? Current code excludes them (kept as-is).
5. Is tip included in vendor commission? Current includes tip — confirm.
10. Should the vendor wallet be debited even if insufficient balance on refund?
    Current `debit` throws `Insufficient wallet balance` inside the DB
    transaction (rolls back). Confirm desired fallback (e.g. allow negative /
    platform-funded shortfall).
11. Are payouts manual only or should gateway transfer be integrated? Still
    manual (no provider transfer implemented).
12. Intended `DriverEarning` status lifecycle — wallet credited immediately but
    status now moves pending→paid on payout success (Phase D). Confirm.
15. `wallets.balance` authoritative vs derived from transactions (still cached).
16. Should commission rules be scoped by category/city/zone/vehicle type?
    Columns exist but unused.
18. Are wallet top-ups counted as revenue? No.
20. Reconciliation process for drift between wallet balance and transactions —
    only `reconcileFinalizedEarnings` exists; general reconciliation tooling
    still not implemented.
21. Are daily settlement buckets sufficient, or weekly/monthly? Default daily.
23. Should partner `total_earnings` cache be updated on reversal?
24. Grocery scheduled delivery: financial handling of slot capacity release on
    cancellation; slot fee?
25. Separate wallets per service or one per account type? One per user+wallet_type.
26. Embedded-GST remittance: how is the extracted inclusive GST remitted/filed?
    (Newly surfaced by tax-inclusive implementation.)
27. Vendor payable: is the vendor payable gross-inclusive of the embedded GST,
    or should GST be stripped before crediting the vendor wallet?
28. Ride commission split: is the driver commission rate intended to be the same
    mechanism as vendor commission, and where is it to be configured?
29. Cash-handoff account mapping: confirm the `partner_cash_receivable` /
    `driver_cash_receivable` mapping for cash orders matches operational reality.
