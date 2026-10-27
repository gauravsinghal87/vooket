# Risks and Evidence

## Verified facts / defects

1. Tax not applied at order creation.
   - File: `backend/app/Services/OrderService.php` lines 128, 222: `$taxAmount = 0.0;` and total uses `$taxAmount`. Product has `tax_rate` (e.g. 5 in tests) but never applied. Test `OrderDeliverySettlementTest` expects commission 42 (gross 420 = 400 subtotal + 20 tax) but actual 40. Evidence: failing test.

2. Commission rule scoping incomplete.
   - File: `backend/app/Services/CommissionService.php` lines 63-69: query filters service, is_active, effective dates, priority/id. Does not filter vendor_id/category_id/city_id/zone_id/vehicle_type_id despite columns. So rules are global per service, not scoped. Also no scoping by applicable_to (vendor/driver/etc.) in query.

3. Commission gross/net mismatch with max_amount.
   - File: `CommissionService.php` lines 89-94, 286: when base capped by max_amount, net = effectiveGross - commission, but gross_amount stored as effectiveGross (capped), not original gross. Commission calculated on capped base. Could be intended but undocumented.

4. Dashboard revenue overstates cash.
   - File: `backend/app/Http/Controllers/API/Admin/DashboardController.php` lines 36-37: sums total_amount where payment_status != 'failed'. Includes pending/unpaid/refunded/cancelled-paid orders. Not net cash/commission.

5. No true double-entry accounting.
   - `ledger_entries` one row per transaction (account_type opposing side). No paired debit/credit rows. `wallets.balance` is cached mutable. Evidence: `WalletService::recordLedger` creates single entry.

6. Refund processing always credits customer wallet.
   - File: `backend/app/Services/RefundService.php` process() lines 598-608: credits customer wallet for every processed refund, including original payment method refunds. Could double-pay if gateway also refunds card.

7. Cancelled order refund (admin) creates COMPLETED refund without money movement.
   - `refundCancelledOrder` creates Refund status COMPLETED, updates payment_status REFUNDED, reverses settlements/commissions, but does not credit wallet or call gateway. Customer may not receive funds.

8. Delivery partner earnings never reversed on refund.
   - Documented in code and support ticket UI note. By design? Business rule unknown. Potential overpayment.

9. Refund reversal amounts not proportional.
   - `refundDeliveredOrder` reverses entire settlement items for order regardless of refund amount (partial refund reverses full settlement). Commission reversed entirely.

10. Inconsistent settlement reversal scope.
    - Cancelled refund reverses all settlements including delivery partner; delivered refund skips delivery partner.

11. Ride cancellation fee not actually charged.
    - `RideService::cancelRide` records fee in meta but no wallet debit/credit. Online-paid cancelled ride not refunded automatically (no RefundService usage). Driver compensation not paid.

12. Ride driver earnings status never becomes paid.
    - `DriverEarning` created status PENDING; no transition to paid. Wallet credited immediately. Payout availability treats pending earnings as available. Could allow payout before completion? Completion sets earning. But status stays pending.

13. Commission not recorded for rides in commissions table.
    - Only driver_earnings has commission_amount. No platform revenue ledger for rides.

14. Debit does not protect pending (reserved) balance.
    - `WalletService::debit` checks balance >= amount only; can spend reserved funds.

15. `getBalance` returns raw balance including reserved funds (spendable not considered) in some callers (OrderService wallet payment uses getBalance raw). Could allow spending reserved money.

16. `findPaymentForWebhook` uses orWhere without grouping, potential wrong payment selection.
   - File PaymentService lines 424-440: if orderId provided, `orWhere('provider_order_id', $orderId)` combined with provider id conditions; may match unrelated payments.

17. Webhook eventId includes full payload in md5, reducing duplicate detection effectiveness (payload may vary). Also event_id uniqueness per provider.

18. Idempotency keys for refunds: `refundDeliveredOrder` uses `SUPPORT_REFUND_{ticketId or order.id}`; re-refund after first rejected/failed? New ticket uses same order id? Could block legitimate second refund if ticket missing.

19. Commission rule query ignores scoping fields and applicable_to; also multiple active rules ordered by priority then id; first wins.

20. `OrderService` hardcoded tax 0; also `tax_amount` column exists but unused.

21. `CommissionService::finalizeForOrder` updates order fields even if not configured; settlement credit only if net_amount >0.

22. `finalizeVendorSettlement` creates settlement with status 'processing' (lowercase) while migration default PENDING (uppercase). Status comparisons use uppercase elsewhere? Settlement status values mixed (PENDING vs processing). Potential inconsistency. Evidence: CommissionService uses 'processing' string; WithdrawalService filters status='processing' lowercase. OK consistent within code but differs from migration enum-ish. Fine.

23. `finalizeVendorSettlement` settlement uniqueness not enforced: `firstOrCreate` by party_type+vendor_id+status+period_type+period_start/end. Multiple days separate. OK.

24. `SettlementItem::updateOrCreate` by settlement_id+source_type+source_id ensures idempotency per settlement. But if settlement row changes (status no longer processing), a new settlement may be created and item duplicated? firstOrCreate on processing status only, so if status changed, new settlement. Could duplicate earnings. Potential.

25. `recordPartnerEarning` increments partner total_earnings using DB::raw float addition; potential precision.

26. `DeliveryService::markDelivered` sets partner_payout_status 'pending' but no later update to paid when payout processed (order-level not linked to payout). 

27. Admin dashboard top_vendors count vs sum mismatch (status filter only count).

28. `WalletService::availableForUpdate` returns zero if wallet missing, while `available` creates wallet. Inconsistent.

## Suspected risks requiring DB verification

- Duplicate commissions before unique constraint (migration deduped).
- Existing data with payment_status values casing (paid vs PAID).
- Settlement status mixed casing.
- Refund rows with null payment_id.
- Wallet balance vs transaction sum drift.
- Delivery partner earnings reversed status handling in reconcileFinalizedEarnings (excludes reversed).
- Coupon usage reversal status.

## Missing implementation

- Product tax application.
- Item-level/partial quantity refunds for grocery substitutions.
- Ride refund/dispute flow.
- Ride cancellation fee charging/compensation.
- Real payout provider transfer.
- Bank/original payment method refund processing (process() credits wallet instead of gateway refund? Actually calls gateway->refund then credits wallet; double).
- Ledger double-entry.
- Commission admin CRUD? Unverified.
- Audit trail for settlement deletion.

## Test coverage gaps

- Tax application.
- Partial refunds and proportional reversal.
- Concurrent payout requests.
- Webhook duplicate/replay.
- Ride cancellation financial effects.
- Insufficient vendor balance on refund.
- Idempotency across services.
- Frontend stale cache.

## Confirmed test failure

- `OrderDeliverySettlementTest::test_delivered_order_finalizes_commission_from_commission_rule` and idempotency test: expected 42, actual 40 (due to tax 0).
