# API Performance Audit (Food / Grocery / Rides)

Date: 2026-11-02
Scope: customer-web-optimized, customer-app-optimized, backend (read-only). Production API https://vooketapi.expertshub.in/api/v1. Local backend profiled via `php artisan` + kernel dispatch.

## Measured endpoints (live, jaipur coords)

| Endpoint | HTTP | total | ttfb | size (bytes) | notes |
|---|---|---|---|---|---|
| /discovery/home?lat=28.6139,lng=77.209 (Delhi, out of zone) | 200 | 0.545s | 0.456s | 21460 | meta.serviceability is_serviceable=false for both; food.products[] has 10 items (food deals/products), grocery empty. |
| /discovery/home?lat=26.9124,lng=75.7873 (Jaipur Central) | 200 | 0.724s | 0.580s | 31211 | food serviceable true (zone Jaipur Central), grocery false. food.recommended/popular/top/fast/offers=1 each, food.products=10. |
| /discovery/home?lat=26.8500,lng=75.8000 (Jaipur South) | 200 | 1.278s | 0.853s | 86193 | food+grocery serviceable (Jaipur South). food rails have 5 each, grocery.stores=3, grocery.categories=8, food.products=10. |
| /discovery/home?lat=26.9500,lng=75.7500 (Jaipur North) | 200 | 0.714s | 0.539s | 55960 | food+grocery serviceable. food rails 2, grocery.stores=2, grocery.categories=8. |
| /food/restaurants?lat=26.9124,lng=75.7873&page=1 | 200 | 0.524s | - | 2491 | paginated; returns data[] |
| /grocery/stores?lat=26.9124,lng=75.7873 | 200 | 0.434s | - | 887 | paginated empty or minimal |
| /grocery/products?lat=26.9124,lng=75.7873&page=1 | 200 | 0.594s | - | 895 | paginated |
| /food/categories | 200 | 0.577s | - | 14461 | larger catalog |
| /grocery/categories?lat=26.9124,lng=75.7873 | 200 | 0.318s | - | 267 | smaller when zone-constrained |
| /rides/promos | 200 | 0.286s | - | 49 | small |
| /vehicle-types | 200 | 0.242s | - | 1228 | small |
| /app-config | 200 | 0.298s | - | 1144 | small |

## Local backend profiling (kernel dispatch, lat 26.85,75.80)

| Route | Status | time_ms | bytes | queries | sql_ms | Notes |
|---|---|---|---|---|---|---|
| /api/v1/discovery/home | 200 | 168.6 | 86204 | 28 | 20.2 | Top queries: cache lookups/inserts, stores/restaurants with avg_rating subquery, products deals/recommended with exists subqueries, coupons. |
| /api/v1/food/restaurants | 200 | 27.6 | 8864 | 12 | 6.4 | Zones lookup, count for pagination (Haversine), restaurants query with avg_rating, vendor loads. |
| /api/v1/grocery/stores | 200 | 19.2 | 5358 | 9 | 4.1 | Zones, count with Haversine exists/where, stores with avg_rating, vendor loads (some N+1-like). |
| /api/v1/grocery/products | 200 | 42.5 | 25633 | 10 | 6.8 | Products query with zone/constrain, brands eager load via in(), variation_option_values eager loads (multiple variation_option_id sets). |
| /api/v1/food/categories | 200 | 19.1 | 14461 | 2 | 1.4 | Parents + children in separate queries (eager load pattern). |
| /api/v1/grocery/categories | 200 | 29.2 | 20534 | 5 | 2.2 | Cache lookups + zones + categories. |

## Findings (root cause analysis)

### API-level bottlenecks
1. **Discovery/home is monolithic**: returns food rails (recommended/popular/top/fast/offers/recently_ordered), food.products, food.deals, grocery rails, grocery.deals/recommended/stores/categories/monthly_essentials/buy_again/recently_viewed, banners merged, global categories (limit 20), coupons as offers. For serviceable zones (Jaipur South) payload ~86KB and ~700ms network time on live API; backend takes ~170ms with 28 queries (mostly cache/zone/serviceability + eager loads). The web food page calls `getHome()` AND separately calls `getRestaurants()` (paginated infinite query) and `getCategories()` and banners. The mobile food home also calls `getHome()` plus `getRestaurants()` plus categories plus banners. This creates **duplicate/overlapping data fetches** and large initial payload.
2. **N+1 / relation eager loading**: grocery.products loads brands via `whereIn` on collected IDs (good), but loads `variationOptionValues` per variation_option_id in separate queries (seen multiple queries for same pattern). Restaurants/stores load vendors separately. Food categories load children separately. Reviews average is computed via subquery per row (ok). Not catastrophic but adds queries.
3. **Zone/serviceability resolution**: runs per request (zones lookup, distance calculations) - necessary for correctness. Multiple zone lookups observed (caching used). 
4. **Large category payloads**: `/food/categories` returns 14KB (with children), `/grocery/categories` similar. These are cached-like but still large.
5. **Duplicate discovery calls on module switch**: when switching Food<->Grocery on web, both pages may trigger queries; TanStack Query caches by key but keys differ (`['food-home', lat,lng]` vs `['grocery-home', coordsKey]`). Also web QueryClient has `staleTime: 60s` globally, grocery page sets `staleTime: 300000` for home - better. But food page has no explicit staleTime (uses global 60s). Mobile QueryClient has `staleTime: 30s` global.

