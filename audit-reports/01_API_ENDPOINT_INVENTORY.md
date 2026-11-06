# API Endpoint Inventory

Date: 2026-11-02
Base URL: `https://vooketapi.expertshub.in/api/v1` (production); local Laravel used only for read-only profiling.

All listed routes are `GET` unless marked otherwise. “Measured” means a live or local timing/payload was captured; “observed” means the call was seen in the frontend request waterfall but not independently profiled.

## Food

| Endpoint | Used by | Measured | Notes |
|---|---|---|---|
| `/discovery/home?latitude&longitude` | Web + mobile Food and Grocery home | Yes | Shared envelope; see payload report. |
| `/food/categories` | Food home | Yes | Full category tree, 14,461 B live. |
| `/food/restaurants?page=1&latitude&longitude` | Food home / restaurant list | Yes | Paginated; 8,923 B page 1 in final run. |
| `/restaurants/{id}` / menu routes | Restaurant detail | Observed | Not central to module-switch benchmark. |
| `/banners?service=food&placement=food_home_hero` | Food home hero | Yes | 775 B live. |
| `/app-config` | App shell, Rides map config | Yes | 1,144 B live. |
| `/cart?type=food` | Cart feature | Observed | Guest requests can return 401/500 depending on auth middleware. |

## Grocery

| Endpoint | Used by | Measured | Notes |
|---|---|---|---|
| `/discovery/home?latitude&longitude` | Shared Food/Grocery home | Yes | Grocery slice is read from the same envelope. |
| `/grocery/stores?latitude&longitude&per_page=50` | Grocery home active store | Yes | 5,417 B live. |
| `/grocery/categories?latitude&longitude` | Grocery category navigation | Yes | 20,533 B live at Jaipur South. |
| `/grocery/stores/{id}/products?latitude&longitude&per_page=60` | Grocery catalogue | Yes | 22,931 B live; starts after active store resolves. |
| `/grocery/products?latitude&longitude&page=1` | Alternate product list | Yes (baseline) | Paginated; 25,633 B local. |
| `/banners?service=grocery&placement=grocery_home_hero` | Grocery hero | Yes | 560 B. |
| `/banners?service=grocery&placement=grocery_home_brand_promo` | Grocery brand rail | Yes | 66 B. |
| `/banners?service=grocery&placement=grocery_home_festive_promo` | Grocery festive grid | Yes | 2,105 B. |
| `/cart?type=grocery` | Grocery cart state | Yes | Guest request returned 401 in browser run; no longer clears public cache. |

## Rides

| Endpoint | Used by | Measured | Notes |
|---|---|---|---|
| `/rides/promos` | Rides home | Yes | 49 B. |
| `/banners?service=rides&placement=rides_promotions` | Rides promo mosaic | Yes | 1,077 B. |
| `/saved-places` | Rides home / destination | Yes | 30 B empty guest response. |
| `/vehicle-types` | Rides booking | Yes (baseline) | 1,228 B. |
| `/rides/estimate`, `/rides/route`, nearby-driver routes | Rides booking flow | Observed | Depends on pickup/drop; not measured in module-switch run. |
| `/app-config` | Google Maps availability/key | Yes | Shared with app shell. |

## Cross-cutting observations

- `/discovery/home` is the only endpoint that returns both Food and Grocery content; it is the largest and most duplicated response.
- `/app-config` is loaded once by the shell and reused by Rides; it should stay long-lived.
- Multiple banner placements are separate endpoints. They are small, but each adds a request; a batched placement endpoint would reduce request count if the backend contract can change.
- The production API does not expose a summary/detail split for restaurant and store cards; the frontend receives card data and detail data through separate existing routes.
