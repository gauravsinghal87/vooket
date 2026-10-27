# Financial Audit Progress Report

## Status: IMPLEMENTATION PHASES A–F COMPLETE — GREEN

This report supersedes the earlier Phase-1-only report. All money-affecting
findings from the audit have been implemented with tests, and the full backend
suite is green.

## Baseline (recorded before any change)

- Repo had **no git baseline** (branch `master`, zero commits, all files
  untracked). The original baseline record is therefore the pre-change test run:
  - Financial subset: 105 tests, 103 passed, **2 failed** (pre-existing
    commission expectation mismatch), later fixed.
  - Later, before Phase D: full suite **765 tests / 0 failures / 3630 assertions**.
- DB: MySQL `vooket` (dev); tests use SQLite `:memory:` with
  `THIRD_PARTY_MODE=mock`.

## Final test result (actual, this machine)

```
php -d memory_limit=1024M vendor/bin/phpunit
```
- **793 tests / 0 failures / 0 errors / 3870 assertions / ~296s**
- Required environment: `OPENSSL_CONF=C:\wamp64\bin\php\php8.4.15\extras\ssl\openssl.cnf`
  set **before** PHP starts (PHP 8.4 loads the OpenSSL config at process start;
  a runtime `putenv` is too late). Without it, `GoogleAuthTest` fails — this is
  an environment requirement, not a code defect.
- `php -d memory_limit=1024M` is required; the default 128M is exhausted.

## What was implemented

### Phase A — Safety fixes, tax-inclusive semantics, refund orchestration
1. `WalletService::debit` protects pending (reserved) balance; spendable =
   `balance - pending_balance`.
2. `OrderService` wallet payment uses available balance, not raw balance.
3. `PaymentService::findPaymentForWebhook` groups provider/order matching.
4. Commission rule query scoped by `vendor_id` + `applicable_to`.
5. **Tax-inclusive pricing**: product prices are tax-inclusive.
   `OrderService::extractInclusiveTax` extracts per-line tax as
   `lineTotal * rate / (100 + rate)` using `products.tax_rate`; `total_amount`
   does **not** add `tax_amount` back. Order and cart totals are
   `subtotal + delivery_fee + delivery_gst + packaging + handling − discount`.
   Delivery GST (on the delivery fee) and ride fare tax remain additive.
6. `CommissionService::calculateForOrder` gross = `subtotal − discount_amount`
   (no tax, tips, delivery, packaging, or handling in the commission base).
7. **`RefundService` fully rewritten**: explicit destinations
   (`wallet` / `original` / `bank`), exactly one reimbursement path per refund,
   `refundCancelledOrder`, `refundDeliveredOrder`, `reconcileDeliveredRefund`,
   `refundRide`, `reverseVendorShareForOrder`, `markCommissionsReversed`,
   `syncPayableAfterRefund`, `process()`, `postGatewayRefundJournal`.
   Idempotency anchored on refund id / provider reference / unique
   `idempotency_key`.

### Phase B — Double-entry journal
- Migration `2026_10_20_131611_create_journal_tables.php`
  (`journal_entries`, `journal_lines`; unique nullable
  `journal_entries.idempotency_key`).
- Models `JournalEntry`, `JournalLine`; `JournalService`.
- Wired into `WalletService`, `PaymentService::capturePayment`,
  `RefundService::process`, `CommissionService::finalizeForOrder`,
  `DeliveryService::confirmPaymentCollection`, and
  `RideService::confirmCashCollection`.
- Accounts: assets `payment_clearing`, `cash_on_hand`,
  `partner_cash_receivable`, `driver_cash_receivable`;
  liabilities `customer_wallet`, `vendor_wallet`, `driver_wallet`,
  `delivery_partner_wallet`, `platform_wallet`, `order_revenue_clearing`,
  `ride_revenue_clearing`; income `platform_revenue`; expense `platform_expense`.
- Tests `JournalServiceTest` + `JournalWiringTest` (13) green.

### Phase C — Grocery item-level adjustments/refunds
- Migration `2026_10_20_140000_add_adjustment_tracking_to_order_items.php`
  (`order_items.adjusted_quantity`, `order_items.refunded_amount`).
- `GroceryAdjustmentService` (idempotency anchored on owned
  `FinancialAdjustment` rows) + admin endpoint
  `POST /api/admin/orders/{id}/adjust-items`
  (`RefundController::adjustItems`).
- `GroceryAdjustmentTest` (9) green.

### Phase D — Ride finances
- `Ride::payments()` morphMany added (refunds previously called an undefined
  method).
- `RideService::cancelRide` charges a configured `FareRule.cancellation_fee`
  when `> 0`: wallet rides debit the wallet + post journal
  `ride:cancellation-fee:{ride_number}`; cash/online rides are recorded as
  deferred/uncollected (no invented receivable); wallet shortfalls defer.