### Frontend request patterns (web)
- Food page: `foodService.getHome()` + `foodService.getCategories()` + `repositories.banners.getByPlacement('food','food_home_hero')` + infinite `foodService.getRestaurants()` (page 1). 4-5 parallel requests on mount.
- Grocery page: `groceryService.getHome()` (staleTime 5min) + 3 banner placements + `useActiveGroceryStore()` fetches stores (staleTime 5min) + `useGroceryCategories()` fetches categories + `useStoreCatalogue()` fetches products. Many parallel calls; some overlap with discovery/home data.
- Rides page: `repositories.user.getAppConfig()` (staleTime 5min), `ridesService.getPromos()`, banner placement, `ridesService.getSavedPlaces()`. When coords ready, route/estimate/nearby-drivers.

### Frontend request patterns (mobile)
- Food home: similar to web - home + categories + banners + infinite restaurants.
- Grocery home: home + hero/brand/festive banners + uses hooks (active store, categories, catalogue). Some caching.
- Rides: promos, banners, saved-places, route/estimate/nearby-drivers.

## Duplicate/redundant requests observed
- On web food load with proxy to backend: discovery/home called, also categories called separately (categories also included in discovery/home response as `categories: Category[]` limited to 20). Food page fetches categories via `foodService.getCategories()` separately - **potential duplication** (discovery/home returns `categories` array; food/categories is different endpoint returning full tree).
- Grocery page uses discovery/home for some data but also fetches stores via hook and categories via hook and products via catalogue - some overlap.
- On module switch Food->Grocery (web): new requests fired (grocery stores, discovery/home again with same coords, banners, categories, cart). discovery/home may be refetched if staleTime expired or key different; with same coords and short staleTime it may refetch.

## Recommendations (safe, backend-compatible)
- **Frontend caching**: Increase staleTime/gcTime for reasonably static data (categories, banners, vehicle-types, app-config). Food home could use longer staleTime if data not user-specific; but discovery/home for food contains user-specific sections when logged in (recently_ordered, buy_again) - must not cache user-specific data globally/shared across users. Current keys include coords but not user; better to include user id or use shorter staleTime for authenticated users. Or split endpoints.
- **Request deduplication**: TanStack Query already dedupes; ensure query keys are stable.
- **Lazy load module routes** (web): split bundles to reduce initial JS - biggest win for first load.
- **Prefetch on navigation intent**: prefetch likely module data on hover/focus of module switcher.
- **Avoid refetch storms**: set `refetchOnMount` appropriately, use `staleTime`.
- **Image lazy loading**: already using `loading="lazy"` in web Image component; ensure all images use it.
- **Backend (if authorized later)**: discovery/home could be split into module-specific endpoints or support field selection; add indexes on frequently filtered columns (restaurants/stores lat/lng + is_open + zone filters), optimize eager loading to avoid duplicate queries, paginate large relations. Do NOT change contracts now.

## Post-optimization verification (frontend)

The measurements and findings above are the **baseline**. The frontend fixes below were implemented without changing the Laravel API contract.

### Shared discovery

- Web: `src/shared/services/discovery.ts` + `src/shared/hooks/useDiscoveryHome.ts`.
- Mobile: `src/shared/repositories/discovery.ts` + `src/shared/hooks/useDiscoveryHome.ts`.
- Both module homes now read one `['discovery-home', coordsKey]` cache entry. The envelope is fetched once per coordinate key, then mapped into Food and Grocery shapes.
- Cache policy: 5-minute `staleTime`, 30-minute `gcTime`, no refetch on window focus.
- Cache clearing: login/register/logout and authenticated 401 clear the QueryClient. A guest 401 does **not** clear public discovery.

### Measured web effect

| Scenario | Before | After |
|---|---|---|
| Food→Grocery switch | `/discovery/home` could be requested again with a different key | 0 discovery requests in measured warm transition |
| Grocery→Food warm return | Page queries remounted; request behavior depended on stale time | 0 API calls, 0 JS |
| Rides→Food warm return | Same | 0 API calls, 0 JS |
| Initial Food local JS | Entry bundle included module code | 442,425 B decoded across 19 chunks; entry 188.53 kB raw / 56.44 kB gzip |

First Grocery switch measured 8 API calls and 51,672 B decoded. Those calls are grocery stores/categories/banners/catalogue plus guest cart attempts; the discovery envelope is not among them. The delayed catalogue request starts after the active store resolves.

### Remaining backend work (not applied)

- `/discovery/home` is still a monolithic 86 kB envelope at Jaipur South with 28 local queries and 20.2 ms SQL time. Frontend sharing removes duplicate transfers between modules but does not reduce the first payload.
- Proposed (requires separate backend authorization):
  - module-scoped discovery endpoints or `?include=food|grocery` field selection;
  - pagination for restaurant/store rails and product lists;
  - summary/detail split for restaurant/store cards;
  - review of variation-option eager loads and repeated vendor/category loads;
  - image metadata trimming in serializers.
- No backend files, migrations, or production data were changed.

