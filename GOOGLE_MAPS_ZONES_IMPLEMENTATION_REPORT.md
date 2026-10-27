# GOOGLE MAPS + LIVE TRACKING + ZONES IMPLEMENTATION REPORT

## 1. Initial Architecture Found

Monorepo `all-in-one-delivery-ride-application`:

- `backend/` — Laravel + Sanctum API (`/api/v1`), MySQL (SQLite in tests), Redis/DB cache.
- Four Vite + React + TanStack Query frontends: `admin-web`, `customer-web`, `partner-web`, `vendor-web`.
- Existing verticals: food (Orders), grocery (Orders, `order_type=grocery`), rides (Rides/Drivers).
- Existing integration layer: `App\Services\Integration\IntegrationConfigResolver` + provider manager for payments, wallet, search, notifications, and **maps** (`integrations.provider.maps = google`, credentials `server_key`/`browser_key`).
- Existing maps code: `GoogleMapsProvider` (server Geocoding + Places API New + Directions + Distance Matrix) and `MockMapsProvider`; customer-web already contained `lib/googleMaps.ts`, `components/map/MapPicker.tsx`, `components/order/TrackingMap.tsx`, `components/rides/RideMap.tsx`.
- Existing live tracking: `OrderTrackingService`, `PartnerLocationService`, `config/tracking.php`, private broadcast channels, and Reverb as the realtime provider.

Zones were only a stub: a `zones` table (name/type/center/radius/polygon/json) with no service flags, no polygon engine, no serviceability endpoint and no admin UI.

## 2. Existing Functionality Reused

- `GoogleMapsProvider` (server) and `MockMapsProvider` — reused as the single map provider abstraction; extended the mock to support the new calls.
- `IntegrationConfigResolver::clientSafe()` — reused to expose only the browser key via `/config/maps`.
- `GeocodingService` + `GoogleMapsProvider` — reused for address search/details/reverse.
- Order/ride tracking services, `config/tracking.php`, Reverb realtime provider and `OrderTrackingBroadcaster` — extended, not replaced.
- Dispatch flow (`OrderDispatchService` + `DispatchLog` offers) and ride flow (`RideDispatchService`) — reused; added zone filters.
- customer-web map components and `lib/googleMaps.ts` — reused as-is (no changes needed).
- admin/vendor frontend conventions (repositories, TanStack Query, `ui/*` components) — reused.

## 3. Problems Found

1. `backend/routes/api.php` referenced `ZoneController` without importing `App\Http\Controllers\API\Admin\ZoneController` → `route:list` fatally failed and every `/admin/zones` route would 500. Fixed by adding the import.
2. `ZoneController::index` counted partners/drivers on a non-existent `zone_id` column; `delivery_partners`/`drivers` store the current zone in `current_zone_id`. Fixed by making `countsByZone` column-aware.
3. `DeliveryPartnerController::acceptOrder` assigned `$dispatchLog` inside a `DB::transaction` closure without capturing it → "Undefined variable $dispatchLog" 500 on expired/unavailable offers. Fixed with a pre-declared variable + `use (&$dispatchLog)`.
4. No zone/CRUD/serviceability test coverage existed. Added `AdminZoneTest` (8 tests) which immediately caught problems 1 and 2.
5. Provider-dispatch offer realtime broadcast fired before commit and to a differently-named channel. Wrapped in `DB::afterCommit` and normalised to `private-delivery_partner.{id}`.

## 4. Database Changes

New migrations (all additive, `nullOnDelete`/nullable, no data reset):

