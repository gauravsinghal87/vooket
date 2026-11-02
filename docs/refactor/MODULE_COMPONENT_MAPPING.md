# Module & Component Mapping

This file records where every source file went. “Moved” means the file content
was preserved and only its import specifiers were rewritten. “Removed” means the
file was provably unreferenced and could not compile in the source app.

## 1. Web pages

| Original (`customer-web/src/`) | Optimized (`customer-web-optimized/src/`) | Owner |
| --- | --- | --- |
| `pages/food.tsx` | `modules/food/pages/food.tsx` | Food |
| `pages/restaurants.tsx` | `modules/food/pages/restaurants.tsx` | Food |
| `pages/restaurant-detail.tsx` | `modules/food/pages/restaurant-detail.tsx` | Food |
| `pages/food-cart.tsx` | `modules/food/pages/food-cart.tsx` | Food |
| `pages/food-cart.tsx` (`CartRoute`) | `features/cart/pages/cart-route.tsx` | Cart |
| `pages/grocery.tsx` | `modules/grocery/pages/grocery.tsx` | Grocery |
| `pages/stores.tsx` | `modules/grocery/pages/stores.tsx` | Grocery |
| `pages/store-detail.tsx` | `modules/grocery/pages/store-detail.tsx` | Grocery |
| `pages/product-detail.tsx` | `modules/grocery/pages/product-detail.tsx` | Grocery |
| `pages/grocery-cart.tsx` | `modules/grocery/pages/grocery-cart.tsx` | Grocery |
| `pages/rides.tsx` | `modules/rides/pages/rides.tsx` | Rides |
| `pages/rides-destination.tsx` | `modules/rides/pages/rides-destination.tsx` | Rides |
| `pages/ride-confirm-pickup.tsx` | `modules/rides/pages/ride-confirm-pickup.tsx` | Rides |
| `pages/ride-detail.tsx` | `modules/rides/pages/ride-detail.tsx` | Rides |
| `pages/checkout.tsx` | `features/checkout/pages/checkout.tsx` | Checkout |
| `pages/order-confirmation.tsx` | `features/orders/pages/order-confirmation.tsx` | Orders |
| `pages/orders.tsx` | `features/orders/pages/orders.tsx` | Orders |
| `pages/order-detail.tsx` | `features/orders/pages/order-detail.tsx` | Orders |
| `pages/wallet.tsx` | `features/wallet/pages/wallet.tsx` | Wallet |
| `pages/profile.tsx` | `features/profile/pages/profile.tsx` | Profile |
| `pages/edit-profile.tsx` | `features/profile/pages/edit-profile.tsx` | Profile |
| `pages/addresses.tsx` | `features/profile/pages/addresses.tsx` | Profile |
| `pages/payments.tsx` | `features/payments/pages/payments.tsx` | Payments |
| `pages/auth.tsx` | `features/auth/pages/auth.tsx` | Auth |
| `pages/forgot-password.tsx` | `features/auth/pages/forgot-password.tsx` | Auth |
| `pages/reset-password.tsx` | `features/auth/pages/reset-password.tsx` | Auth |
| `pages/search.tsx` | `features/search/pages/search.tsx` | Search |
| `pages/support-tickets.tsx` | `features/support/pages/support-tickets.tsx` | Support |
| `App.tsx` | `app/routes/AppRoutes.tsx` + route groups | App |
| `components/layout/AppShell.tsx` | `app/layouts/AppShell.tsx` | App |
| `components/layout/Header.tsx` | `app/layouts/Header.tsx` | App |
| `components/layout/BottomNav.tsx` | `app/layouts/BottomNav.tsx` | App |

## 2. Web components

| Original group | Optimized location | Owner |
| --- | --- | --- |
| `components/food/*` | `modules/food/components/*` | Food |
| `components/restaurant/*` | `modules/food/components/restaurant/*` | Food |
| `components/grocery/*` | `modules/grocery/components/*` | Grocery |
| `components/rides/*` | `modules/rides/components/*` | Rides |
| `components/cart/*` | `features/cart/components/*` | Cart |
| `components/order/*` | `features/orders/components/*` | Orders |
| `components/auth/*` | `features/auth/components/*` | Auth |
| `components/profile/grocery-profile.tsx` | `features/profile/components/grocery-profile.tsx` | Profile |
| `components/profile/rides-profile.tsx` | `features/profile/components/rides-profile.tsx` | Profile |
| `components/product/*` | `shared/components/product/*` | Shared |
| `components/service/*` | `shared/components/service/*` | Shared |
| `components/ui/*` | `shared/components/ui/*` | Shared |
| `components/brand/*` | `shared/components/brand/*` | Shared |
| `components/home/promo-rail.tsx`, `section-header.tsx` | `shared/components/home/` | Shared |
| `components/map/MapPicker.tsx` | `shared/components/map/MapPicker.tsx` | Shared |
| `components/layout/location-selector.tsx` | `shared/components/location-selector.tsx` | Shared |

