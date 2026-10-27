# Grocery Financial Flow

## 1. Reuse of Food order model

Grocery does NOT have separate order tables. It reuses `orders`/`order_items` with `order_type='grocery'`, `store_id` instead of `restaurant_id`. Same `OrderService::createOrder`, `DeliveryService`, `CommissionService`, `RefundService` paths. Differences are pricing/config and status chain.

## 2. Cart & order creation

- Cart type `grocery`, vendor_id store's vendor.
- `OrderService::createOrder`: if order_type=grocery and delivery_slot_id provided, books slot via `DeliverySlotService::book` (locks capacity; rollback on failure), scheduled_at from slot; else ASAP snapshot.
- Pricing via `resolveDeliveryPricing` grocery branch: `GroceryDeliveryConfigService::resolve(mode)` (instant vs scheduled) with GST, packaging, handling, admin delivery cost, customer delivery fee based on distance and config. Food branch uses DeliveryFeeService.
- tax_amount remains 0.0 hardcoded (no product tax). Subtotal from products (variant price + options).
- substitution_preference stored (contact/auto/none). Inventory reserved.
- Status: SCHEDULED if slot else PENDING.

## 3. Partial fulfillment / substitutions

- OrderStateMachine allows grocery statuses PICKING, PROCESSING, PACKED, PREPARING, READY. Vendor controllers likely transition these. No explicit quantity-change/substitution financial adjustment code found in services inspected; inventory reservation/release exists. Substitution preference stored but no price recalculation service found. Mark as unverified/missing for financial adjustment on substitutions. Need DB/test verification.

## 4. Delivery & earnings

- Same delivery lifecycle as food. Partner earning uses admin-funded per-km rate for grocery (`grocery_delivery_fee_paid_by_admin_per_km`) + free-distance guarantee (`grocery_partner_free_distance_earning`, `grocery_free_delivery_km`). Customer delivery fee may be 0 for free delivery; partner still earns guarantee.
- Grocery batch service (`GroceryBatchService`) groups orders in one trip; delivered_via etc.

## 5. Commission

- Same CommissionService. Gross = subtotal + tax - discount + tip (tax 0). Service resolved by OrderServiceTypeResolver (grocery). Commission rule service='grocery'. AppSetting key `grocery_commission`. Vendor commission_rate override also possible.

## 6. Refunds

- Same RefundService paths (cancelled/delivered). No grocery-specific refund logic found. Delivery partner earnings not reversed. Partial item refunds not implemented (refund amounts are order/payment level, not item level) — suspected gap.

## 7. Differences from food (summary)

| Aspect | Food | Grocery |
|---|---|---|
| Order anchor | restaurant_id | store_id |
| Delivery pricing | DeliveryFeeService (distance + charges) | GroceryDeliveryConfigService (instant/scheduled, GST, packaging, handling, admin cost) |
| Delivery slots | not used | DeliverySlotService booking capacity |
| Status chain | PREPARING -> READY | PICKING/PROCESSING/PACKED/PREPARING -> READY |
| Partner earning config | food_* settings | grocery_* settings |
| Cross-zone | allow_cross_zone_food_delivery | allow_cross_zone_grocery_delivery |
| Cash collection | supported | supported |

## 8. Frontend

- Customer grocery cart/checkout. Vendor store orders. Partner delivery. Admin orders unified.
- Grocery scheduled delivery pricing tests exist.
