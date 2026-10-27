# Refund and Reversal Flow

## 1. Refund request entry points

- Customer-facing? `OrderController::refundRequest` (route `POST /api/orders/{id}/refund-request`) — inspect controller for exact. Admin `POST /api/refunds` -> `RefundController::store` -> `RefundService::request(user, payment, amount, reason, notes, idempotencyKey)`.
- Admin support ticket approve refund: `POST /api/support-tickets/{id}/refund` -> `SupportTicketController::approveRefund` -> `RefundService::refundDeliveredOrder`.
- Admin cancelled order refund: `POST /api/admin/orders/{id}/refund` -> `RefundController::refundCancelledOrder` -> `RefundService::refundCancelledOrder`.
- Automatic on cancellation: `DeliveryService::cancelOrder` -> `unwindCustomerPayments` creates refund requests + wallet credits.

## 2. RefundService::request

- Requires payment.status in SUCCESS or PARTIALLY_REFUNDED; user owns payment.
- Amount positive. Idempotent by idempotency_key.
- Computes remaining refundable via `refundableAmount(payment)` = charged - sum of refunds not FAILED/REJECTED (so REQUESTED/APPROVED/PROCESSING/COMPLETED reserve balance). Locks payment.
- Creates Refund status REQUESTED.
- Does not credit wallet or call gateway (processing separate).

## 3. Approve / reject / process

- `approve`: REQUESTED -> APPROVED (admin).
- `reject`: REQUESTED/APPROVED -> REJECTED.
- `process`: locks refund (REQUESTED/APPROVED/PROCESSING/FAILED). Calls gateway->refund(payment.provider_payment_id, amount). On success sets COMPLETED, provider_reference, processed_at, credits customer wallet REFUND idempotent `refund:{refund_number}`. On exception sets FAILED. Checks refundable balance again.

Note: `process()` credits wallet for all refunds (including original payment method refunds) — potential double benefit if gateway refund also returns money to card. See risks.

## 4. Delivered order refund (support ticket)

- `refundDeliveredOrder(order, admin, amount, reason, notes, destination, ticketId)`:
  - Requires order DELIVERED, payment SUCCESS/PAID/PARTIALLY_REFUNDED.
  - Amount <= order total and remaining refundable (prior refunds deducted).
  - Idempotency `SUPPORT_REFUND_{ticketId or order.id}`.
  - Creates Refund status APPROVED (wallet or bank same initial).
  - Reverses vendor/platform settlement items (skips delivery_partner settlements): decrements net_payable, increments total_refunds, deletes settlement_items; if net<=0 sets REVERSED.
  - Debits vendor wallet ADJUSTMENT idempotent `VENDOR_REVERSAL_SETTLEMENT_{settlement_id}` (uses reversedAmount = items sum, not refund amount proportion).
  - Reverses commissions status REVERSED.
  - If destination=wallet: credits customer wallet REFUND, sets COMPLETED+processed_at. Else PROCESSING (manual/provider).
  - Sets order.payment_status=PARTIALLY_REFUNDED (always, even full refund).
  - Does not reverse delivery partner earning.

## 5. Cancelled order refund (admin)

- `refundCancelledOrder(order, admin, amount, reason, notes)`:
  - Requires CANCELLED, payment SUCCESS/PAID. Payment method must be wallet/card/upi/netbanking/online/prepaid/internet_banking.
  - Idempotency `ADMIN_ORDER_REFUND_{order.id}`.
  - Creates Refund status COMPLETED.
  - Sets payment_status REFUNDED.
  - Reverses all settlement items for order (including delivery partner? It groups all settlements; no skip). Decrements net_payable, deletes items, if net<=0 REVERSED.
  - Reverses commissions.
  - Does not credit customer wallet or call gateway.

## 6. Automatic cancellation unwind

- `DeliveryService::cancelOrder` -> `unwindCustomerPayments`:
  - Credits customer wallet for wallet_used (REFUND, idempotent `order-cancel:wallet:{id}`).
  - For each SUCCESS/PARTIALLY_REFUNDED payment, requests refund for refundable amount (idempotent `order-cancel:payment:{payment_id}`) status REQUESTED.
  - Sets refund_amount, refund_status=pending.
  - Does not reverse vendor settlement/commission or partner earnings.

## 7. Reconciliation

- `RefundService::reconcileDeliveredRefund(order, admin)` idempotent-ish:
  - Locks order/payment. Collects settlement ids from remaining items, refund meta reversed_settlement_ids, or heuristic vendor settlements with total_refunds>0.
  - For each vendor settlement (skips delivery partner), reverses items if present, increments total_refunds, marks REVERSED if net<=0.
  - Debits vendor wallet if no existing tx with idempotency `VENDOR_REVERSAL_SETTLEMENT_{settlement_id}`.
  - Reverses commissions.
  - Sets payment_status REFUNDED.
  - Does not credit customer (assumes already refunded).

## 8. Risks / gaps

- Cancelled order refund creates COMPLETED refund but no wallet credit/gateway call; customer may not actually receive money unless separately processed.
- `refundDeliveredOrder` reverses settlement by item sums, not proportional to refund amount; partial refund reverses entire settlement for the order. Commission reversed entirely even for partial refund.
- Delivery partner earnings never reversed (by design? documented).
- `process()` always credits customer wallet even for original payment method refunds, potentially double-paying.
- Refundable balance computed from Refund rows not FAILED/REJECTED; REQUESTED refunds reserve balance. Good.
- No pending reservation on wallet for refund (credit only after completion). 
- Gateway refunds can be requested twice? `process()` allows refund statuses REQUESTED/APPROVED/PROCESSING/FAILED; reprocessing a COMPLETED refund would fail lock (not in allowed list) -> okay. But `refund()` gateway call not idempotent by provider reference? provider_reference stored after success.
- Reconciliation can double-debit vendor if existing tx check fails? It checks WalletTransaction by idempotency key before debit. Good.
- `refundCancelledOrder` reverses delivery partner settlements too (unlike delivered refund). Inconsistent.

## 9. Tests

- OrderCancellationRefundTest, VendorRefundReconciliationTest, AdminCancelledOrderRefundRevenueTest. Check for coverage of partial refunds, bank destination, double processing.
