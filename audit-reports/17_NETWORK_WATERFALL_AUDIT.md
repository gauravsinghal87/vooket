# Network Waterfall Audit

Date: 2026-11-02
Environment: production web build served through same-origin proxy to production API; Jaipur South coordinates.

## Initial Food load

All five calls start within a few milliseconds and run in parallel:

| Start (ms) | Request | Decoded | Duration |
|---:|---|---:|---:|
| 118 | `/app-config` | 1,144 B | 2,135 ms |
| 265 | `/discovery/home` | 86,163 B | 2,178 ms |
| 265 | `/food/categories` | 14,461 B | 1,994 ms |
| 266 | `/banners?service=food&placement=food_home_hero` | 775 B | 1,993 ms |
| 266 | `/food/restaurants?page=1` | 8,923 B | 2,000 ms |

The discovery call is the largest payload. API latency in this run (~2 s) was higher than the earlier baseline (~0.85 s TTFB); request count and payload sizes are the comparable metrics.

## Food → Grocery first switch

| Start (ms) | Request | Decoded | Duration |
|---:|---|---:|---:|
| 158 | `/grocery/stores?per_page=50` | 5,417 B | 1,354 ms |
| 165 | `/cart?type=grocery` (guest 401) | 30 B | 1,327 ms |
| 166 | Grocery hero banner | 560 B | 1,328 ms |
| 167 | Grocery brand banner | 66 B | 1,331 ms |
| 167 | Grocery festive banner | 2,105 B | 1,334 ms |
| 168 | `/grocery/categories` | 20,533 B | 1,348 ms |
| 1,522 | `/grocery/stores/1/products?per_page=60` | 22,931 B | 255 ms |
| 2,499 | `/cart?type=grocery` again (guest 401) | 30 B | 381 ms |

No `/discovery/home` request. The catalogue request waits for the active store, so it is not in the first parallel batch. Two guest cart requests are pre-existing; they are tiny but should eventually be deduplicated or skipped for guests.

## Food → Rides first switch

| Start (ms) | Request | Decoded | Duration |
|---:|---|---:|---:|
| 88 | `/rides/promos` | 49 B | 1,041 ms |
| 88 | Rides banner placement | 1,077 B | 1,042 ms |
| 89 | `/saved-places` | 30 B | 1,041 ms |

Google Maps SDK scripts start around 97 ms after the switch and total 1,076,596 B decoded across 9 scripts in this run. They are independent of the API calls.

## Warm returns

- Grocery → Food: 0 API, 0 JS.
- Rides → Food: 0 API, 0 JS.

The return was served from TanStack Query cache and already-loaded route chunks.

## Observations

- First-load API latency dominates visible content, not route change.
- The discovery call is the only request that was duplicated across modules in the baseline; it is now shared.
- Grocery’s catalogue is a second-wave request, so Grocery content appears in two phases.
- Rides’ map SDK is the largest first-Rides network cost, far larger than its three API calls.
