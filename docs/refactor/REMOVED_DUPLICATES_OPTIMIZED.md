# Removed Duplicates & Optimized Components

## 1. Files removed (dead code)

### Web (`customer-web-optimized`)
| Path | Reason |
| --- | --- |
| `src/components/BottomNav.tsx` | Duplicate of `app/layouts/BottomNav.tsx`, unreferenced |
| `src/modules/food/components/dish-card.tsx` | Unreferenced after migration |
| `src/modules/food/components/food-explore.tsx` | Unreferenced |
| `src/modules/food/components/food-hero-tiles.tsx` | Unreferenced |
| `src/modules/food/components/food-recommended-carousel.tsx` | Unreferenced |
| `src/shared/components/home/category-rail.tsx` | Unreferenced |
| `src/shared/components/home/hero-carousel.tsx` | Unreferenced |
| `src/shared/components/home/monthly-essentials.tsx` | Unreferenced |
| `src/shared/components/home/quick-actions.tsx` | Unreferenced |
| `src/lib/firebase.ts`, `src/lib/push.ts` | Unreferenced; no `firebase` package installed |
| `public/firebase-messaging-sw.js` | Referenced nowhere; removed for clean lint |

### Mobile (`customer-app-optimized`)
| Path | Reason |
| --- | --- |
| `src/components/rides/AddressSearchBox.tsx` | Unreferenced |
| `src/repositories/index.ts` | 1-line shim unused after moving imports to `shared/repositories` |
| `src/hooks/use-color-scheme.ts`, `use-color-scheme.web.ts` | Expo scaffold hooks, unreferenced |
| `src/hooks/use-theme-color.ts` | Scaffold hook, unreferenced |
| `src/lib/push.ts` | Unreferenced; missing packages |

## 2. Type/system duplication removed

| Area | Change |
| --- | --- |
| Mobile types | Removed duplicate re-exports in `src/shared/types/models.ts`; `catalog.ts` is the entity source, `models.ts` imports and extends. `src/shared/types/index.ts` is the single barrel. |
| Mobile routes | Screen implementations moved out of `app/`; `app/` now contains only route declarations/wrappers. |
| Web routes | Single `App.tsx` route table replaced by `app/routes/{food,grocery,rides,shared,auth}.routes.tsx` + `AppRoutes.tsx`. |
| Theme | One monolithic mobile theme split into `shared/theme/index.ts` + `modules/*/styles/theme.ts`. Web CSS split into shared + module stylesheets. |

## 3. Components optimized (structure)

These changes reduce duplication or clarify ownership without altering behaviour:

| Component | Optimization |
| --- | --- |
| Web `shared/components/index.ts` | Added aliases (`ProductImage`, `PriceDisplay`, `QuantityControl`, `ModuleSwitcher`) to reduce import churn. |
| Web `AppShell` | Added `data-module` scoping derived from route/query; preserves `data-service-theme`. |
| Mobile route wrappers | 30 screen routes reduced to thin re-exports (the `app/` tree goes from 16,383 lines of screen code to 315 lines of wrappers). |
| Mobile module barrels | Added `modules/{food,grocery,rides}/index.ts` so route layer imports from public surface only. |
| Web `ProductImage`/primitives | Kept in shared UI, exported with ergonomic aliases. |
| Web Food sticky header | Extracted the two-stage scroll measurement into `modules/food/hooks/useStickyFoodHeader.ts` (same refs, thresholds and listeners). |
| Module-only helpers | `delivery-eta` moved to Food utils; `groceryCategories` moved to Grocery utils; no cross-module imports added. |
| `LocationSelector` | Moved to `src/shared/components/location-selector.tsx` on web and used in shared locations on mobile. |

## 4. Not removed (kept by design)

| Item | Reason |
| --- | --- |
| Web `shared/components/ui/checkbox.tsx`, `radio.tsx`, `select.tsx` | Exported from `shared/components/index.ts` (API surface) |
| Mobile `components/rides/` map/promo components | Owned by rides module |
| Large screens (checkout, cart, order-detail, restaurant-detail) | Behaviour-critical; moved as-is. Extraction tracked as a follow-up. |
| Repository layer (`shared/repositories/*`) | Cross-cutting data access, contracts unchanged |
| Mock data | Required for local/dev parity |

## 5. Import fan-in (hot spots)

Top consumers after refactor (by import count of the module/shared surface):

| Target | Approximate role |
| --- | --- |
| `shared/repositories` | Data access for almost all features/modules |
| `shared/stores/appStore` | Service/location selection |
| `features/cart/hooks/useCart` | Cart operations across Food/Grocery |
| `shared/theme` / module themes | Styling |
| `shared/types` | Type contracts |

No module-to-module imports were introduced.