Removed web components (unreferenced):
`components/BottomNav.tsx` (root duplicate of layout nav),
`components/food/dish-card.tsx`, `food-explore.tsx`, `food-hero-tiles.tsx`,
`food-recommended-carousel.tsx`,
`components/home/category-rail.tsx`, `hero-carousel.tsx`,
`monthly-essentials.tsx`, `quick-actions.tsx`.

Kept despite low use because they are exported from the shared public barrel:
`shared/components/ui/checkbox.tsx`, `radio.tsx`, `select.tsx`.

## 3. Web hooks, stores, services, utils

| Original | Optimized |
| --- | --- |
| `hooks/useCart.ts`, `useCartAdd.ts` | `features/cart/hooks/` |
| `hooks/useActiveGroceryStore.ts`, `useGroceryCategories.ts`, `useStoreCatalogue.ts` | `modules/grocery/hooks/` |
| `hooks/useBranding.ts` | `shared/hooks/useBranding.ts` |
| `store/appStore.ts` | `shared/stores/appStore.ts` |
| `store/authStore.ts` | `features/auth/store/authStore.ts` |
| `store/cartStore.ts`, `cartConflictStore.ts` | `features/cart/store/` |
| `store/ridesDraftStore.ts` | `modules/rides/store/ridesDraftStore.ts` |
| `store/trackingHeaderStore.ts` | `features/orders/store/` |
| `lib/apiClient.ts`, `googleMaps.ts`, `loadScript.ts`, `razorpay.ts`, `realtime.ts` | `shared/services/` |
| `lib/banner.ts`, `branding.ts`, `geo.ts`, `location.ts`, `orderStatus.ts`, `orderTracking.ts`, `productOptions.ts`, `utils.ts` | `shared/utils/` |
| `lib/delivery-eta.ts` | `modules/food/utils/delivery-eta.ts` (Food-only) |
| `lib/groceryCategories.ts` | `modules/grocery/utils/groceryCategories.ts` (Grocery-only) |
| `lib/cartConflict.ts` | `features/cart/utils/cartConflict.ts` |
| `lib/firebase.ts`, `lib/push.ts` | Removed (dead, missing dependency) |
| `config/dataSource.ts`, `images.ts` | `shared/config/` |
| `types/*` | `shared/types/*` |
| `repositories/**` | `shared/repositories/**` |
| `index.css` | `index.css` entry + `shared/styles/*` + `modules/*/styles/*` |

## 4. Mobile route → implementation

All optimized `app/**` screen routes are 4–7 line re-exports; the four auth
entry points are 4-line wrappers that render `AuthPage` with a mode prop (same
as the source app), and `_layout.tsx`/`index.tsx` keep their original role. The
implementation lives under `src/`.

| Route file | Implementation | Owner |
| --- | --- | --- |
| `app/food/index.tsx` | `modules/food/pages/food-home.tsx` | Food |
| `app/restaurants/index.tsx` | `modules/food/pages/restaurants.tsx` | Food |
| `app/restaurant/[id].tsx` | `modules/food/pages/restaurant-detail.tsx` | Food |
| `app/grocery/index.tsx` | `modules/grocery/pages/grocery-home.tsx` | Grocery |
| `app/stores/index.tsx` | `modules/grocery/pages/stores.tsx` | Grocery |
| `app/store/[id].tsx` | `modules/grocery/pages/store-detail.tsx` | Grocery |
| `app/product/[id].tsx` | `modules/grocery/pages/product-detail.tsx` | Grocery |
| `app/rides/index.tsx` | `modules/rides/pages/rides.tsx` | Rides |
| `app/rides/destination.tsx` | `modules/rides/pages/rides-destination.tsx` | Rides |
| `app/rides/confirm-pickup.tsx` | `modules/rides/pages/ride-confirm-pickup.tsx` | Rides |
| `app/ride/[id].tsx` | `modules/rides/pages/ride-detail.tsx` | Rides |
| `app/cart.tsx` | `features/cart/pages/cart.tsx` | Cart |
| `app/checkout.tsx` | `features/checkout/pages/checkout.tsx` | Checkout |
| `app/orders.tsx` | `features/orders/pages/orders.tsx` | Orders |
| `app/order/[id].tsx` | `features/orders/pages/order-detail.tsx` | Orders |
| `app/order-confirmation/[id].tsx` | `features/orders/pages/order-confirmation.tsx` | Orders |
| `app/wallet.tsx` | `features/wallet/pages/wallet.tsx` | Wallet |
| `app/profile/index.tsx` | `features/profile/pages/profile.tsx` | Profile |
| `app/profile/edit.tsx` | `features/profile/pages/edit-profile.tsx` | Profile |
| `app/profile/addresses.tsx`, `app/food/profile/addresses.tsx`, `app/grocery/profile/addresses.tsx` | `features/profile/pages/addresses.tsx` | Profile |
| `app/profile/payments.tsx` | `features/payments/pages/payments.tsx` | Payments |
| `app/search.tsx` | `features/search/pages/search.tsx` | Search |
| `app/auth/login.tsx`, `register.tsx`, `otp.tsx` | `features/auth/components/AuthPage.tsx` (mode prop) | Auth |
| `app/auth/forgot.tsx` | `features/auth/pages/forgot.tsx` | Auth |
| `app/auth/reset.tsx` | `features/auth/pages/reset.tsx` | Auth |
| `app/map-picker.tsx` | `shared/pages/map-picker.tsx` | Shared |

