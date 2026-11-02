# Component Reuse Plan

## 1. Principles

1. **One primitive, many modules.** Buttons, sheets, loaders, price formatting,
   quantity steppers, inputs, modals, ratings, tabs and toasts live in
   `shared/components` and are never forked per module.
2. **Module look, shared structure.** When Food and Rides need different visuals
   for the same concept, the structure and behaviour stay shared and the visual
   difference is expressed through tokens/theme, not a copied component.
3. **Ownership is explicit.** A component used by exactly one module lives in
   that module. A component used by two or more modules moves to `shared` only
   after its props are module-agnostic.
4. **No cross-module imports.** Food never imports Grocery or Rides components.
   Cross-cutting screens (cart, checkout, orders, search, profile) live in
   `features`.
5. **Composition over configuration.** Module screens compose shared primitives
   rather than adding module flags to shared components.

## 2. Web shared surface

Exported from `src/shared/components/index.ts`:

| Category | Components |
| --- | --- |
| UI primitives | `Avatar`, `Badge`, `BottomSheet`, `Button`/`buttonVariants`, `Card`, `Checkbox`, `Image`/`ProductImage`, `Input`, `Loader`, `Modal`, `Price`/`PriceDisplay`, `QuantityStepper`/`QuantityControl`, `Radio`, `Rating`, `Select`, `Skeleton`/`CardSkeleton`, `EmptyState`/`ErrorState`/`NoResultsState`/`GenericEmpty`, `Tabs`, `Toaster`/`toast` |
| Service chrome | `SearchBar`, `ServiceModuleSwitcher`/`ModuleSwitcher`, `LocationSelector` |
| Map | `MapPicker` |
| Product | `product-card`, `product-configurator`, `variable-product-modal`, `add-to-cart`, `selected-options` |
| Brand/home | `brand-logo`, `promo-rail`, `section-header` |

Compatibility aliases (`ProductImage`, `PriceDisplay`, `QuantityControl`,
`ModuleSwitcher`) keep the existing call sites working while exposing the
canonical names.

## 3. Mobile shared surface

| Category | Components |
| --- | --- |
| UI primitives | `ui/primitives.tsx` (buttons, loader, empty state, rating), `ui/Avatar`, `ui/BottomSheet`, `ui/ProductImage`, `ui/ToastProvider` |
| Shell/chrome | `Screen`, `AppHeader`, `BottomNav`, `BrandLogo`, `SearchBar`, `ServiceModuleSwitcher`, `LocationSelector`, `ServiceabilityNotice`, `GroceryServiceabilityNotice` |
| Cards | `cards.tsx` (restaurant/store/product/promo cards, view-cart bar) |
| Product | `product/AddToCart.tsx`, `product/ProductConfiguratorSheet.tsx`, `product/SelectedOptions.tsx` |
| Map | shared `react-native-maps` usage lives in module maps; the shared `map-picker` page is the common location picker |

## 4. Intentionally module-specific components

| Module | Components | Why not shared |
| --- | --- | --- |
| Food | `foodHero`, `food-categories`, `food-filter-sheet`, `food-filters`, food restaurant/recommended/spotlight cards, `restaurant/*` | Food-specific discovery language, Zomato-style cards, menu sections |
| Grocery | `grocery-hero`, `grocery-header`, `category-browser`, `category-view`, `product-shelf`, `brand-promo-rail`, `festive-promo-grid`, `store-context` | Quick-commerce aisle/shelf layout and store context |
| Rides | `RideMap`, `RideTrackingMap`, `promo-mosaic`, rides `pay-now-card`, `AddressSearchBox` equivalents | Map-first layout, pickup/drop semantics |
| Orders | `tracking-*`, `status-tracker`, `delivery-*`, `pay-now-card`, `food-preparation-chips` | Order lifecycle UI shared by Food and Grocery, owned by the orders feature |

## 5. Duplication removed

| Duplicate | Resolution |
| --- | --- |
| Two bottom navs on web (`components/BottomNav.tsx` and `components/layout/BottomNav.tsx`) | Removed the unused root copy |
| Duplicate type re-exports between mobile `types/catalog.ts` and `types/models.ts` | `catalog` owns the entities; `models` imports them and no longer re-exports |
| One shared mobile theme | Shared tokens + three module themes (`modules/*/styles/theme.ts`) |
| Web route table + screen imports in one `App.tsx` | Route groups per module/feature |
| Unreferenced web components (8 files) | Removed after import scan |
| Unreferenced mobile files (scaffold hooks, `AddressSearchBox`, legacy repository shim, `lib/push.ts`) | Removed after import scan |
| Dead web Firebase service worker and client modules | Removed (the dependency was never installed) |

## 6. Reuse rules for future work

1. Before adding a component, search `shared/components` and the owning module.
2. If a second module needs it, move it to `shared` and remove the module copy
   in the same change.
3. Never import `@/modules/food/...` from Grocery, Rides or `shared`.
4. Use the module theme object for colours/spacing. Do not hardcode a hex value
   that already exists in `shared/styles/variables.css` or a module theme.
5. Keep module barrels (`modules/*/index.ts`) as the only entry point for route
   files. Do not deep-import module internals from `app/`.
6. Add a shared primitive to the barrel and its alias only when there is a
   caller; do not create speculative exports.

## 7. Reuse opportunities not taken

These would improve size/maintainability but were intentionally deferred because
they change component internals and need visual regression testing:

- Web Food list/card state (filters, active section, favourites) can move into
  `modules/food/hooks`.
- Web checkout and cart share money-summary rows; a `features/cart` summary
  primitive would remove repeated markup.
- Mobile `cards.tsx` contains several cards; it can be split by card type
  without changing props.
- Tracking panels used by order and ride detail could share a generic timeline
  primitive while keeping module-specific labels.
