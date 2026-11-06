# Module Isolation Audit

Date: 2026-11-02

## Web structure

- `src/app` — routes, providers, layouts.
- `src/modules/food|grocery|rides` — module pages, components, hooks, styles, services, types.
- `src/features` — auth, cart, checkout, orders, profile, payments, search, support, wallet.
- `src/shared` — cross-module components, hooks, repositories, services, stores, UI, utilities.
- Route group files export element constants (`foodRoutes`, `groceryRoutes`, etc.), not components.
- Food/Grocery/Rides are lazy chunk boundaries. Account/cart/checkout/orders are also lazy.
- Module switcher prefetch imports only the destination module entry.

## Mobile structure

- `app/` contains thin Expo Router route files that re-export/wrap screens from `src`.
- `src/modules/food|grocery|rides` owns module screens, components, hooks, stores and independent theme files.
- `src/features` owns cross-module account/commerce features.
- `src/shared` owns reusable UI, repositories, services, theme primitives and utilities.
- Mobile themes are independent TypeScript theme objects per module, not one global palette.

## Theme/scoping

- Web shell sets `data-module` at the root while preserving `data-service-theme`.
- Module CSS is scoped by `[data-module]`; shared CSS is separate.
- The CSS split has zero `!important` declarations.
- Mobile module themes are imported by module screens/components rather than being applied by the shell.

## Evidence

- Route smoke test passed on the final production build for `/food`, `/grocery`, `/rides`, `/restaurants`, `/stores`, `/search`, `/cart` and `/auth/login`.
- Warm module returns made 0 API/0 JS requests, showing module boundaries share cache without remounting duplicate data layers.
- Rides’ Google Maps SDK loads only on first Rides entry; Food/Grocery initial load had 0 Google Maps resources.
- No original `customer-web`/`customer-app`/`backend` file was changed.

## Remaining coupling

- Shared UI/data repositories are intentionally shared; this is composition, not cross-module page imports.
- The Food/Grocery discovery endpoint couples the two modules at the API layer even though the frontend now shares one cache entry. Backend module scoping would be the next isolation step.
- Some shared cards (product/restaurant/store) are reused across modules; their styles must stay neutral.