## 5. Mobile components

| Original (`customer-app/src/`) | Optimized |
| --- | --- |
| `components/food.tsx`, `foodHero.tsx` | `modules/food/components/` |
| `components/restaurant/*` | `modules/food/components/restaurant/` |
| `components/grocery.tsx`, `groceryCategory.tsx` | `modules/grocery/components/` |
| `components/rides/RideMap.tsx`, `PromoMosaic.tsx` | `modules/rides/components/` |
| `components/rides/AddressSearchBox.tsx` | Removed (unreferenced) |
| `components/order/*` | `features/orders/components/*` |
| `components/cart/CartConflictDialog.tsx` | `features/cart/components/` |
| `components/auth/*` | `features/auth/components/` |
| `components/address/*` | `features/profile/components/address/` |
| `components/profile/*` | `features/profile/components/` |
| `components/support/*` | `features/support/components/` |
| `components/product/*` | `shared/components/product/` |
| `components/ui/*` | `shared/components/ui/` |
| `components/AppHeader.tsx`, `BottomNav.tsx`, `BrandLogo.tsx`, `GroceryServiceabilityNotice.tsx`, `LocationSelector.tsx`, `Screen.tsx`, `SearchBar.tsx`, `ServiceModuleSwitcher.tsx`, `ServiceabilityNotice.tsx`, `cards.tsx` | `shared/components/` |

## 6. Mobile hooks, stores, services, utils

| Original | Optimized |
| --- | --- |
| `hooks/useActiveGroceryStore.ts`, `useGroceryCategories.ts`, `useStoreCatalogue.ts` | `modules/grocery/hooks/` |
| `hooks/useBranding.ts` | `shared/hooks/useBranding.ts` |
| `hooks/useCart.ts` | `features/cart/hooks/useCart.ts` |
| `hooks/use-color-scheme*`, `use-theme-color.ts` | Removed (scaffold, unreferenced) |
| `stores/appStore.ts`, `toastStore.ts` | `shared/stores/` |
| `stores/authStore.ts` | `features/auth/store/` |
| `stores/cartStore.ts`, `cartConflictStore.ts` | `features/cart/store/` |
| `stores/mapDraftStore.ts`, `ridesDraftStore.ts` | `modules/rides/store/` |
| `api/client.ts`, `token.ts` | `shared/services/client.ts`, `token.ts` |
| `api/repositories.ts` | `shared/repositories/index.ts` |
| `auth/googleAuth.ts` | `features/auth/services/googleAuth.ts` |
| `config/dataSource.ts` | `shared/config/dataSource.ts` |
| `lib/*` | `shared/utils/*` |
| `lib/groceryCategories.ts` | `modules/grocery/utils/groceryCategories.ts` (Grocery-only) |
| `lib/push.ts` | Removed (missing packages, unreferenced) |
| `types/*` | `shared/types/*` |
| `utils/assetUrl.ts` | `shared/utils/assetUrl.ts` |
| `theme/index.ts` | `shared/theme/index.ts` + `modules/{food,grocery,rides}/styles/theme.ts` |
| `repositories/index.ts` (1-line shim) | Removed; imports target `shared/repositories` |

## 7. Module public surfaces

- Web: `modules/{food,grocery,rides}/index.ts` export their pages and service
  facade. `types/index.ts` and `services/index.ts` are the module-specific type
  and data contracts.
- Mobile: `modules/{food,grocery,rides}/index.ts` export screen components,
  module hooks/stores where applicable, and the module theme. Router files import
  only these barrels.
