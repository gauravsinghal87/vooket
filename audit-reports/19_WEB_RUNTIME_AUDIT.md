# Web Runtime Audit

Date: 2026-11-02
Environment: `customer-web-optimized` production build, same-origin proxy on `localhost:4310`, production API, Jaipur South coordinates.

## Initial Food load (final build)

| Metric | Value |
|---|---:|
| DOMContentLoaded | 95 ms |
| FCP | 188 ms |
| Local JS decoded | 442,425 B across 19 chunks |
| Local JS transfer | 448,125 B |
| CSS decoded | 111,911 B |
| Image decoded | 87,691 B |
| API requests | 5 |
| API decoded / transfer | 111,466 B / 19,379 B |

The baseline run recorded FCP 236 ms. The final run was faster, but public API latency and browser cache state varied; treat the paint difference as indicative rather than a controlled experiment.

## Module switches

| Transition | Route change | New JS | New API |
|---|---:|---:|---:|
| Food → Grocery first | 1 ms | 66,301 B decoded | 8 calls, 51,672 B decoded |
| Grocery → Food warm | 1 ms | 0 B | 0 calls |
| Food → Rides first | 1 ms | 33,595 B local + 1,076,596 B Google Maps decoded | 3 calls, 1,156 B decoded |
| Rides → Food warm | 1 ms | 0 B | 0 calls |

Route change is pathname change, not content paint. Warm returns render from cache and already-loaded chunks.

## Route smoke test

Production build routes checked with no application error text:

- `/food`
- `/grocery`
- `/rides`
- `/restaurants`
- `/stores`
- `/product/1` (correctly shows “Product not found” for this id)
- `/search`
- `/cart`
- `/auth/login`

## Observations

- Food, Grocery and Rides are isolated lazy chunks.
- Food/Grocery discovery is shared; the destination switch did not refetch it.
- Rides’ map SDK is the dominant first-Rides JS cost.
- Guest cart 401s no longer clear public discovery cache.
- No React Profiler data was collected, so component-level render counts are not claimed.

## Limitations

- One browser session and one public-network run; not a controlled multi-run lab benchmark.
- Browser HTTP cache state affects transfer bytes.
- Production CDN/cache policy differs from the local proxy.
- No production database metrics.
