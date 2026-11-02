# Screen Migration Plan & Record

Status: completed for web and mobile. This document is both the plan that was
executed and the record of what each phase verified.

## 1. Migration strategy

1. Copy the source app without `node_modules` or build output.
2. Move files in batches that keep one dependency direction valid at a time:
   shared → features → modules → routes.
3. Rewrite `@/` imports mechanically after each batch.
4. Run typecheck after every batch; run build/export at phase boundaries.
5. Never edit a screen’s JSX or logic while moving it.
6. Only after a screen is in place, fix errors introduced by the move (or
   pre-existing errors that block the build).
7. Remove dead files only when they are unreferenced after the move.

## 2. Web phases

| Phase | Work | Gate | Result |
| --- | --- | --- | --- |
| 0 | Copy app, keep `package-lock.json`, install dependencies | `npm ci` | Pass |
| 1 | Create `shared/` primitives, types, services. Move `components/ui`, `product`, `service`, `brand`, `home`, `map`, repositories, stores, types, utils. | `tsc -b --noEmit` | Pass |
| 2 | Create `features/` and move auth, cart, checkout, orders, payments, wallet, profile, search, support pages/components/hooks/stores. | `tsc -b --noEmit` | Pass |
| 3 | Create `modules/{food,grocery,rides}` and move pages/components; add `services/index.ts`, `types/index.ts`, `index.ts`. | `tsc -b --noEmit` | Pass |
| 4 | Replace `App.tsx` with `app/routes/` groups + `AppRoutes`; move layouts to `app/layouts`; add `app/providers`. | `tsc -b --noEmit`, route grep | Pass |
| 5 | Split `index.css` into shared and module styles; scope module selectors with `[data-module]`. | `npm run build` (CSS emitted) | Pass |
| 6 | Remove dead files, fix lint/type errors, final gates. | typecheck + lint + build | Pass |

### 2.1 Web screen migration table

| URL | Source screen | Optimized screen | Guard |
| --- | --- | --- | --- |
| `/` | redirect to `/food` | same | – |
| `/food` | `pages/food.tsx` | `modules/food/pages/food.tsx` | – |
| `/restaurants` | `pages/restaurants.tsx` | `modules/food/pages/restaurants.tsx` | – |
| `/restaurant/:id` | `pages/restaurant-detail.tsx` | `modules/food/pages/restaurant-detail.tsx` | – |
| `/grocery` | `pages/grocery.tsx` | `modules/grocery/pages/grocery.tsx` | – |
| `/stores` | `pages/stores.tsx` | `modules/grocery/pages/stores.tsx` | – |
| `/store/:id` | `pages/store-detail.tsx` | `modules/grocery/pages/store-detail.tsx` | – |
| `/product/:id` | `pages/product-detail.tsx` | `modules/grocery/pages/product-detail.tsx` | – |
| `/rides` | `pages/rides.tsx` | `modules/rides/pages/rides.tsx` | – |
| `/rides/destination` | `pages/rides-destination.tsx` | `modules/rides/pages/rides-destination.tsx` | – |
| `/rides/confirm-pickup` | `pages/ride-confirm-pickup.tsx` | `modules/rides/pages/ride-confirm-pickup.tsx` | auth |
| `/ride/:id` | `pages/ride-detail.tsx` | `modules/rides/pages/ride-detail.tsx` | auth |
| `/cart` | `pages/food-cart.tsx` (`CartRoute`) | `features/cart/pages/cart-route.tsx` dispatching to `modules/food/pages/food-cart.tsx` / `modules/grocery/pages/grocery-cart.tsx` | – |
| `/checkout` | `pages/checkout.tsx` | `features/checkout/pages/checkout.tsx` | auth |
| `/order-confirmation/:id` | `pages/order-confirmation.tsx` | `features/orders/pages/order-confirmation.tsx` | auth |
| `/orders` | `pages/orders.tsx` | `features/orders/pages/orders.tsx` | auth |
| `/order/:id` | `pages/order-detail.tsx` | `features/orders/pages/order-detail.tsx` | auth |
| `/wallet` | `pages/wallet.tsx` | `features/wallet/pages/wallet.tsx` | auth |
| `/profile` | `pages/profile.tsx` | `features/profile/pages/profile.tsx` | auth |
| `/profile/edit` | `pages/edit-profile.tsx` | `features/profile/pages/edit-profile.tsx` | auth |
| `/profile/addresses` | `pages/addresses.tsx` | `features/profile/pages/addresses.tsx` | auth |
| `/food/profile/addresses` | `pages/addresses.tsx` | same screen via shared route group | auth |
| `/grocery/profile/addresses` | `pages/addresses.tsx` | same screen via shared route group | auth |
| `/profile/payments` | `pages/payments.tsx` | `features/payments/pages/payments.tsx` | auth |
| `/search` | `pages/search.tsx` | `features/search/pages/search.tsx` | – |
| `/support` | `pages/support-tickets.tsx` | `features/support/pages/support-tickets.tsx` | auth |
| `/auth/login`, `/auth/register` | `pages/auth.tsx` | `features/auth/pages/auth.tsx` | – |
| `/auth/forgot-password` | `pages/forgot-password.tsx` | `features/auth/pages/forgot-password.tsx` | – |
| `/auth/reset-password` | `pages/reset-password.tsx` | `features/auth/pages/reset-password.tsx` | – |
| `*` | redirect to `/food` | same | – |

