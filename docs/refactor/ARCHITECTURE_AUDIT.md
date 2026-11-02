# Architecture Audit — Optimized Customer Apps

Date: 2026-11-02
Scope: `customer-web-optimized/` and `customer-app-optimized/`
Source apps: `customer-web/` and `customer-app/` (left untouched by this refactor)

## 1. Objectives and constraints

The refactor restructures the two customer clients into module-owned applications
without changing:

- URLs, routes, deep links or navigation contracts
- UI copy, visual design, spacing or interaction flow
- business logic or state transitions
- Laravel API request/response contracts
- payments, maps or environment files

The only code changes besides file moves are import rewrites, type fixes required
to compile the moved code, removal of provably unreferenced files, and lint fixes
that do not alter behaviour.

## 2. Baseline audit

### 2.1 Web (`customer-web/`)

- Vite 5 + React 18 + TypeScript + Tailwind CSS v4
- React Router v6, TanStack Query v5, Zustand v5
- `@` alias → `src/`
- 184 TS/TSX files in `src/`, one flat `index.css` (~1,100 lines)
- Route table declared in a single `src/App.tsx`
- Screens, food/grocery/rides components, shared UI, repositories and utilities
  all mixed under `src/components`, `src/pages`, `src/lib` and `src/store`
- Pre-existing typecheck failures: unused imports/variables and `firebase`
  imports with no installed `firebase` dependency
- Dead modules: `lib/firebase.ts`, `lib/push.ts`, root `components/BottomNav.tsx`

### 2.2 Mobile (`customer-app/`)

- Expo SDK 54 + Expo Router + React Native + TypeScript
- 87 TS/TSX files in `src/`, 32 route files in `app/`
- Screen implementations lived directly in `app/**/*.tsx` (some over 3,000 lines)
- One shared `src/theme/index.ts` used by all three services
- No `pages/` layer; components, hooks, stores and utilities mixed by type
- Dead scaffold hooks (`use-color-scheme`, `use-theme-color`), dead
  `src/components/rides/AddressSearchBox.tsx`, and `src/lib/push.ts` requiring
  packages that are not installed

## 3. Target architecture

### 3.1 Dependency direction

```
app/ (routes, layouts, providers)
  -> modules/{food,grocery,rides}   (service-owned screens/components/hooks)
  -> features/{auth,cart,checkout,orders,payments,wallet,profile,search,support}
  -> shared/{components,hooks,services,repositories,stores,types,utils,styles}
```

Rules enforced by this structure:

1. `shared` never imports a module or a feature.
2. A module never imports another module.
3. `features` may compose modules and shared code. Cross-module routes live in
   `features` (for example `features/cart/pages/cart-route.tsx` dispatches
   `/cart` to Food or Grocery), so no module imports another module.
4. Route files contain no implementation. Web routes are declarative groups;
   mobile `app/` files are one-line re-exports.
5. Repositories stay in the composition/shared layer. Modules call typed
   facades (`foodService`, `groceryService`, `ridesService`) instead of wiring
   HTTP clients themselves.

### 3.2 Web structure

```
customer-web-optimized/src/
  app/
    layouts/        AppShell, Header, BottomNav
    providers/      app-providers, query-provider
    routes/         AppRoutes + food/grocery/rides/shared/auth route groups
  modules/
    food/           pages, components, components/restaurant, hooks, services, types, utils, styles, index.ts
    grocery/        pages, components, hooks, services, types, utils, styles, index.ts
    rides/          pages, components, services, store, types, styles, index.ts
  features/
    auth/           components, pages, store
    cart/           components, hooks, pages (cart-route), store, utils
    checkout/       pages
    orders/         components, pages, store
    payments/       pages
    profile/        components, pages
    search/         pages
    support/        pages
    wallet/         pages
  shared/
    components/     ui, product, service, brand, home, map, location-selector
    config/ hooks/ repositories/{api,mock} services/ stores/ types/ utils/
    styles/         variables, reset, typography, shared
  assets/
  index.css         stylesheet entry point
  main.tsx
```

### 3.3 Mobile structure

