# Verification & Regression Report

Date: 2026-11-02
Apps: `customer-web-optimized`, `customer-app-optimized`
Dependencies: installed standalone with `npm ci` (no symlinked `node_modules`).

## 1. Web verification

Commands run in `customer-web-optimized/`:

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Pass (325 packages) |
| `npm run typecheck` (`tsc -b --noEmit`) | **Pass**, no diagnostics |
| `npm run lint` (`eslint . --ext ts,tsx --max-warnings 0`) | **Pass**, 0 problems |
| `npm run build` (`tsc -b && vite build`) | **Pass**, 1,852 modules transformed, built in ~4.6 s |

Build output:

```
dist/index.html                  0.98 kB  (gzip 0.50 kB)
dist/assets/all-category-*.png   1,067.34 kB
dist/assets/index-*.css          120.54 kB (gzip 19.14 kB)
dist/assets/react-*.js           0.03 kB
dist/assets/query-*.js           42.76 kB   (gzip 12.82 kB)
dist/assets/router-*.js          162.88 kB  (gzip 53.15 kB)
dist/assets/index-*.js           611.90 kB  (gzip 153.44 kB)
```

Known warning (pre-existing): the main JS chunk is > 500 kB. No behaviour change
was made to hide it; code-splitting is listed as a follow-up.

### 1.1 Web route manifest (static check)

The route groups compose these paths, matching the source `App.tsx`:

```
/  /food  /grocery  /rides  /rides/destination  /rides/confirm-pickup
/restaurants  /restaurant/:id  /stores  /store/:id  /product/:id
/search  /cart  /checkout  /order-confirmation/:id  /orders  /order/:id
/ride/:id  /wallet  /profile  /profile/edit  /profile/addresses
/food/profile/addresses  /grocery/profile/addresses  /profile/payments
/support  /auth/login  /auth/register  /auth/forgot-password
/auth/reset-password  *
```

Guards are unchanged: `/rides/confirm-pickup`, `/ride/:id`, `/checkout`,
`/order-confirmation/:id`, `/orders`, `/order/:id`, `/wallet`, `/profile*`
and `/support` remain inside `RequireAuth`.

## 2. Mobile verification

Commands run in `customer-app-optimized/`:

| Command | Result |
| --- | --- |
| `npm ci --no-audit --no-fund` | Pass (994 packages) |
| `npx tsc --noEmit` | **Pass**, no diagnostics |
| `npx expo lint --no-cache` | **Pass**, 0 errors / 0 warnings |
| `npx expo export --platform web` | **Pass**, `dist-web`, 33 HTML files = 31 screen URLs + `_sitemap` + `+not-found` |
| `npx expo export --platform ios` | **Pass**, Hermes bundle (`entry-*.hbc`, 6.1 MB) |
| `npx expo export --platform android` | **Pass**, Hermes bundle (`entry-*.hbc`, 6.1 MB) |
| `npx expo-doctor` | **18/18 checks passed** |

### 2.1 Exported web routes (from `dist-web`)

```
/  /_sitemap  /+not-found
/food  /grocery  /rides  /rides/destination  /rides/confirm-pickup
/restaurants  /restaurant/[id]  /stores  /store/[id]  /product/[id]
/cart  /checkout  /search  /orders  /order/[id]  /order-confirmation/[id]
/ride/[id]  /wallet
/profile  /profile/edit  /profile/addresses  /profile/payments
/food/profile/addresses  /grocery/profile/addresses
/map-picker
/auth/login  /auth/register  /auth/forgot  /auth/otp  /auth/reset
```

`/cart`, `/checkout`, `/search` and `/order-confirmation/[id]` are present.

## 3. Fixes made during migration (behaviour-neutral)

### Web
- Removed unused imports/variables in moved `food-cart` and `restaurant-detail`
  code; corrected a restaurant-detail event-handler signature and relative
  asset imports so the moved files compile.
- Removed dead Firebase modules and the unused service worker (no caller and no
  installed dependency).
- Lint now passes with `--max-warnings 0`.

### Mobile
- Escaped apostrophes in JSX text (`Couldn't`, `You'll`, `We've`, `don't`) for
  `react/no-unescaped-entities`.
- Renamed a local async handler from `useGps` to `handleUseGps` so
  `react-hooks/rules-of-hooks` no longer treats it as a hook. Behaviour is
  identical.
- Removed duplicate `Category`/`Brand`/`Product`/`Address`/`Restaurant`/`Store`/
  `WalletTransaction` re-exports from `models.ts` (they now come only from
  `catalog.ts`).
- Removed unused imports/variables and the unreferenced `AddressSearchBox`
  component during lint cleanup.

## 4. API, payment, map and env contracts