| Migration | Table | Columns |
|---|---|---|
| `2026_09_17_071343_add_service_flags_and_config_to_zones_table` | `zones` | `code` (unique), `description`, `country`, `state`, `city`, `food_enabled`, `grocery_enabled`, `ride_enabled`, `priority`, `food_partner_search_radius_km`, `grocery_partner_search_radius_km`, `ride_driver_search_radius_km`, `allow_cross_zone_food_delivery`, `allow_cross_zone_grocery_delivery`, `allow_ride_drop_outside_zone`, `created_by`, `updated_by` |
| `2026_09_17_071344_add_current_zone_id_to_delivery_partners_and_drivers` | `delivery_partners`, `drivers` | `current_zone_id` (FK → zones, nullOnDelete) |
| `2026_09_17_071345_add_zone_snapshots_to_orders_and_rides` | `orders`, `rides` | `pickup_zone_id`, `drop_zone_id` (orders); `pickup_zone_id`, `destination_zone_id` (rides) |
| `2026_09_17_071346_add_zone_id_to_vendors_table` | `vendors` | `zone_id` (FK → zones, nullOnDelete) |
| `2026_09_17_080415_add_driver_location_dynamics_to_drivers_table` | `drivers` | `heading`, `speed`, `accuracy` |

`Zone` casts `polygon` to array (GeoJSON `[longitude, latitude]` order) and exposes `getBoundaryAttribute()`, `serviceEnabled()`, `searchRadiusKm()`.

## 5. Backend Changes

Created:
- `app/Services/Maps/ZoneService.php` — polygon/radius containment, deterministic priority resolution, `resolve`, `isServiceable` (with `NO_ZONE_DEFINED` grace mode), `validatePolygon`, `normalizePolygon`, haversine `distanceKm`.
- `app/Http/Controllers/API/Admin/ZoneController.php` — admin CRUD + `validate` + `toggleStatus`, with live operational counters.
- `app/Http/Controllers/API/ServiceabilityController.php` — public `check` + `services`.
- `app/Services/Tracking/RideTrackingService.php` — server-authoritative ride tracking payload (route/ETA/cache).
- Tests: `tests/Feature/AdminZoneTest.php`, `tests/Feature/Realtime/GroceryGoOnlineDispatchRealtimeTest.php`.

Changed (highlights):
- `routes/api.php` — zones, serviceability, geocode, `/config/maps`, tracking routes; fixed `ZoneController` import.
- `AppConfigController::maps` — adds `serviceability.services` + `zones_enabled`.
- `GeocodeController` — search/details/reverse (validated, public).
- `DeliveryPartnerController` / `DriverController` — location pings persist `current_zone_id`, heading/speed/accuracy, freshness, with `throttle:partner-location`.
- `OrderService::assertOrderServiceable` — resolves/validates pickup + drop zones, snapshots them, honours cross-zone flags, throws when out of area.
- `RideService::assertRideServiceable` — pickup must be ride-serviceable; drop may be outside only if `allow_ride_drop_outside_zone`.
- `DeliveryPartnerEligibilityService` / `DriverEligibilityService` — candidate must match the job's pickup zone.
- `OrderDispatchService` — new `announceOfferRejected`/`announceOfferExpired`; broadcasts after commit.
- `VendorController::syncOutletLocation` — keeps restaurant/store coordinates in sync and resolves `zone_id`.
- `OrderTrackingBroadcaster`, `PartnerLocationService`, `config/tracking.php`, models `Zone/Order/Ride/Vendor/Driver/DeliveryPartner`.

## 6. Admin-Web Changes

- `src/lib/googleMaps.ts` — shared loader.
- `src/components/zones/ZonePolygonEditor.tsx` — custom polygon editor (click to add vertices, editable/draggable polygon, **no deprecated DrawingManager**).
- `src/pages/zones.tsx` — zone grid + tabbed create/edit modal (basics / coverage / boundary).
- `src/App.tsx` — `/zones` route; `src/components/layout/Shell.tsx` — "Service zones" nav.
- `src/pages/integrations.tsx` — Google Maps service panel.
- `src/repositories/admin.ts` — `zonesApi`, `mapsApi`; `src/typings/models.ts` — zone/maps types.

## 7. Customer-Web Changes

No source changes were required — `lib/googleMaps.ts`, `MapPicker`, `TrackingMap` and `RideMap` already existed. The integration is completed by the new backend `/config/maps`, `/geocode/*` and `/serviceability` contracts they consume.

## 8. Partner-Web Changes

