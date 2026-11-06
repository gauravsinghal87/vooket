# Performance Fixes Applied

Date: 2026-11-02
Scope: `customer-web-optimized` and `customer-app-optimized` only. Original apps and `backend` were not modified.

## Web

### API request reduction

- Added `src/shared/services/discovery.ts` with one raw `/discovery/home` read and Food/Grocery mappers.
- Added `src/shared/hooks/useDiscoveryHome.ts`. Both module homes use one React Query key, `['discovery-home', coordsKey]`, instead of separate `food-home`/`grocery-home` keys.
- `ApiFoodRepository.getHome` and `ApiGroceryRepository.getHome` delegate to the shared mapping helpers, so the same envelope is not parsed twice.
- Mock mode is preserved: the hook uses the existing mock Food/Grocery repositories when `IS_MOCK` is true.

Measured effect: first Food→Grocery switch made **no** `/discovery/home` request; returning to Food made **0** API and **0** JS requests inside the 5-minute stale window.

### Cache policy

- Discovery: `staleTime` 5 min, `gcTime` 30 min, `refetchOnWindowFocus: false`.
- Food categories / grocery categories: 10 min stale, 30 min GC.
- Hero/brand/festive banners, food hero banners, rides promos/banners: 5 min stale, 30 min GC.
- Grocery stores/catalogue: 5 min stale, 30 min GC.
- Rides saved places: 1 min stale, 10 min GC.

### Cache safety

- `QueryClient` moved to `src/shared/query/queryClient.ts`; `resetQueryCache()` clears it.
- Cleared on email/phone/OTP/Google login, registration, logout, initialize failure and authenticated 401.
- A guest cart request can legitimately return 401. The unauthorized listener now clears only when `isAuthenticated` is true, so a guest 401 cannot wipe public discovery/categories/banners.
- This prevents authenticated user-specific discovery rails (`recently_ordered`, `buy_again`, `monthly_essentials`) from surviving a logout or session expiry.

### Bundle and route loading

- All Food/Grocery/Rides and auth/cart/checkout/orders/profile/search/wallet/payments/support routes use `React.lazy` + `Suspense`.
- Added `src/shared/components/ui/page-fallback.tsx`; the fallback renders inside `AppShell` so the header/dock and layout do not disappear.
- Added `src/app/routes/prefetch.ts`; the module switcher accepts `onModuleIntent` and prefetches the destination chunk on pointer-enter/focus.
- Entry JS changed from `611.81 kB` raw / `153.45 kB` gzip to `188.53 kB` raw / `56.44 kB` gzip. Food/Grocery/Rides are 35.53/20.05/19.11 kB lazy chunks.
- Measured initial Food load: 442,425 B decoded local JS across 19 chunks, FCP 188 ms, DOMContentLoaded 95 ms.

### Images

- Web `Image` now adds `decoding="async"` for non-eager images while keeping lazy loading defaults.
- `src/assets/all-category.png` resized from 1,067.34 kB (2500x2500) to a 256x256 PNG (87.69 kB in the production build). The displayed size is about 70–100 CSS px, so the visual geometry is unchanged.
- Measured initial Food image payload: 87,691 B across 16 images.

## Mobile

### API/cache

- Added `src/shared/repositories/discovery.ts` and `src/shared/hooks/useDiscoveryHome.ts`.
- Food and Grocery homes share one `/discovery/home` cache entry and map only their own slice. Mock/API repository behavior is retained through the existing repositories.
- Moved `QueryClient` to `src/shared/query/queryClient.ts`; auth login/logout/register and authenticated `onUnauthorized` clear it.
- Guest `onUnauthorized` no longer clears public discovery data.
- Food categories/hero banners and Grocery hero/brand/festive banners use 5–10 minute stale times with 30-minute GC.

### Lists and assets

- `src/modules/rides/pages/rides-destination.tsx` FlatList:
  - stable key extractor (`id || place_id || main || index`) instead of `Math.random()`;
  - `initialNumToRender={8}`;
  - `maxToRenderPerBatch={10}`;
  - `windowSize={7}`;
  - `removeClippedSubviews`.
- `assets/images/all-category.png` resized from 1.07 MB to 86 kB (256x256).

## Measured impact (web)

| Metric | Before | After |
|---|---:|---:|
| Entry JS raw / gzip | 611.81 kB / 153.45 kB | 188.53 kB / 56.44 kB |
| Food initial local JS (browser decoded) | Not separated | 442,425 B |
| Food initial API calls | 5 | 5 (same endpoints) |
| Discovery on Grocery switch | Re-downloaded when key/staleness required | 0 requests in measured warm transition |
| Warm module return | Queries remounted per page | 0 API / 0 JS in measured Grocery→Food and Rides→Food |
| Category PNG | 1,067.34 kB | 87.69 kB (web build) |
| FCP (Food initial) | 236 ms baseline run | 188 ms final run |

The FCP runs were not a controlled lab benchmark (public API latency varied), so treat the 236→188 ms difference as indicative, not causal. The bundle, request-count, payload-byte and cache measurements are the reliable comparisons.

## Known remaining work

- `all-category` resizing aside, other bundled JPGs are 100–160 kB each and are mostly demo/fallback artwork; they were not recompressed because they are not all on the critical path.
- Food/Grocery mobile homes still use a `ScrollView`; converting the sticky-header/hero layout to a virtualized list is a UI-level refactor and was not attempted.
- Rides still loads the full Google Maps SDK on first entry (about 1.08 MB decoded). It is module-scoped, not global, but could be deferred further or replaced with a lighter map surface if product requirements allow.
- Backend `/discovery/home` remains monolithic and non-paginated. Splitting endpoints or adding field selection requires separate backend authorization and was documented, not changed.
