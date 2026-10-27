# Food Financial Flow

## 1. Cart & order creation

- Route: `POST /api/orders` (auth customer) -> `OrderController::store` -> `OrderService::createOrder(User, data)`.
- Cart type `food`, `vendor_id` from cart. Products must be active/available; price from product/variant + options via `ProductOptionService`.
- Totals: `subtotal` sum line totals; `tax_amount = 0.0` hardcoded in `OrderService::createOrder` (no product tax applied at order creation, despite product.tax_rate). `delivery_fee` from `DeliveryFeeService` or cart fallback; `packaging_fee`, `handling_fee` from `DeliveryFeeService::serviceCharges('food')`; `platform_fee=0`; `discount_amount` from coupon; `tip_amount` from request. `total_amount = subtotal + tax + delivery_fee + delivery_gst + packaging + handling + platform - discount + tip` (Money round).
- Wallet: if payment_method=wallet, `walletService->getBalance` (raw balance, not available), `walletUsed = min(balance,total)`, total reduced; `payment_status = partial_paid` if walletUsed>0 else pending.
- Order status: `SCHEDULED` if delivery slot else `PENDING`; (food usually instant/PENDING). Payment status pending/partial_paid.
- Idempotency: `idempotency_key` unique per (user_id, idempotency_key), fingerprint check.
- Inventory reserved via `InventoryService::reserveForOrder`.
- Coupon redemption recorded.
- Wallet debit for wallet_used with idempotency `order:create:{order_number}`.
- Cart cleared.

## 2. Payment initiation/verification

- Route `POST /api/payments/initiate` -> `PaymentController::initiate` -> `PaymentService::initiatePayable(user, payable=Order, method, idempotencyKey)`.
- Amount server-side from `order.total_amount` minus already paid (`paidAmountForPayable`: payments SUCCESS/PARTIALLY_REFUNDED/REFUNDED + wallet debits PURCHASE/WITHDRAWAL/CASH_COLLECTION/DEBIT).
- Creates `payments` row status INITIATED, provider order via gateway (`createOrder`), provider_order_id stored.
- Verify: `POST /api/payments/verify` -> `PaymentService::verifyPayment` -> signature check (unless mock) -> gateway `verifyPayment` -> `applyProviderStatus`.
- On captured: `capturePayment` row-locks payment (INITIATED/PENDING/FAILED), checks amount match, sets SUCCESS, paid_at, verified_at, records PaymentTransaction, `applySideEffect` -> `syncPayableCoverage(order)` sets payment_status paid if paid>=total.
- Webhook: `POST /api/webhooks/razorpay` -> `PaymentWebhookController` -> `PaymentService::processWebhookEvent` idempotent by (provider,event_id). On payment.captured sets captured -> capture.
- Failed payments: `markFailed` sets FAILED.

## 3. Fulfillment & delivery

- Vendor accept/prepare/ready via vendor order controller (status transitions per OrderStateMachine).
- Delivery partner assignment: `DeliveryService::claimOrder` (row lock; freezes accepted offer earning snapshot).
- markPickedUp/OutForDelivery/Arrived/Delivered.
- Delivery gate `assertDeliveryReady`: payment must be satisfied (online captured or cash collected+settled) and OTP verified.

## 4. Delivery completion financial side effects

On `markDelivered`:
- Sets status DELIVERED, delivered_at, delivered_via, partner_payout, partner_payout_status=pending.
- `InventoryService::completeSale`.
- `recordPartnerEarning`: creates `delivery_partner_earnings` unique(order_id,delivery_partner_id), status earned; credits partner wallet via `WalletService::creditEarning` idempotent by earning id; increments partner total_deliveries/total_earnings once.
- `CommissionService::finalizeForOrder`: calculates commission; updates order.commission_fee, net_vendor_payout, vendor_payout_status=pending; creates `commissions` row (unique party_type,source_type,source_id); `finalizeVendorSettlement`: credits vendor wallet SETTLEMENT idempotent `vendor-settle:order:{id}`; creates/updates daily `settlements` (processing) + `settlement_items` (source_type=order) and recomputes gross/commission/net.