Route composition now lives in `src/app/routes/`:
`food.routes.tsx`, `grocery.routes.tsx`, `rides.routes.tsx`,
`shared.routes.tsx`, `auth.routes.tsx`, composed by `AppRoutes.tsx`.

## 3. Mobile phases

| Phase | Work | Gate | Result |
| --- | --- | --- | --- |
| 0 | Copy app, install dependencies | `npm ci` | Pass |
| 1 | Create `shared/` and move components, theme, types, utils, services, repositories, stores. | `tsc --noEmit` | Pass |
| 2 | Create `features/` and move auth, cart, checkout, orders, payments, profile, search, support, wallet. | `tsc --noEmit` | Pass |
| 3 | Create `modules/{food,grocery,rides}` and move service screens/components/hooks/stores. | `tsc --noEmit` | Pass |
| 4 | Replace each `app/` screen with a re-export; keep `_layout.tsx` route names identical. | `tsc --noEmit`, route list | Pass |
| 5 | Split the single theme into shared theme + three module themes; rewire module imports. | `tsc --noEmit` | Pass |
| 6 | Lint cleanup, dead-file removal, native/web exports, Expo Doctor. | `expo lint`, exports, `expo-doctor` | Pass |

### 3.1 Mobile route preservation

All 30 screen routes from the source app exist with the same URL (plus the `/` redirect):

```
/  /cart  /checkout  /food  /grocery  /map-picker  /orders  /search  /wallet
/restaurants  /restaurant/[id]  /stores  /store/[id]  /product/[id]
/rides  /rides/destination  /rides/confirm-pickup  /ride/[id]
/order/[id]  /order-confirmation/[id]
/profile  /profile/edit  /profile/addresses  /profile/payments
/food/profile/addresses  /grocery/profile/addresses
/auth/login  /auth/register  /auth/forgot  /auth/otp  /auth/reset
```

`app/_layout.tsx` keeps the same `Stack.Screen` names, so navigation and deep
links are unchanged.

### 3.2 Mobile screen size reduction

Representative route files moved from implementation to thin wrappers:

| Route | Before | After |
| --- | --- | --- |
| `app/cart.tsx` | 3,044 lines | 7 |
| `app/order/[id].tsx` | 1,387 lines | 7 |
| `app/restaurant/[id].tsx` | 1,409 lines | 7 |
| `app/rides/index.tsx` | 1,129 lines | 7 |
| `app/orders.tsx` | 935 lines | 7 |
| `app/ride/[id].tsx` | 920 lines | 7 |
| `app/search.tsx` | 819 lines | 7 |
| `app/profile/index.tsx` | 691 lines | 7 |

The `app/` tree now totals 315 lines across 32 files (route declarations and
wrappers only).

## 4. Verification per boundary

Each phase used the same acceptance criteria:

- no unresolved imports (`tsc`/Vite)
- no route removed from the manifest
- no UI string or handler intentionally changed
- no environment file edited
- no API URL or payload changed

Where a move exposed a pre-existing compile error (unused vars, missing lucide
icons, relative imports, firebase), the fix was limited to that error and
recorded in `VERIFICATION_AND_REGRESSION.md`.

## 5. Rollback strategy

The source apps were never modified in place. If a regression is found, the
optimized app can be discarded or a single phase can be replayed from the
source tree. No database, backend or env changes are involved.

## 6. Optional follow-up (not done)

- Lazy-load module route groups to cut the web main bundle below 500 kB.
- Extract Food query hooks and shared list-state helpers into
  `modules/food/hooks`.
- Split the remaining large checkout/cart/order-detail screens into smaller
  presentational components without changing markup.
- Move the hardcoded Google Maps key out of `app.json` into EAS secrets.
