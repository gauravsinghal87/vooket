# Admin and Frontend Financials

## 1. Admin dashboard

- Endpoint: `GET /api/v1/admin/dashboard` -> `Admin\DashboardController::index`.
- **RESOLVED (Phase F):** the dashboard no longer labels gross order value as
  "revenue". It now exposes distinct metrics:
  - `today_gross_order_value` / `total_gross_order_value` = sum of
    `orders.total_amount` (gross order value, not cash received).
  - `today_platform_revenue` / `total_platform_revenue` = sum of
    `Commission.commission_amount` where `status != 'reversed'`.
  - `revenue_series[]` = `{date, orders, gross_order_value, commission}`.
  - `top_vendors[]` includes `orders_count`, `gross_order_value`, `commission`.
  - The old `today_revenue` / `total_revenue` keys were removed.
- `AdminDashboardMetricsTest` asserts gross order value and platform revenue are
  different numbers and that reversed commissions are excluded.
- Frontend (`admin-web/src/pages/dashboard.tsx`) labels were corrected to
  "Gross Order Value" and "Platform Revenue".

## 1b. Admin vendor list

- `GET /api/admin/vendors` (`VendorManagementController::index`) previously
  returned `revenue` = `orders_sum_total_amount` (gross, mislabeled).
- **RESOLVED (Phase F):** now returns `gross_order_value` (gross order value) and
  `commission` (sum of non-reversed `Commission.commission_amount` for the
  vendor). Frontend columns renamed to "Gross sales" / "Commission".

## 2. Admin refunds

- `GET /api/admin/refunds`, show, store, approve, process, reject, refundCancelledOrder.
- Support tickets refund approval uses refundDeliveredOrder.

## 3. Admin payouts

- `GET /api/admin/payouts`, show, processing/paid/failed.
- Payouts are manual; no gateway transfer.

## 4. Admin support tickets

- `GET /api/admin/support-tickets`, show with refund_summary and financial_review (settlement items, partner earnings). Note delivery partner earnings never reversed.

## 5. Admin settings/commission

- Vendor commission override via `PUT /api/admin/vendors/{id}/commission`.
- Commission rules likely managed via settings/promotions? Search commission_rules usage only in CommissionService; no admin CRUD route found in routes snippet. Check Admin settings. Unverified.

## 6. Vendor financials

- `GET /api/vendor/earnings` (overview), `/settlements`, `/payouts`, `POST /payouts` -> EarningsController.
- EarningsController not inspected in detail; likely uses Settlement + Payout + Wallet. Need verify formulas in independent review.

## 7. Partner/driver financials

- Earnings, withdrawals, wallet, topup endpoints. Partner wallet balance floor tests exist.

## 8. Customer financials

- Order payment details, support ticket, wallet.

## 9. React Native

- Located `customer-app/`. API clients likely in src/services. Not inspected in detail; frontend calculations may duplicate backend. Check for stale cache/pagination. Out of scope for this pass beyond noting.

## 10. Stale cache / pagination

- Wallet transactions paginated 15. Refunds/payouts paginated 20. Potential stale balances if frontend caches.
- `WalletService::getTransactions` filters service/direction/type/date.

## 11. Potential display mismatches

- **RESOLVED (Phase F):** dashboard/vendor-list no longer present gross order
  value as revenue; gross order value and platform revenue (commission) are
  separate, explicitly labeled metrics.
- Tax labels in customer-web / admin-web / vendor-web now read "Taxes
  (included)" / "Tax (incl.)" to reflect tax-inclusive pricing.
- Vendor wallet balance vs settlement due can diverge (wallet credited on
  delivery; settlement row processing).
- Partner total_earnings cached on delivery_partner; wallet balance may differ due to withdrawals/topups.
- Ride driver earnings status PENDING but wallet credited; dashboard may show pending.