Commission formula (`CommissionService::calculateForOrder`):
- service = OrderServiceTypeResolver::resolve(order) (food/grocery).
- gross = subtotal + tax_amount - discount_amount + tip_amount. (delivery_fee excluded; platform_fee excluded; packaging/handling excluded).
- Rule resolution: first active commission_rules where service matches, effective today, priority desc, id desc (NOTE: does not filter vendor_id/category_id/city_id/zone_id/vehicle_type_id despite columns). If fixed type -> fixed_amount commission. If percentage -> rate; max_amount caps base if base > max; min_amount -> if gross < min, commission 0 and configured true.
- Else vendor.commission_rate if not null. Else AppSetting group=commission key={service}_commission.
- If none configured -> rate 0, configured false, no commission row recorded (but finalizeForOrder still updates order fields and settlement).
- commission = base * rate% (Money percent). net = base - commission (note: net uses effectiveGross which may be capped by max_amount, not original gross).

## 5. Partner earning formula

`DeliveryFeeService::partnerEarning(service, distanceKm, customerFee, adminFundedAmount)`. Customer delivery fee + free-distance guarantee + admin per-km beyond free allowance. See tests. For cash-on-delivery orders, delivered_via = PARTNER_ONLY; delivery fee is partner earning? Actually partner_payout = earning amount.

## 6. Cash collection at door (food/grocery)

- `DeliveryService::confirmPaymentCollection`: partner records cash collected; sets delivery_payment_collected_at/via=cash, payment_status=paid (no wallet credit).
- `settleCashCollection`: partner wallet debited by remaining amount (SETTLEMENT debit idempotent `delivery-cash-settlement:{order_number}`); sets delivery_payment_settled_at. Requires sufficient partner wallet balance; else returns shortfall, not settled.
- Delivery gate requires settled for cash.

## 7. Cancellation

- `DeliveryService::cancelOrder` (called by OrderService::cancelOrder). Row lock. Sets CANCELLED. Releases partner if idle, inventory reservation, delivery slot. `unwindCustomerPayments`: credits customer wallet for wallet_used (idempotent `order-cancel:wallet:{id}`); for each SUCCESS/PARTIALLY_REFUNDED payment creates refund request for refundable amount (idempotent `order-cancel:payment:{payment_id}`) status REQUESTED (not processed). Sets order.refund_amount, refund_status=pending (or null). Does NOT reverse vendor settlement/commission automatically on cancellation (only refund requests created). Note: refund processing later may credit customer via process() (gateway refund + wallet credit) potentially double-crediting? See risks.

## 8. Vendor/payout

- Vendor wallet credited net amount on delivery (SETTLEMENT). Settlement row status processing.
- Vendor payout request: `WithdrawalService::requestVendorPayout` compares wallet available and settlement due; reserves? For vendor, no wallet reservation at request; available = settlement net_payable - requested payouts. Payout status PENDING. On admin mark paid: `markPayoutSuccess` debits vendor wallet (idempotent `admin-payout-paid:{id}`) and sets SUCCESS. On failed: releases nothing for vendor (no reservation). Minimum wallet floor applies.

## 9. Refunds (delivered order via support ticket)

- `RefundService::refundDeliveredOrder`: only DELIVERED orders. Validates payment SUCCESS/PAID/PARTIALLY_REFUNDED. Amount <= order total and remaining refundable. Creates Refund status APPROVED (or PROCESSING for bank). Reverses vendor/platform settlement items (skips delivery_partner settlements): decrements settlement.net_payable, increments total_refunds, deletes settlement_items; if net<=0 sets REVERSED. Debits vendor wallet ADJUSTMENT idempotent `VENDOR_REVERSAL_SETTLEMENT_{settlement_id}`. Reverses commissions status REVERSED. If destination=wallet, credits customer wallet REFUND and marks COMPLETED; else leaves PROCESSING. Sets order.payment_status=PARTIALLY_REFUNDED. Does NOT reverse delivery partner earning.

## 10. Admin cancelled order refund

- `RefundService::refundCancelledOrder`: only CANCELLED. Payment SUCCESS/PAID. Creates Refund status COMPLETED (idempotency `ADMIN_ORDER_REFUND_{order_id}`). Sets payment_status REFUNDED. Reverses settlement items (all parties? includes delivery partner? It groups by settlement; reverses net_payable and deletes items; if net<=0 REVERSED). Reverses commissions. Does NOT credit customer wallet or gateway refund in this method (relies on? Actually creates Refund COMPLETED but no wallet credit/gateway call here) — potential gap. See risks.

## 11. Frontend

- Customer order details, payment, support ticket. Vendor earnings/settlements/payouts. Partner earnings/withdrawals/wallet. Admin orders/refunds/payouts/dashboard.
