# Frontend Render Audit (Web + Mobile)

Date: 2026-11-02
Scope: `customer-web-optimized` and `customer-app-optimized` only.

## Method

- Production build: `VITE_API_BASE_URL=/api/v1 npm run build`.
- Served `customer-web-optimized/dist` through a temporary same-origin Node proxy on port `4310`; `/api/v1/*` was forwarded to `https://vooketapi.expertshub.in/api/v1`.
- Browser used Jaipur South coordinates `26.85,75.80` (Food and Grocery serviceable).
- Values below are browser `PerformanceResourceTiming`/paint measurements, not estimates.
- Route-change time is the time until `location.pathname` changes after clicking the module switcher. It is not a content-paint timestamp.

## Final web build output

| Asset | Raw | Gzip |
|---|---:|---:|
| `index-*.js` (entry) | 188.53 kB | 56.44 kB |
| `router-*.js` | 162.88 kB | 53.15 kB |
| `query-*.js` | 42.76 kB | 12.82 kB |
| `food-*.js` (lazy) | 35.53 kB | 10.75 kB |
| `grocery-*.js` (lazy) | 20.05 kB | 6.01 kB |
| `rides-*.js` (lazy) | 19.11 kB | 6.00 kB |
| `RideMap-*.js` (lazy, Rides only) | 12.18 kB | 4.46 kB |
| `cart-route-*.js` (lazy) | 67.25 kB | 16.28 kB |
| `index-*.css` | 111.91 kB | 18.32 kB |
| `all-category-*.png` | 87.69 kB | (binary) |

The previous unsplit build used `611.81 kB` (gzip `153.45 kB`) for the main JS entry, plus `162.88 kB` router and `42.76 kB` query chunks. The lazy route split removes Food/Grocery/Rides and account/cart code from the first entry.

`all-category.png` was 1,067.34 kB at 2500x2500 and is displayed at roughly 70–100 CSS px. It is now a 256x256 PNG (87.69 kB in the build), a 91.8% size reduction with no layout change.

## Measured initial Food load

| Metric | Value |
|---|---:|
| DOMContentLoaded | 95 ms |
| FCP | 188 ms |
| Local JS decoded (19 chunks) | 442,425 bytes |
| Local JS transfer | 448,125 bytes |
| CSS decoded | 111,911 bytes |
| Image decoded (16 images) | 87,691 bytes |
| API requests | 5 |
| API decoded | 111,466 bytes |
| API transfer | 19,379 bytes |

API calls on first Food load:

1. `/app-config` — 1,144 B decoded, 2,135 ms
2. `/discovery/home?latitude=26.85&longitude=75.8` — 86,163 B, 2,178 ms
3. `/food/categories` — 14,461 B, 1,994 ms
4. `/banners?service=food&placement=food_home_hero` — 775 B, 1,993 ms
5. `/food/restaurants?page=1&latitude=26.85&longitude=75.8` — 8,923 B, 2,000 ms

The API durations were measured during a slow public-network run; payload sizes and request counts are stable. The previous discovery call is now shared by Food and Grocery.

## Module switch measurements

| Transition | Route change | New local JS | New API | Discovery refetched? |
|---|---:|---:|---:|---|
| Food → Grocery (first) | 1 ms | 66,301 B decoded / 71,401 B transfer, 17 chunks | 8 calls, 51,672 B decoded / 13,031 B transfer | No |
| Grocery → Food (warm) | 1 ms | 0 B | 0 calls | No |
| Food → Rides (first) | 1 ms | 33,595 B decoded / 35,995 B transfer, 8 chunks | 3 calls, 1,156 B decoded / 1,414 B transfer | No |
| Rides → Food (warm) | 1 ms | 0 B | 0 calls | No |

Rides additionally loads the Google Maps JS SDK on first use: 9 scripts, 1,076,596 B decoded in this run (browser-cache transfer was 0 B). The SDK is still remote-script heavy and should remain lazy/module-scoped; it is not required by Food or Grocery.

First Grocery switch previously triggered another `/discovery/home` request (about 86 kB decoded) in the pre-fix baseline. After the shared discovery cache, the measured switch made no discovery request. The Grocery switch still performs store/category/banner/catalogue requests; the catalogue request starts after the active store resolves, so it completes later than the first parallel batch.

The two `/cart?type=grocery` entries in that run are guest requests returning 401. They no longer clear the public discovery cache; cache clearing on 401 now runs only for an authenticated session.

## Render observations

- All web module and feature screens are lazy-loaded through `React.lazy` + `Suspense`. The shell (header, bottom dock, providers) stays mounted during a chunk download and `PageFallback` reserves page height.
- The module switcher prefetches the destination module chunk on pointer-enter/focus. In the measured warm transitions the destination chunk was already present and no JS was downloaded.
- Discovery uses one cache entry per coordinate key: `staleTime` 5 minutes, `gcTime` 30 minutes, `refetchOnWindowFocus: false`. Food and Grocery map the same envelope into their own shapes instead of issuing two requests.
- Public category/banner/app-config queries use 5–10 minute stale times. Rides promos/banners use 5 minutes; saved places use 1 minute.
- Images use native `loading="lazy"` by default and `decoding="async"` for non-eager images. Category artwork remains eager where it is part of the first viewport.
- No React render profiler data is available from this browser session. `Performance` paint/resource timings are reported above; component-level render counts were not instrumented, so they are not claimed.

## Mobile

No Android emulator/device or Android SDK is available locally. Mobile runtime/startup/render measurements are therefore **not available** and are not estimated.

Implemented, verified by TypeScript/lint/export builds:

- One shared `useDiscoveryHome` query for Food/Grocery, 5-minute stale time, 30-minute GC, no window-focus refetch.
- Shared QueryClient in `src/shared/query/queryClient.ts`, cleared on login/logout/register and authenticated 401.
- `rides-destination.tsx` FlatList now uses stable keys, `initialNumToRender={8}`, `maxToRenderPerBatch={10}`, `windowSize={7}` and `removeClippedSubviews`.
- Food/Grocery homes still use `ScrollView` with mapped content. Converting these complex sticky-header pages to a virtualized list is a larger UI change and was deliberately not attempted; this remains a documented risk for very long home feeds.
- `assets/images/all-category.png` resized from 1.07 MB to 86 kB (256x256).
- Product images use the existing `ProductImage` wrapper over React Native `Image`; some grocery components use `expo-image`. A full product-image migration was not performed because it changes fallback/caching behavior across every card.

## Limitations

- No production database query count/duration access; local Laravel profiling was used in `API_PERFORMANCE_AUDIT.md`.
- No mobile runtime profile (cold start, JS thread, frame timing) without a device/emulator.
- The proxy measurement preserves same-origin behavior but does not reproduce the production CDN/cache policy exactly.