| Contract | Status |
| --- | --- |
| Repository interfaces and endpoint strings | Unchanged; files moved to `shared/repositories` only |
| Mock repositories | Unchanged |
| Payment utilities (`razorpay`, `payments`, checkout payloads) | Moved, not rewritten |
| Maps (`googleMaps`, `loadScript`, `MapPicker`, module maps) | Moved, not rewritten |
| `customer-web-optimized/.env` vs source | Identical (diff clean) |
| `customer-app-optimized/.env` vs source | Identical (diff clean) |
| `app.json` (mobile) | Unchanged (including the pre-existing hardcoded Maps key) |

## 5. Regression checklist

| Check | Method | Result |
| --- | --- | --- |
| Type safety | `tsc` | Pass |
| Lint | web ESLint / Expo ESLint | Pass |
| Production compilation | Vite build / Expo exports (web, iOS, Android) | Pass |
| Route preservation | Route files/groups compared with source `App.tsx` and `app/` tree | Pass |
| Runtime routing | Browser smoke test of `/food`, `/grocery`, `/rides`, `/cart?type=food`, `/search`, `/auth/login`, `/orders` | Pass (no React Router errors) |
| Navigation names | Mobile `_layout.tsx` `Stack.Screen` names unchanged | Pass |
| Module isolation | No module imports another module or its theme (grep) | Pass |
| CSS isolation | `[data-module]` scoping, 0 `!important` | Pass |
| Bundle health | Expo Doctor 18/18 | Pass |
| Environment parity | `diff` of copied env files | Pass |

### 5.1 Runtime smoke test

The web app was opened against the Vite dev server (`localhost:5176`) after the
route-group fix. `/food`, `/grocery`, `/rides`, `/cart?type=food`, `/search`,
`/auth/login` and a protected `/orders` redirect all rendered their expected
screens with **no React Router console errors**. The only console errors were
expected API responses for a guest session (401 / CORS when using an
unregistered dev port).

### 5.2 Regression found and fixed during verification

**Symptom:** `[FoodRoutes] is not a <Route> component` at runtime.

**Cause:** the route groups were React components (`<FoodRoutes />`) that
returned fragments of `<Route>` elements. React Router v6 only accepts `<Route>`
or `<Fragment>` as direct `<Routes>` children, so a component wrapper is invalid.

**Fix:** each group now exports a fragment element (`export const foodRoutes = (<>…</>)`)
and `AppRoutes` renders it as `{foodRoutes}`. URL contracts and screens are
unchanged. Typecheck, lint, production build and the browser smoke test pass
after the fix.

### 5.3 Not executed in this pass (manual QA recommended)

- Full click-through of every web route, form flow and responsive breakpoint.
- Device/simulator interaction, gestures and keyboard behaviour.
- End-to-end API calls against a running Laravel backend, payment sandbox and
  live map tiles.
- Visual pixel comparison against screenshots.

These require a running backend/dev server and a device or browser session and
were outside the automated verification performed here. The refactor did not
change JSX structure, handlers or API payloads, so the risk is limited to import
and file-location regressions, which the typecheck/build/export gates cover.

## 6. Pre-existing issues retained

| Issue | Impact | Recommendation |
| --- | --- | --- |
| Web main chunk 611.71 kB | Slower first load | Add module-level `React.lazy`/route splitting |
| Hardcoded Google Maps API key in mobile `app.json` | Secret in repo | Move to EAS secrets / env-backed config |
| Large screens remain large (cart, checkout, order detail, restaurant detail) | Maintainability | Extract presentational components incrementally |
| Package names are still `customer-web` / `customer-app` | Cosmetic | Rename if publishing separately |
| Source apps still present | Disk/confusion | Archive or remove once optimized apps are adopted |

## 7. Android APK build (customer-app-optimized)

| Item | Result |
| --- | --- |
| EAS build ID | `b62ecd0f-eba2-4ec2-9a47-4d0abb98d4b9` (`preview` profile) |
| Build result | Finished successfully |
| APK | `customer-app-optimized/builds/vooket-customer-v1.0.0-build2.apk` |
| Package / version | `com.superbasket.customer`, version `1.0.0` (versionCode `2`) |
| API base URL | `https://vooketapi.expertshub.in/api/v1` |
| SHA-256 | `f186024d7b0f06ea31f065ab0b2221f372fc035646bfd10a93d92ede19b4c01f` |

The API URL was configured in `.env` and in the `preview` profile of
`eas.json`, and was confirmed inside the packaged
`assets/index.android.bundle` after download. The Vooket splash artwork was
already configured in `app.json` using `assets/images/splash-icon.png` on the
brand red `#D72022` background; the built APK contains the branded splash
assets at 288, 432, 576, 864 and 1152 px densities. `expo-doctor` passed 18/18
and EAS `assembleRelease` completed without build errors.

The APK was not installed on a physical device or emulator in this pass.
