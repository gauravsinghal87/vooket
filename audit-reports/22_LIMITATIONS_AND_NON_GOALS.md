# Limitations and Non-Goals

Date: 2026-11-02

## Deliberately not changed

- Laravel backend code, routes, controllers, models, serializers, migrations and database.
- Production data or image URLs.
- Original `customer-web` and `customer-app`.
- UI layout, routes, navigation contracts and business logic.
- Auth, cart, location, orders and payments behavior.
- Environment files.

## Backend limitations

- Backend changes require separate authorization, so the monolithic `/discovery/home`, missing field selection, unbounded rails and eager-loading patterns remain.
- Production query counts/EXPLAIN plans and slow-query logs were not available.
- Local Laravel profiling uses a small dataset (8 restaurants, 7 stores, 123 products, 72 categories), so timings are not production-scale.
- Local backend images use `http://localhost:8000/storage/...` URLs; that is a data/config issue and was not fixed.

## Web limitations

- Runtime numbers come from one browser session through a local proxy, not a controlled multi-run lab.
- Browser HTTP cache state affects transfer bytes; decoded sizes are more stable.
- Google Maps SDK transfer was cached during the final Rides measurement; decoded size is reported.
- No React Profiler render counts or component-level flame graphs.
- The Vite build still emits a >500 kB chunk warning for some lazy chunks; the entry is under the threshold.

## Mobile limitations

- No Android emulator/device, iOS simulator or Android SDK locally.
- No mobile cold-start, JS-thread, frame-timing or memory measurements.
- The APK artifact predates the latest performance edits.
- Food/Grocery homes remain `ScrollView`-based; converting them to virtualized lists would be a UI-level refactor.
- Product images are not uniformly migrated to `expo-image`.

## Non-goals

- Faking performance by hiding loading indicators or removing features.
- Caching user-specific data across accounts.
- Changing API contracts to fit the frontend.
- Rebuilding the APK unless separately requested.