- `src/lib/maps.ts` — Google Maps route/pin URL builders for store to customer.
- `components/jobs/ActiveJob.tsx` / `RequestQueue.tsx` — "Route on Maps" links, pickup text.
- `components/live/LocationSync.tsx` — immediate first location sync on go-online.
- `store/jobStore.ts` — persisted-store versioned migration (clears stale sessions).
- `repositories/driver.ts` — `acceptRequest` returns the accepted `Ride`.

## 9. Vendor-Web Changes

- `src/lib/googleMaps.ts` — loader.
- `src/components/location/OutletLocationPicker.tsx` — address autocomplete (`/geocode/search`), drag-marker map preview, reverse geocode, live serviceability zone badge.
- `src/pages/profile.tsx` — replaced the plain lat/lng picker with `OutletLocationPicker`.
- `src/repositories/vendor.ts` — `mapApi` (config/searchPlaces/reverseGeocode/serviceability).
- `src/typings/models.ts` — `zone_id` on profile + maps types.

## 10. Google Maps Integration

- **Client (browser key):** Maps JavaScript API with libraries `maps`, `marker`, `geometry`, loaded once per key via `@googlemaps/js-api-loader` v2; used by admin (zone polygons) and vendor (outlet) editors, plus existing customer/partner widgets.
- **Server (server key, never exposed):** Geocoding API (search/details/reverse), Places API (New), Directions API, Distance Matrix API — all through `GoogleMapsProvider`.
- Route/ETA recalculation is cached and throttled (`route_recalc_interval_seconds`, `route_recalc_min_movement_m`) so marker-only moves never hit Google.
- Google web URLs (`google.com/maps/dir|search`) are used in partner-web links without consuming API quota.

## 11. Zone System

- **Polygon storage:** GeoJSON `[longitude, latitude]` tuples in `zones.polygon` (JSON). Editors submit `{lat,lng}` which is normalised server-side.
- **Serviceability:** `ZoneService::isServiceable` → ray-casting point-in-polygon (radius fallback when no polygon). Reasons: `OUTSIDE_SERVICE_AREA`, `SERVICE_NOT_AVAILABLE_IN_ZONE`, `ZONE_DISABLED`, `INVALID_COORDINATES`, and `NO_ZONE_DEFINED` (bootstrap/grace when no active zone offers the service). Overlaps resolve by `priority DESC, id ASC`.
- **Vendor assignment:** `VendorController::syncOutletLocation` resolves `vendors.zone_id`; stores/restaurants inherit the coordinates; zones outside the area are left `null` for admin/vendor follow-up (no arbitrary assignment).
- **Partner assignment:** location pings store `current_zone_id`; dispatch eligibility requires the candidate's current zone to equal the job's pickup zone (when the job has one).

## 12. Food Flow

Customer address/serviceability → `OrderService::assertOrderServiceable` resolves the vendor pickup zone (or re-resolves from coordinates) and the drop zone, snapshots `pickup_zone_id`/`drop_zone_id`, rejects an out-of-area drop unless `allow_cross_zone_food_delivery`. On dispatch, only food partners whose `current_zone_id` matches the order's `pickup_zone_id` are offered the job. An already-accepted job is never cancelled because a partner later crosses a zone boundary.

## 13. Grocery Flow

Identical to food with `order_type=grocery`, grocery-enabled zones and `allow_cross_zone_grocery_delivery`. Grocery partners are filtered on `service_type=grocery` and their current zone. `GroceryGoOnlineDispatchRealtimeTest` covers go-online → realtime offer.

## 14. Ride Flow

`RideService::assertRideServiceable` requires the pickup to be ride-serviceable; destination may be outside only if the pickup zone sets `allow_ride_drop_outside_zone`. `pickup_zone_id`/`destination_zone_id` are snapshotted. Driver eligibility requires a matching `current_zone_id`. Tracking uses `RideTrackingService`.

## 15. Live Tracking

