# Regression and Verification

Date: 2026-11-02
Scope: `customer-web-optimized` and `customer-app-optimized`.

## Web

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | Pass |
| ESLint | `npm run lint` | Pass, 0 warnings/errors |
| Production build | `VITE_API_BASE_URL=/api/v1 npm run build` | Pass |
| Route smoke test | Production build through proxy | Pass for Food, Grocery, Rides, restaurants, stores, product-not-found, search, cart, login |

Final build highlights:

- entry JS 188.53 kB raw / 56.44 kB gzip;
- CSS 111.91 kB / 18.32 kB gzip;
- category PNG 87.69 kB;
- no build failure; Vite still warns about the 500 kB chunk threshold for some non-entry chunks, but the entry is below it.

Routes were checked for application error text and unexpected blank screens. `/product/1` correctly renders “Product not found” because that id is not a valid product for the active store.

## Mobile

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | Pass |
| Expo lint | `npx expo lint --no-cache` | Pass |
| Expo Doctor | `npx expo-doctor` | 18/18 passed |
| Web export | `npx expo export --clear --platform web --output-dir dist-web` | Pass |
| iOS export | `npx expo export --clear --platform ios --output-dir dist-ios` | Pass |
| Android export | `npx expo export --clear --platform android --output-dir dist-android` | Pass |

The exports were re-run with a cleared Metro cache after restoring `.env` to the tracked production API URL. The web and native bundles contain the production `vooketapi` value. The native exports produced a 6.38 MB Hermes bundle for each platform. Expo web produced a 4.2 MB web entry and a 87.7 kB resized category asset. These are export sizes, not runtime measurements.

## APK

A preview APK was built earlier through EAS:

- Build: `b62ecd0f-eba2-4ec2-9a47-4d0abb98d4b9`
- Version: `1.0.0` (2)
- Package: `com.superbasket.customer`
- Artifact: `customer-app-optimized/builds/vooket-customer-v1.0.0-build2.apk`
- SHA-256: `f186024d7b0f06ea31f065ab0b2221f372fc035646bfd10a93d92ede19b4c01f`
- Embedded API base URL verified as `https://vooketapi.expertshub.in/api/v1`.

That APK predates the latest shared-discovery/cache edits. A new EAS build is required to ship the current mobile performance changes.

## Original apps and backend

- `customer-web`, `customer-app` and `backend` were treated as read-only.
- No backend route, controller, model, migration or database change was made.
- No original app source was modified for this optimization pass.

## Remaining verification gaps

- No mobile device runtime profile.
- No production DB query log/EXPLAIN.
- No multi-run controlled web benchmark.
- No React Profiler render counts.
