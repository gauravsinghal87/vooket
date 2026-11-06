# Module Switching Benchmark (Web)

Date: 2026-11-02
Scope: `customer-web-optimized` only for runtime numbers; mobile has no local runtime device.

## Method

- Built the optimized web app with `VITE_API_BASE_URL=/api/v1 npm run build`.
- Served `dist` through a temporary same-origin Node proxy on `localhost:4310`; `/api/v1/*` was forwarded to production `https://vooketapi.expertshub.in/api/v1`.
- Set Jaipur South coordinates `26.85,75.80` in the persisted app store.
- Clicked the bottom module switcher inside the running SPA, then read:
  - time until `location.pathname` changed;
  - new `PerformanceResourceTiming` entries after the click;
  - TanStack Query cache keys/state (diagnostic build only; removed from final bundle).
- Values are measured in one browser session with browser HTTP cache warm after the first load. Transfer size therefore depends on cache state; decoded size is the stable payload measure.

## Final bundle split

| Chunk | Raw | Gzip |
|---|---:|---:|
| `index-*.js` entry | 188.53 kB | 56.44 kB |
| `router-*.js` | 162.88 kB | 53.15 kB |
| `query-*.js` | 42.76 kB | 12.82 kB |
| `food-*.js` | 35.53 kB | 10.75 kB |
| `grocery-*.js` | 20.05 kB | 6.01 kB |
| `rides-*.js` | 19.11 kB | 6.00 kB |
| `cart-route-*.js` | 67.25 kB | 16.28 kB |
| `all-category-*.png` | 87.69 kB | — |

Pre-fix main entry was `611.81 kB` raw / `153.45 kB` gzip, plus `162.88 kB` router and `42.76 kB` query chunks. Food, Grocery, Rides and account/cart screens are no longer in the entry.

## Measured transitions

### Food first load (fresh document)

| Metric | Value |
|---|---:|
| DOMContentLoaded | 95 ms |
| FCP | 188 ms |
| Local JS decoded | 442,425 B (19 chunks) |
| Local JS transfer | 448,125 B |
| API calls | 5 |
| API decoded / transfer | 111,466 B / 19,379 B |

### Food → Grocery (first switch after Food load)

| Metric | Value |
|---|---:|
| Route change | 1 ms |
| Grocery local JS | 66,301 B decoded, 17 chunks (71,401 B transfer) |
| API calls | 8 |
| API decoded / transfer | 51,672 B / 13,031 B |
| `/discovery/home` repeated | **No** |

The 8 API calls include two guest `/cart?type=grocery` 401 attempts and the delayed `/grocery/stores/1/products` request. The shared discovery envelope was served from the Food load's cache.

### Grocery → Food (warm return)

| Metric | Value |
|---|---:|
| Route change | 1 ms |
| New JS | 0 B |
| New API | 0 calls, 0 B |

All Food queries (discovery, categories, hero banners, restaurant page 1) were still inside `staleTime`, so React Query rendered from cache.

### Food → Rides (first switch)

| Metric | Value |
|---|---:|
| Route change | 1 ms |
| Rides local JS | 33,595 B decoded, 8 chunks (35,995 B transfer) |
| Google Maps SDK | 1,076,596 B decoded, 9 scripts (0 B transfer in cached run) |
| API calls | 3 |
| API decoded / transfer | 1,156 B / 1,414 B |

Rides API calls were `/rides/promos`, `/banners?service=rides&placement=rides_promotions` and `/saved-places`; the slowest completed at about 1.04 s. The Google Maps SDK is the dominant first-Rides cost and is still remote-script heavy.

### Rides → Food (warm return)

| Metric | Value |
|---|---:|
| Route change | 1 ms |
| New JS | 0 B |
| New API | 0 calls, 0 B |

## Before / after summary

| Observation | Before | After |
|---|---|---|
| Food ↔ Grocery discovery request on switch | Both homes used separate query keys; a switch could re-download `/discovery/home` (~86 kB decoded at Jaipur South) | One shared `['discovery-home', coordsKey]` entry; measured Grocery switch made **0** discovery requests |
| Warm return to a module | Module pages remounted their own queries; cache keys/stale policy varied | Measured Grocery→Food and Rides→Food returns made **0** network requests |
| Initial JS entry | 611.81 kB raw / 153.45 kB gzip | 188.53 kB raw / 56.44 kB gzip; modules/features are lazy chunks |
| Category artwork | 1,067.34 kB PNG (2500x2500) | 87.69 kB PNG (256x256) |
| Module chunk delivery | No module chunks | Food 35.53 kB, Grocery 20.05 kB, Rides 19.11 kB; prefetched on dock hover/focus |
| Cache clearing on guest 401 | Not present | Authenticated-session-only clearing; guest cart 401 does not wipe public discovery |

## Important cache fix found during measurement

The first implementation cleared the entire QueryClient on every `auth:unauthorized` event. A guest `/cart?type=grocery` 401 therefore wiped the discovery cache immediately after the Food→Grocery measurement, and returning to Food re-downloaded every Food query.

The final implementation checks `isAuthenticated` before clearing. A guest 401 leaves public discovery/categories/banners cached. A 401 that ends an authenticated session still clears all cached data, preventing `recently_ordered`/`buy_again` from leaking between accounts. Both web and mobile use this condition.

## Caveats

- Route-change time is pathname change, not first content paint. The API requests dominate visible content.
- Google Maps SDK transfer was 0 B because it was already in the browser cache during the final run; decoded size (1.08 MB) is the meaningful measure.
- Network latency varies. The live API calls in this run were slower (about 2 s) than the earlier baseline (about 0.85 s TTFB), so compare payload/request counts rather than absolute API milliseconds.
- Mobile module-switch timing is not reported because no Android/iOS runtime device is available locally. The APK was built through EAS; see `docs/refactor/VERIFICATION_AND_REGRESSION.md`.