- `RideService::completeRide` writes a `Commission` row
  (`party_type=driver`, `source_type='ride'`) + journal
  `commission:accrued:ride:{id}` when commission > 0.
- `WithdrawalService::markPayoutSuccess` marks pending `DriverEarning` rows
  `paid` oldest-first up to the payout amount and stamps
  `meta.settled_by_payout_id` / `settled_at`.
- `RideFinanceSettlementTest` (7) green.

### Phase E — Payout controls
- Verified pre-existing: unique `payouts.idempotency_key` index
  (`2026_09_12_130000_harden_financial_security.php`); admin payout routes gated
  by `role:super_admin`.
- `requestWalletWithdrawal` reserves via `WalletService::reserveForWithdrawal`
  (moves into `pending_balance`) and is idempotent; earnings payouts do not
  reserve (availability already nets in-flight payouts).
- `PayoutControlsTest` (10) green.
- Payouts remain **manual** (no gateway transfer).

### Phase F — Admin finance dashboards, labels, and metrics
- `DashboardController` rewritten to distinguish:
  - `today_gross_order_value` / `total_gross_order_value`
  - `today_platform_revenue` / `total_platform_revenue`
    (sum of `Commission.commission_amount` where `status != 'reversed'`)
  - `revenue_series[]` now `{date, orders, gross_order_value, commission}`
  - `top_vendors[]` now includes `orders_count`, `gross_order_value`, `commission`
  - Old misleading `today_revenue` / `total_revenue` keys removed.
- `VendorManagementController::index` now returns `gross_order_value` +
  `commission` instead of `revenue` (which was gross order value).
- `AdminDashboardMetricsTest` (2) green.
- Frontend:
  - `admin-web/src/pages/dashboard.tsx`: labels "Gross Order Value" /
    "Platform Revenue", chart "Orders & Gross Order Value — last 7 days".
  - `admin-web/src/pages/vendors.tsx`: "Gross sales" + "Commission" columns.
  - `admin-web/src/types/panel.ts`, `admin-web/src/typings/models.ts` updated to
    new field names.
  - Tax labels clarified to show inclusion:
    - `customer-web/.../order-detail.tsx`: "Taxes" → "Taxes (included)".
    - `admin-web/.../orders.tsx`: "Tax" → "Tax (incl.)".
    - `vendor-web/.../orders.tsx`: "Tax" → "Tax (incl.)".
- All frontend builds green: admin-web, customer-web, vendor-web.

## Deployment / migration instructions

Run on each environment (staging first):

```bash
cd backend
php artisan migrate   # applies the two new migrations below
php artisan config:clear
```

New migrations introduced by this work:
- `2026_10_20_131611_create_journal_tables.php`
- `2026_10_20_140000_add_adjustment_tracking_to_order_items.php`

Pre-existing migrations relied upon (ensure already applied):
- `2026_09_12_130000_harden_financial_security.php` (unique
  `payouts.idempotency_key`).
- Order-settlement fields migrations (settlement/payable columns used by
  `RefundService` / `CommissionService`).

Backfill notes:
- `order_items.adjusted_quantity` defaults to 0 and `refunded_amount` to 0 (no
  backfill required).
- Existing `Commission` rows keep their status; only `!= 'reversed'` counts as
  platform revenue.
- The new journal tables start empty; historical transactions are **not**
  backfilled (see open decisions).

Environment:
- Set `OPENSSL_CONF` before PHP starts on hosts running `GoogleAuthTest`
  (test-only requirement; production is unaffected).
- `PARTNER_MIN_WALLET_BALANCE` (default 200) and the vendor payout floor
  (default 500, `vendor_payout.min_wallet_balance`) remain in force.
  `ConfigurationSeeder` also writes AppSetting `partner_min_wallet_balance`
  (group `partner_payout`).

## Verification commands

```powershell
# backend
$env:OPENSSL_CONF='C:\wamp64\bin\php\php8.4.15\extras\ssl\openssl.cnf'
php -d memory_limit=1024M vendor/bin/phpunit
php vendor/bin/pint <explicit file list>   # `--dirty` hangs in this repo

# frontends
npm run build   # in admin-web, customer-web, vendor-web
```

## Remaining / out of scope (unchanged by this pass)

- Reconciliation tooling beyond earnings reconcile is still not implemented.
- Payout gateway transfers remain manual.
- Historical data is not back-filled into the journal.
- See `open-questions.md` for business decisions still requiring product input
  (embedded-GST remittance, vendor payable gross-inclusive treatment, ride
  commission split, cash-handoff account mapping).