```
customer-app-optimized/
  app/                      Expo Router entries only (thin re-exports)
  src/
    modules/
      food/                 pages, components/restaurant, styles/theme.ts, index.ts
      grocery/              pages, components, hooks, styles/theme.ts, index.ts
      rides/                pages, components, store, styles/theme.ts, index.ts
    features/
      auth/                 components, pages, services, store
      cart/                 components, hooks, pages, store
      checkout/             pages
      orders/               components, pages
      payments/             pages
      profile/              components/address, pages
      search/               pages
      support/              components
      wallet/               pages
    shared/
      components/           ui, product, Screen, AppHeader, cards, switcher...
      config/ hooks/ pages/ repositories/ services/ stores/ theme/
      types/ utils/
```

## 4. Ownership map

| Concern | Owner | Notes |
| --- | --- | --- |
| Restaurant discovery, menu, Food cart screen | `modules/food` | `/food`, `/restaurants`, `/restaurant/:id`, `/cart?type=food` |
| Store discovery, catalogue, product detail, Grocery cart | `modules/grocery` | `/grocery`, `/stores`, `/store/:id`, `/product/:id`, `/cart?type=grocery` |
| Ride booking, pickup/destination, live ride | `modules/rides` | `/rides`, `/rides/destination`, `/rides/confirm-pickup`, `/ride/:id` |
| Auth, guards, login/register/reset | `features/auth` | URL contract unchanged |
| Cart state, conflict handling | `features/cart` | Shared by Food and Grocery |
| Checkout | `features/checkout` | `/checkout` |
| Orders and tracking | `features/orders` | `/orders`, `/order/:id`, `/order-confirmation/:id` |
| Wallet and payments | `features/wallet`, `features/payments` | |
| Profile and addresses | `features/profile` | Includes module-scoped address aliases |
| Search | `features/search` | Module-aware shared screen |
| Support | `features/support` | Web `/support`; mobile support sheet |
| Design primitives | `shared/components/ui` | Never forked per module |
| Design tokens | web `shared/styles` + module CSS; mobile `shared/theme` + module `styles/theme.ts` | |
| API composition | `shared/repositories` | HTTP + mock repositories, unchanged contracts |

## 5. Audit findings carried as known risks

| Finding | Status |
| --- | --- |
| Web main JS chunk ~612 kB (gzip ~153 kB) | Pre-existing; code-splitting not introduced because it would change loading behaviour. Documented in the build report. |
| Google Maps API key is hardcoded in mobile `app.json` | Pre-existing; not modified. Should move to EAS secrets. |
| Web `.env` and mobile `.env` | Not copied/modified. Optimized apps rely on the same variable names. |
| `customer-web-optimized` package name is still `customer-web`; mobile is `customer-app` | Kept to avoid changing lockfile/tooling identity; folder names carry the optimized identity. |
| Web repository layer is large (API + mock data) | Kept in shared composition layer by design; not split per module because contracts are cross-cutting. |
| Some large screen components remain large (checkout, cart, order detail, restaurant detail) | Moved without behavioural rewrites. Further extraction is proposed in `COMPONENT_REUSE_PLAN.md` but not required for correctness. |

## 6. Dependency and import hygiene

- All `@/` aliases were mechanically rewritten after each move and validated by
  `tsc -b` / `tsc --noEmit`.
- Module public surfaces are explicit `index.ts` files. Mobile route wrappers
  import module screens only through those barrels.
- Module-specific helpers live with their module: `food/utils/delivery-eta.ts`,
  `grocery/utils/groceryCategories.ts`, and the Food sticky-header hook
  `food/hooks/useStickyFoodHeader.ts`. Module folders exist when they own code;
  there are no empty placeholder directories.
- No module imports another module. Cross-module screens (cart, checkout,
  orders, search, profile) live in `features/` or `shared/`.
- Duplicate type re-exports between `types/catalog.ts` and `types/models.ts`
  were removed; `types/index.ts` is the single type surface.

## 7. Verification gates used

Every phase ended with the strongest available gate:

| Gate | Web | Mobile |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | `npx tsc --noEmit` |
| Lint | `npm run lint` (`--max-warnings 0`) | `npx expo lint` |
| Production build | `npm run build` | `npx expo export --platform web/ios/android` |
| Dependency health | `npm ci` | `npm ci`, `npx expo-doctor` |

Results are recorded in `VERIFICATION_AND_REGRESSION.md`.
