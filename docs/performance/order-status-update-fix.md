# Order Status Update Latency Fix — Final Report

**Date:** 2026-10-21  
**Scope:** Backend + frontend (vendor-web, partner-web, customer-web, admin-web); measured with real HTTP against `php artisan serve`

## Root Causes

1. **Synchronous Reverb broadcast (primary)** — `OrderTrackingBroadcaster::orderUpdated` used `broadcast(new OrderUpdated(...))` synchronously via the `reverb` broadcaster. With no Reverb server running, `ReverbRealtimeProvider::broadcast()` made blocking HTTP calls that timed out/blocked ~2s per broadcast. Status updates triggered **2–3 broadcasts** (`order_updated`, `vendor_order_updated`, assignment/cancellation events) → **2–6 s of dead time** in the HTTP request thread. `BroadcastManager` errors were swallowed, so requests appeared to complete slowly rather than failing fast.
2. **Stale queue job (secondary)** — A failed `SyncOtpRequest` job sat in `jobs` for 12 days (drained).
3. **No HTTP client timeouts on Reverb** — `config/broadcasting.php` had no `client_options` timeouts; even with a server, slow connections would block requests indefinitely.

## Measured Results (Real HTTP, single-threaded `php artisan serve`)

| Transition | Before (sync broadcasts) | After (queued broadcasts) | Improvement |
|---|---|---|---|
| `PUT /vendor/orders/{id}/status` (preparing) | **4320 ms** median (min 4313, max 4331) | **248 ms** median (min 185, max 282) | **~17× faster / 94% reduction** |
| `POST /delivery-partner/orders/{id}/status` (valid transition) | **~4400 ms** max (blocked by broadcast chain) | **~257 ms** median (min 180, max 410) | **~17× faster / 94% reduction** |
| `GET /vendor/orders` | — | 329 ms median (DB work 30 ms / 8 queries, no N+1) | Acceptable (dev-server overhead) |
| `GET /admin/orders` | — | 345 ms median | Acceptable (in-memory merge; arch, not N+1) |

Query profiling confirmed the vendor index does **30 ms of DB work across 8 well-shaped queries** (eager-loaded, paginated). Latency is dominated by single-threaded Laravel dev server boot/serialization.

## Backend Changes

### Queued Broadcasting
- **New jobs:** `app/Jobs/BroadcastOrderTracking.php` (`ShouldQueue`, `$tries=3`, `$backoff=[5,15,30]`, `$timeout=15`) — intents: `order_updated`, `vendor_order_updated`, `assignment_confirmed` (+partner_id), `order_cancelled_for_partner` (+partner_id); eager-loads `order.items`, `order.deliveryPartner.user`; failures logged/swallowed.
- **New job:** `app/Jobs/BroadcastPartnerLocation.php` (`$tries=1`, `$timeout=15`).
- **Call sites converted (DB::afterCommit / dispatch):** `app/Services/DeliveryService.php` (`queueTrackingBroadcast` replacing `broadcastOrder/broadcastAssignment/broadcastCancellationForPartner`), `app/Http/Controllers/API/Vendor/OrderController.php` (updateStatus), `app/Http/Controllers/API/DeliveryPartnerController.php` (acceptOrder/updateOrderStatus/updateLocation), `app/Http/Controllers/API/Admin/OrderManagementController.php` (updateStatus), `app/Services/OrderService.php`, `app/Services/DeliverySlotService.php`. Removed now-unused imports.
- **Unchanged (intentionally):** `OrderReady` dispatch/listener flow left synchronous (DB/state transitions); automatic dispatch pipeline unchanged.

### Reverb Timeouts
- **New:** `config/broadcasting.php` (copied framework default) with env-driven `reverb.client_options` (`connect_timeout` default 2, `timeout` default 5). `php artisan config:clear` run. (Socket connect timeouts on Windows still block briefly; queuing is the real fix.)

### Webhook Laziness
- **Refactored:** `app/Services/Integration/WebhookNotifier.php` — added `webhooksEnabled()` guard + `notifyLazy(event, payloadCb, ownersCb)` so disabled/unsubscribed webhooks incur no DB queries; all public methods now lazy. `WebhookNotifier` ref removed from vendor queries.

