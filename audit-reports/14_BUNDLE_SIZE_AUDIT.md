# Bundle Size Audit

Date: 2026-11-02

## Web production build (final)

| Asset | Raw | Gzip |
|---|---:|---:|
| `index-*.js` entry | 188.53 kB | 56.44 kB |
| `router-*.js` | 162.88 kB | 53.15 kB |
| `query-*.js` | 42.76 kB | 12.82 kB |
| `food-*.js` | 35.53 kB | 10.75 kB |
| `grocery-*.js` | 20.05 kB | 6.01 kB |
| `rides-*.js` | 19.11 kB | 6.00 kB |
| `RideMap-*.js` | 12.18 kB | 4.46 kB |
| `cart-route-*.js` | 67.25 kB | 16.28 kB |
| `index-*.css` | 111.91 kB | 18.32 kB |
| `all-category-*.png` | 87.69 kB | — |

## Baseline (before this optimization pass)

- Main JS entry: 611.81 kB raw / 153.45 kB gzip.
- Router chunk: 162.88 kB.
- Query chunk: 42.76 kB.
- CSS: 111.87 kB / 18.31 kB gzip.
- `all-category.png`: 1,067.34 kB.
- Main bundle warning: entry >500 kB.

## Result

- Entry JS is 69.2% smaller raw (611.81 → 188.53 kB) and 63.2% smaller gzip (153.45 → 56.44 kB).
- Module code is split into lazy chunks: Food 35.53 kB, Grocery 20.05 kB, Rides 19.11 kB.
- Account/cart/orders code is also lazy (`cart-route` 67.25 kB, `order-detail` 41.39 kB, profile 23.96 kB, etc.).
- The category PNG dropped 91.8% (1,067.34 → 87.69 kB).

## Browser-measured initial Food load

- 19 local JS chunks decoded: 442,425 B.
- CSS decoded: 111,911 B.
- Images decoded: 87,691 B.
- The entry chunk is no longer required to carry every module and account screen.

## Mobile exports

- Expo web export: main web bundle 4.2 MB (Expo/Metro web output; not comparable to the Vite number).
- iOS export: Hermes bytecode bundle 6.38 MB.
- Android export: Hermes bytecode bundle 6.38 MB.
- These are export artifacts, not measured native startup/render costs.

## Remaining size work

- Google Maps SDK is remote and not in the app bundle, but adds about 1.08 MB decoded on first Rides use.
- Fonts contribute about 0.5 MB across the Outfit faces in native exports.
- Static demo JPGs (100–160 kB each) remain in assets; only the oversized displayed category PNG was resized.
- No bundle analyzer was run; the per-chunk build output is the evidence.