GPS (partner/driver app) → `POST /driver/location` or `/delivery-partner/location` (throttled, anti-jump, freshness, min-interval, zone resolution) → persisted → `PartnerLocationService` → `OrderTrackingBroadcaster` over the private Reverb channel → React (`TrackingMap`/`RideMap`) using `/orders/{id}/tracking` or `/rides/{id}/tracking` for the authoritative payload (route, polyline, ETA) and WebSocket push for updates.

## 16. Job Assignment Algorithm

Filters (in order): correct service/role and active; not busy and online; coordinates present; **`current_zone_id == job.pickup_zone_id`** (when the job has a zone); location freshness window and max radius (`food_partner_search_radius_km`/`grocery_partner_search_radius_km`/`ride_driver_search_radius_km` or `radius_km`); distance ascending, capped at `max_candidates`. Duplicate acceptance is prevented by the transactional offer claim in `acceptOrder`.

## 17. API Endpoints

New/changed internal (all under `/api/v1`):

- Admin zones: `GET/POST /admin/zones`, `POST /admin/zones/validate`, `GET/PUT/DELETE /admin/zones/{id}`, `POST /admin/zones/{id}/toggle`.
- Public: `GET /config/maps`, `GET /serviceability`, `GET /serviceability/services`.
- Public geocode: `GET /geocode/search`, `GET /geocode/details`, `GET /geocode/reverse`.
- Changed: `POST /delivery-partner/location`, `POST /driver/location`, `GET /orders/{id}/tracking`, `GET /rides/{id}/tracking`, and estimated existing `/rides/route`.

External Google endpoints used (server-side): `maps.googleapis.com/maps/api/geocode/json`, `places.googleapis.com/v1`, `maps.googleapis.com/maps/api/directions/json`, `maps.googleapis.com/maps/api/distancematrix/json`. Client-side: Maps JavaScript API (`maps`, `marker`, `geometry`) and `google.com/maps` links.

## 18. WebSocket Channels/Events

- Channel prefix: `config('tracking.channel_prefix')` = `private-orders`.
- Order tracking: private `private-orders.{orderId}` with the server-built payload.
- Vendor: `private-orders.{orderId}` variant event `VENDOR_ORDER_UPDATED`.
- Partner offers: private `private-delivery_partner.{candidateId}` — `delivery.offer-created`, `delivery.offer-rejected`, `delivery.offer-expired`, `delivery.assignment-confirmed`, `delivery.order-cancelled`.
- Driver location updates are broadcast through the realtime provider; Reverb is the default (`integrations.provider.realtime=reverb`).

## 19. Security

- Server map key is never returned to any browser; `clientSafe()` exposes only `public_key` (browser key) via `/config/maps`.
- Serviceability is always enforced server-side (`OrderService`, `RideService`, dispatch eligibility); the frontend check is advisory UX only.
- Tracking payloads are whitelisted via `OrderTrackingService`/`RideTrackingService` (no phone numbers, bank/KYC, or internal dispatch data); contact/vehicle data is masked.
- Location pings are throttled (`throttle:partner-location`), rate/freshness/jump-limited and validated for coordinate bounds.
- Geocode/serviceability endpoints validate inputs; admin zone routes require the admin role.

## 20. Tests

Commands and results on this workspace:

```
backend:  vendor/bin/phpunit               -> 307 passed, 1262 assertions
backend:  vendor/bin/phpunit tests/Feature/AdminZoneTest.php -> 8 passed, 42 assertions
backend:  vendor/bin/pint <changed files> --format agent -> passed
```

Covered suites include `AdminZoneTest`, `OrderLiveTrackingTest`, `RideBookingTest`, `OrderReadyDispatchTest`, `DispatchRequeueTest`, `GeocodeTest`, `Realtime/GroceryGoOnlineDispatchRealtimeTest`.

## 21. Build Results

```
backend       no build step; migrations applied, routes resolve (php artisan route:list)
admin-web     npm run build -> built successfully (index ~256.6 kB / gzip 61.9 kB)
customer-web  npm run build -> built successfully (index ~298.9 kB / gzip 78.2 kB)
partner-web   npm run build -> built successfully (index ~86.6 kB / gzip 21.4 kB)
vendor-web    npm run build -> built successfully (index ~138.8 kB / gzip 33.6 kB)
```