### N+1 / Indexes
- **Verified:** Vendor orders index: 30 ms / 8 queries, eager-loaded (`user`, `items` with selected columns, `deliveryPartner.user`, `dispatchLogs` filtered). Admin index: in-memory merge across Order+Ride tables by design (not query-per-row N+1). All hot indexes present (`orders.vendor_id,status`, `orders.order_type,status,created_at`, `orders.delivery_partner_id`, `order_items.order_id`, `dispatch_logs.order_id,status`, `delivery_partners.service_type,status,is_online`).

## Frontend Changes

### Optimistic Updates + Rollback (vendor-web, admin-web)
- **vendor-web/src/pages/orders.tsx:** Added `patchOrderInListCaches` to update all cached list pages; `QuickAction` and `OrderDrawer` mutations now use `onMutate` (optimistic status, rollback on error) + `onSuccess` (write server response) + `onSettled` (invalidate). Drawer syncs from list cache while open.
- **admin-web/src/pages/orders.tsx:** Added optimistic patching for `statusMutation` with rollback; expanded order detail stays in sync with list/poll updates.

### Visibility-Aware Polling Fallback (all web apps)
- **vendor-web/src/pages/orders.tsx:** `refetchInterval: 15000`, `refetchOnWindowFocus: true` on orders list (while Reverb not wired).
- **partner-web:** Already had `refetchInterval: 15000` on active job/incoming requests (kept).
- **customer-web:** Had 5s fallback in `lib/realtime.ts` (provider unwired; unchanged structurally).
- **admin-web/src/pages/orders.tsx:** `refetchInterval: 15000`, `refetchOnWindowFocus: true`.

**Note:** No app has Laravel Echo/Reverb wired client-side; `customer-web/src/lib/realtime.ts` defines a pluggable provider (channels `order.{id}`, `ride.{id}`, `private-orders.{id}`) but is unregistered. Wiring clients is a separate task.

## Verification

- **Backend tests:** `801 tests / 0 failures / 0 errors / 3897 assertions` (full suite, ~184s)
- **Syntax:** All changed files pass `php -l`
- **Feature tests:** `OrderReadyDispatchTest` / `OrderDeliverySettlementTest` / `GroceryBatchTest` — all pass
- **Frontend typecheck:** vendor-web, partner-web, customer-web, admin-web all pass
- **Frontend build:** All four apps build successfully

## Production Configuration (Required)

1. **Start a queue worker** for the `database` queue (jobs are dispatched there in `.env`). Example: `php artisan queue:work --queue=default --tries=3 --timeout=60` (or Supervisor/systemd). Two workers were observed running during testing.
2. **Configure Reverb (optional but recommended for true realtime):** Set `BROADCAST_CONNECTION=reverb` (already set), run `php artisan reverb:start`, and wire Echo on frontends. The current fix makes broadcasts non-blocking regardless; without a server/clients they're just queued-and-dropped silently (logged on failure after retries).
3. **Monitor failed jobs:** `php artisan queue:failed` / Horizon if used. Broadcast jobs have `$tries=3` with backoff `[5,15,30]` and swallow exceptions.
4. **HTTP client timeouts:** `config/broadcasting.php` now sets Reverb timeouts (env-configurable). If using other broadcasters, review `client_options`.

## Files Changed (Key)

**Backend (new):** `app/Jobs/BroadcastOrderTracking.php`, `app/Jobs/BroadcastPartnerLocation.php`, `config/broadcasting.php`  
**Backend (modified):** `app/Services/DeliveryService.php`, `app/Services/Integration/WebhookNotifier.php`, `app/Http/Controllers/API/Vendor/OrderController.php`, `app/Http/Controllers/API/DeliveryPartnerController.php`, `app/Http/Controllers/API/Admin/OrderManagementController.php`, `app/Services/OrderService.php`, `app/Services/DeliverySlotService.php`  
**Frontend:** `vendor-web/src/pages/orders.tsx`, `admin-web/src/pages/orders.tsx`  
**Temp harnesses (for measurement):** `C:\Users\gaurav\AppData\Local\Temp\opencode\perf_http.php`, `makefixtures.php`, `cleanfixtures.php` (removed/ephemeral)