## 22. Remaining Issues

- `backend/tmp_mock_probe.php` is an untracked leftover with a parse error; it breaks `pint --dirty` (pint on explicit files passes). Should be deleted.
- `backend/.env` currently has `BROADCAST_CONNECTION=reverb` with local Reverb credentials; ensure secrets are never committed and are re-issued for production.
- `backend/phpunit.xml` contains a duplicated `DB_URL` env entry (harmless, worth cleaning).
- `admin-web` `npm run lint` has pre-existing `@typescript-eslint/no-empty-object-type` errors in `ui/card.tsx`, `ui/input.tsx`, `ui/table.tsx`; new files lint clean.
- Automated tests run against the mock maps provider / no external key, so real Google API calls (quota, referrer/IP restrictions) must be validated manually.
- Real-time offer delivery requires a running Reverb server and queue worker; without them the app relies on polling.
- Vendor outlet "outside service area" is surfaced as a live badge; the location is still saved with `zone_id=null` for admin follow-up (by design, per spec).
- No driver mobile app exists in this repo; partner-web is the only GPS producer.

## 23. Manual Configuration Required

Google Cloud APIs to enable: **Maps JavaScript API**, **Geocoding API**, **Places API (New)**, **Directions API**, **Distance Matrix API**.

- Browser key → `GOOGLE_MAPS_BROWSER_KEY` (served to clients via `/config/maps.public_key`). Restrict by **HTTP referrer** to the admin/customer/partner/vendor web origins.
- Server key → `GOOGLE_MAPS_API_KEY` (server-only). Restrict by **IP address** (backend egress); never put it in React.
- `MAPS_PROVIDER=google`, `THIRD_PARTY_MODE=live` (or `test` with test credentials).

Realtime: `BROADCAST_CONNECTION=reverb`, `REVERB_APP_ID`, `REVERB_APP_KEY`, `REVERB_APP_SECRET`, `REVERB_HOST`, `REVERB_PORT`, `REVERB_SCHEME`; run `php artisan reverb:start` (and expose the port in production).

Workers/scheduler: run `php artisan queue:work` (offer dispatch, webhooks) and the scheduler (`php artisan schedule:work` or cron) for expiry/requeue jobs.

Tracking envs: `TRACKING_LOCATION_UPDATES_PER_MINUTE`, `LOCATION_FRESHNESS_SECONDS`, `PARTNER_LOCATION_MIN_INTERVAL_SECONDS`, `TRACKING_MAX_LOCATION_JUMP_KM`, `TRACKING_ROUTE_RECALC_MIN_MOVEMENT_M`, `TRACKING_ROUTE_RECALC_INTERVAL`, `TRACKING_CHANNEL_PREFIX`, `TRACKING_ETA_AVERAGE_SPEED_KMH`.

## 24. How To Test

**Zones (admin-web):** log in as super admin → Service zones → create a zone, draw a polygon by clicking ≥3 points, enable Food, save → confirm it appears with counters and the map renders. Toggle it off/on; invalid/degenerate polygons are rejected.

**Food:** customer app → add an address inside the food zone → place an order → order gets `pickup_zone_id`/`drop_zone_id`; a partner whose `current_zone_id` matches receives the offer; an address outside the zone is rejected unless the zone allows cross-zone food delivery.

**Grocery:** same at a grocery store; verify grocery-enabled zone + grocery partner filter and realtime go-online offer.

**Ride:** request a ride from inside a ride-enabled zone → only same-zone drivers offered; a destination outside is allowed only when `allow_ride_drop_outside_zone` is set.

**Live tracking:** partner/driver goes online (location syncs immediately) → open the customer tracking page → marker moves in near real time; route/ETA come from `/orders/{id}/tracking` / `/rides/{id}/tracking` and are cached between recalculations.

**Vendor:** vendor profile → search an address, drag the pin → serviceability badge shows the assigned zone (or "outside service area" with `zone_id=null`), save → outlet coordinates sync.
