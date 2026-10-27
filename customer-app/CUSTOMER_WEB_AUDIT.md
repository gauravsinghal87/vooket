# Customer Web — Full Audit (source of truth for the React Native build)

Source: `customer-web/` (Vite + React 18 + TS + Tailwind v4 + React Router v6 + TanStack Query v5 + Zustand v5).
Read-only audit. Every section below mirrors the web implementation so the Expo app can reach feature parity.
Icon names are **lucide-react** names (RN equivalent: `lucide-react-native`, same names).

---

## 1. Project overview & stack

- **Name**: `customer-web` v0.1.0, ESM. Scripts: `dev` (vite), `build` (`tsc -b && vite build`), `preview`, `lint` (`eslint . --ext ts,tsx --max-warnings 0`), `typecheck` (`tsc -b --noEmit`).
- **Dependencies**: react 18.3, react-dom 18.3, react-router-dom 6.27, @tanstack/react-query 5.59, zustand 5.0, lucide-react 0.454, clsx + tailwind-merge (`cn`), class-variance-authority, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-label, @radix-ui/react-slot, react-hook-form + @hookform/resolvers, zod, @googlemaps/js-api-loader 2.1.
- **Dev**: vite 5, @vitejs/plugin-react, tailwindcss 4 via `@tailwindcss/vite`, typescript 5.6, eslint 9 (typescript-eslint, react-hooks, react-refresh).
- **Vite config**: alias `@ → ./src`, dev port **5173**, manualChunks: `react`, `router`, `query`.
- **Source size**: 146 TS/TSX/CSS files ≈ 20,857 lines (`src/`): `pages/` 7,896 · `components/` 7,397 · `repositories/` ~3,400 (mock data 1,638) · rest lib/store/hooks/types/config.
- **Directory map**: `src/{components,config,hooks,lib,pages,repositoryies? no — repositories,store,types}` + `App.tsx` + `main.tsx` + `index.css`.
- **UI language**: English (en-IN formatting: `₹` via `Intl.NumberFormat('en-IN', {style:'currency',currency:'INR'})`).
- **Brand**: "SuperBasket" (aria-label `SuperBasket home` in Header).

## 2. Environment & data-source configuration

- `src/config/dataSource.ts`: `VITE_DATA_SOURCE` — `'api'` sets `IS_API=true, IS_MOCK=false`; anything else (default `mock`) → `IS_MOCK=true`. Repos `src/repositories/index.ts` picks `api/*` or `mock/*` implementations at import time.
- `src/lib/apiClient.ts`: base URL `VITE_API_BASE_URL` **default `http://localhost:8000/api/v1`**. Auth token persisted under localStorage key **`sb-token`** as `Bearer <token>` on every request. Throws `ApiError { status, message, errors? }`; parses `{message}`/`{errors}` bodies.
- Other env: `VITE_GOOGLE_MAPS_*` not used directly — Maps public key comes from **`appConfig.maps.public_key`** (backend), Razorpay key likewise from config.
- Persisted localStorage keys: `sb-app` (appStore), `sb-token`, `sb-user` (auth), `sb-recent-searches` (search history, JSON array of terms).
- Mock auth: any credentials work; mock user is **Aarav Sharma** (`authStore` MOCK_USER, `referral_code` present).

## 3. Routing table (`src/App.tsx`)

Single layout route `AppShell` at `/`; all children render inside `<Outlet/>`.

| Path | Component | Auth guard |
|---|---|---|
| `/` (index) | `HomePage` | – |
| `/food` | `FoodPage` | – |
| `/grocery` | `GroceryPage` | – |
| `/rides` | `RidesPage` | – |
| `/restaurants` | `RestaurantsPage` | – |
| `/restaurant/:id` | `RestaurantPage` | – |
| `/stores` | `StoresPage` | – |
| `/store/:id` | `StorePage` | – |
| `/product/:id` | `ProductPage` | – |
| `/search` | `SearchPage` (`?type=food\|grocery\|all`, `?category=`) | – |
| `/cart` | `CartRoute` (`?type=grocery` → GroceryCartPage, default FoodCartPage) | – |
| `/checkout` | `CheckoutPage` | **RequireAuth** |
| `/order-confirmation/:id` | `OrderConfirmationPage` | **RequireAuth** |
| `/orders` | `OrdersPage` | **RequireAuth** |
| `/order/:id` | `OrderDetailPage` | **RequireAuth** |
| `/ride/:id` | `RideDetailPage` | **RequireAuth** |
| `/wallet` | `WalletPage` | **RequireAuth** |
| `/profile` | `ProfilePage` | **RequireAuth** |
| `/profile/edit` | `EditProfilePage` | **RequireAuth** |
| `/profile/addresses` | `AddressesPage` | **RequireAuth** |
| `/profile/payments` | `PaymentsPage` | **RequireAuth** |
| `/auth/login` | `AuthPage` (mode=login) | – |
| `/auth/register` | `AuthPage` (mode=register) | – |
| `/auth/forgot-password` | `ForgotPasswordPage` | – |
| `/auth/reset-password` | `ResetPasswordPage` (`?token=&email=`) | – |
| `*` | `<Navigate to="/" replace/>` | – |

- **`RequireAuth`** (`components/auth/require-auth.tsx`): runs `authStore.initialize()` until `initialized`; while initializing renders 3 skeletons (`h-24`, `h-16`, `h-16`, `rounded-2xl`); if unauthenticated → `<Navigate to={`/auth/login?redirect=${encodeURIComponent(pathname+search)}`} replace/>`.
- Note: `auth/forgot-password` route path in router is `auth/forgot-password`, but the AuthPage's "Forgot Password?" link points to `/auth/forgot-password` (same). There is no `/auth/otp` route — OTP is a mode inside `AuthPage`.

## 4. Navigation model

**Bottom nav** (`layout/BottomNav.tsx`) — fixed bottom, `md:hidden`, white/95 + blur, `pb-safe`, active top indicator bar.

| Label | Route | Icon | match prefixes | Auth-only |
|---|---|---|---|---|
| `Home` | `/` | `Home` | `/`, `/food`, `/grocery`, `/restaurant`, `/store` | – |
| `Orders` | `/orders` | `ReceiptText` | `/orders`, `/order` | – |
| `Rides` | `/rides` | `Car` | `/rides`, `/ride` | – |
| `Wallet` | `/wallet` | `Wallet` | `/wallet` | yes |
| `You` | `/profile` | `CircleUser` | `/profile` | yes |

- Auth-only items are shown anyway when the current path matches (`!i.auth || isAuthenticated || path matches`).
- Active item: `text-ink-900` + `scale-110` icon (`strokeWidth 2.4`) + `h-1 w-8` indicator tinted with `theme.solid.split(' ')[0]` (service accent derived from route: `/grocery*` → grocery, `/rides*|/ride*` → rides, else stored service). Inactive: `text-neutral-400`, strokeWidth 2.
- **Top-level routes** (`TOP_ROUTES` in Header + AppShell): `['/', '/food', '/grocery', '/rides']` — these get the themed band + module switcher + search; every other route gets the plain dark (`bg-ink-900`) header without switcher/search.

## 5. App shell (`layout/AppShell.tsx`)

- Root div: `flex min-h-dvh flex-col`, background **`bg-grocery-50`** when pathname starts with `/grocery` or `/store`, or `/cart?type=grocery`; otherwise **`bg-ink-50`**.
- `data-service-theme={topTheme}` where `topTheme = TOP_ROUTES.includes(pathname) ? routeTheme(pathname) : undefined` (`'neutral' | 'food' | 'grocery' | 'rides'`). This attribute drives every `--hero-*` variable in `index.css`.
- **Header hidden** when `pathname === '/cart' && params.get('type') === 'grocery'` (grocery checkout renders its own compact header).
- `<main>`: on `/` → `w-full flex-1 md:pb-12` (page owns full-bleed hero canvas); otherwise `mx-auto w-full max-w-5xl flex-1 px-[var(--page-gutter)] pb-28 pt-4 md:pb-12`.
- Renders `<BottomNav/>` always.

## 6. Header (`layout/Header.tsx`)

- `sticky top-0 z-40 text-white shadow-[0_2px_16px_rgb(0_0_0/0.28)]`; background class `hero-header-bg` on TOP_ROUTES else `bg-ink-900`.
- Inner container: `mx-auto max-w-5xl px-[var(--page-gutter)] pt-2.5`.
- Row 1: `BrandLogo` (size `sm`, tone `light`, responsiveText, link `/`, aria `SuperBasket home`) → location button → actions.
- **Location button** (aria `Change delivery location. Currently {label}, {address}`): opens `LocationSelector`.
  - Non-grocery: filled `MapPin` (`strokeWidth={0} fill="currentColor"`, white on top routes / `theme.strong` elsewhere), label line `text-sm font-bold` + `ChevronDown`, second line `hero-muted text-[11px]` = address.
  - `/grocery`: white medallion `h-7 w-7 rounded-full bg-white text-grocery-700`, then `<GroceryEtaRow/>` (real nearest-store ETA) above the `label · address` line (`text-[12px]`).
- **Actions**:
  - Cart `Link /cart` — hidden on `/` and on `/rides*`/`/ride*` (aria `Cart, {n} items`), badge `hero-badge` (top routes) or `theme.solid` first class, `h-4 min-w-4 rounded-full text-[10px] font-bold animate-pop`. Count = `foodCount + groceryCount`.
  - Notifications button (aria `Notifications`) — hidden only on `/`; `Bell` with `h-2 w-2 bg-danger ring-2 ring-ink-900` dot. Non-functional (no sheet wired in Header).
  - Avatar `Link` to `/profile` when signed in else `/auth/login` (aria `Account`), `ring-2 ring-white/20`, `Avatar size="sm"` with initials (Guest fallback).
- Row 2 (TOP_ROUTES only): `<ServiceModuleSwitcher/>` in `pt-2 pb-4`, then `<SearchBar variant="brand"/>` in `relative z-30 pb-3`.
- **Grocery category override**: if `pathname === '/grocery'` and `?category=<id> > 0` → renders `GroceryCategoryHeader` instead (compact back/search/share/cart header) + `LocationSelector`.

## 7. Service module switcher (`service/service-module-switcher.tsx`)

- `<nav aria-label="Services" class="module-tabs">` — 3 equal columns (`grid-template-columns: repeat(3, minmax(0,1fr))`, `padding-inline: 3%`).
- Tabs drawn as **inline SVG silhouettes** (not clip-path), `viewBox={isActive ? '-18 0 136 100' : '-12 0 124 100'}`, `preserveAspectRatio="none"`, class `module-background`, `width:116%`, `left:-8%`. Active path (flared, wider):
  `M 22 1 H 78 C 89 1 94 7 96 18 L 101 66 C 103 83 111 94 118 98 C 111 100 103 100 94 100 H 6 C -3 100 -11 100 -18 98 C -11 94 -3 83 -1 66 L 4 18 C 6 7 11 1 22 1 Z`
  Idle path (tapered):
  `M 19 1 H 81 C 91 1 96 8 97 19 L 105 100 H -5 L 3 19 C 4 8 9 1 19 1 Z`
- Each tab: icon (`UtensilsCrossed` Food / `ShoppingBasket` Grocery / `Car` Rides) + label; classes `.module-tab`, `.active`, `.has-badge` (optional `time-badge` — currently no service sets `badge`).
- Active follows **URL** via `activeService(pathname)`: `/`→null (no active), `/food*`→food, `/grocery*`→grocery, `/rides*`→rides.
- Click: `setService(value)` (persists) then `navigate(SERVICE_ROUTES[value])`; if already on that route, no navigation.
- aria: `aria-pressed`, `Open {label}`.

## 8. Search bar (`service/search-bar.tsx`)

- Variants: **`dark`** (translucent `bg-white/10 ring-white/20 backdrop-blur`), **`brand`** (solid white `rounded-2xl shadow-[0_6px_18px_-8px_rgb(0_0_0/0.35)]` — used on themed band), **`light`** (`rounded-full border-neutral-200 bg-neutral-50`).
- Renders as `Link` to **`/search?type={service}`** (`service = activeService(pathname) ?? storedService`).
- Placeholder text = `theme.searchPlaceholder`:
  - Food: `Search for restaurants, dishes or cuisines`
  - Grocery: `Search for atta, dal, coke and more`
  - Rides: `Search destinations & places`
- Height `h-12`; left `Search` icon; right mic button (aria `Voice search`, `h-9 w-9`), tint `hero-search-accent` (brand variant) or `theme.solid` (dark). Mic only calls optional `onMic` prop (no speech recognition implemented).

## 9. Service theme system (`service/service-theme.ts`)

`SERVICE_THEMES: Record<ServiceType, ServiceTheme>`:

| key | label | icon | solid | soft | strong | gradient | descriptor | searchPlaceholder |
|---|---|---|---|---|---|---|---|---|
| food | `Food` | `UtensilsCrossed` | `bg-food-600 text-white` | `bg-food-50` | `text-food-600` | `from-food-500 via-food-600 to-food-700` | `Meals from restaurants` | `Search for restaurants, dishes or cuisines` |
| grocery | `Grocery` | `ShoppingBasket` | `bg-grocery-500 text-ink-900` | `bg-grocery-100` | `text-grocery-700` | `from-grocery-300 to-grocery-500` | `Daily essentials` | `Search for atta, dal, coke and more` |
| rides | `Rides` | `Car` | `bg-brand-700 text-white` | `bg-brand-50` | `text-brand-700` | `from-brand-700 to-brand-900` | `Book a ride` | `Search destinations & places` |

- Also per theme: `activeText` (`text-white` / `text-ink-900` / `text-white`), `activeMuted` (`text-white/75` / `text-ink-900/70` / `text-white/75`), `activePlate` (`bg-food-800/50` / `bg-ink-900/10` / `bg-brand-950/45`), `idlePlate` (`bg-white/10` all), `activeIndicator` (`bg-white`/`bg-ink-900`/`bg-white`), `iconActive` (`text-food-200`/`text-grocery-300`/`text-brand-100`), `iconIdle` (`text-food-400`/`text-grocery-400`/`text-brand-300`), `badge?` unset.
- `SERVICE_ROUTES = { food:'/food', grocery:'/grocery', rides:'/rides' }`.
- `serviceTheme(service)`, `activeService(pathname)` (URL-authoritative), `routeTheme(pathname)` → `ServiceThemeId = 'neutral' | ServiceType`.

## 10. Location selector (`layout/location-selector.tsx`)

BottomSheet titled **`Choose your location`**.

- Search input: placeholder `Search for an area, street…`, aria `Search location`; triggers server search when `query.trim().length >= 2` (query key `['location-search', query]`, staleTime 30s) via `repositories.user.searchPlaces(query)`.
- Amber notice when `fallback === true`: `Address search is temporarily using a fallback service. Results may be less accurate.` (icon `Info`).
- Empty server result (≥2 chars): `No matching locations found.`
- Section **`Search results`** (uppercase heading): rows from `searchPlaces` → `pick({label: r.main, address: r.text, ...})`.
- **Use current location** button (`LocateFixed`/`Loader2`, `bg-brand-600` icon plate): sub-labels `Use current location` / `Precise delivery estimates`. Calls `currentLocation()` then `repositories.user.reverseGeocode` → label `Current location`, address `` `${street ?? address}, ${city}` ``; toast `Location updated` (fallback toast `Location updated (no address details)`). Errors: `GEOLOCATION_MESSAGES[1..3]` or `Could not fetch your location`.
- **Saved addresses** (authenticated): merged list of user addresses (`key: address-{id}`, icon `Briefcase` when label==='Work' else `Home`) + ride saved places (`key: saved-place-{id}`), heading `Saved addresses`. Not deduped.
- **Popular areas**: `POPULAR_AREAS` (Connaught Place, Karol Bagh, Saket, Lajpat Nagar, Vasant Kunj — all New Delhi), heading with `MapPin` `Popular areas`.
- No results at all with query: `No areas found for "{query}". Try a nearby landmark.`
- Footer link: `Reset to default location` → `DEFAULT_LOCATION`.
- Selecting calls `appStore.setLocation(loc)` and closes.

## 11. MapPicker (`components/map/MapPicker.tsx`, 473 lines)

Full-screen-in-modal map editor used by **Addresses** (and any place needing precise pin).

- Props: `publicKey, initialLatitude, initialLongitude, initialAddressLine1?, initialCity?, countryCode?, onSelected(place), onCancel`.
- `SelectedPlace = { label, address_line_1, city, state, postal_code, country, latitude, longitude, place_id?, formatted_address?, locality?, area?, provider? }`.
- Loads Google Maps JS via `loadGoogleMaps(publicKey)` (toast `Could not load Google Maps` on failure). Map: zoom 15, no mapType/fullscreen/streetView controls, **draggable marker** + click-to-pin.
- Reverse geocode debounced **450 ms** → `repositories.user.reverseGeocode(lat,lng)`.
- Address search debounced **350 ms**, min 2 chars, `AbortController` cancellation → `repositories.user.searchPlaces(term, countryCode)`; empty → `No matching locations found.`; error → toast `Address search is unavailable. Please try again.`; fallback notice as in §10.
- Choosing a result sets coords, then hydrates details via `repositories.user.placeDetails(id)` (best-effort).
- `My location` button (`LocateFixed`) — geolocation errors map: 1 `Location permission denied. Please enable location access in your browser settings.`, 2 `Your location could not be determined. Please try again or pick a point on the map.`, 3 `Location request timed out. Please try again or pick a point on the map.`, plus `Location services are not supported on this device.`
- Resolved address box; hint text: `Drag the pin or click anywhere on the map to set the exact location.`
- Buttons: `My location`, **`Use this address`** (`bg-brand-600`), `Cancel`. Confirm guard toast: `Pick a location on the map or use your current location`.
- `confirm()` emits `label` = `resolved.street || resolved.address || initialAddressLine1 || 'Delivered here'`, `address_line_1` fallback `'Selected location'`.

## 12. Location & geo libraries

**`lib/location.ts`**
- `DEFAULT_LOCATION`: label `Home`, address `12 MG Road, New Delhi`, lat 28.6139, lng 77.209.
- `POPULAR_AREAS`: Connaught Place (28.6315,77.2167), Karol Bagh (28.645,77.19), Saket (28.5245,77.206), Lajpat Nagar (28.567,77.244), Vasant Kunj (28.545,77.178).
- `currentLocation()`: geolocation, `enableHighAccuracy:false, timeout:8000, maximumAge:60000`. Errors: code 1 `Location permission denied. Please allow location access in your browser settings and try again.`, 2 `Your device could not determine your location. Please try again or pick an area manually.`, 3 `Location request timed out. Please try again or pick an area manually.`; unsupported → `Location services are not supported on this device.` Success label `Current location`, address = `lat.toFixed(4), lng.toFixed(4)`.

**`lib/geo.ts`**
- `parseCoordinate`, `hasValidCoordinates` (non-zero pair), `haversineKm(a,b)`, `formatDistanceKm(km)` (e.g. `<1 km` → `~800 m` style), `estimateDeliveryMinutes(km)` (speed assumption + floor), `coordsKey(loc)` → `"lat,lng"` rounded, `nearestEligibleStore(stores, coords, opts)` returning `RankedStore[]` sorted by distance with eligibility filter (delivery-radius/open checks), used by grocery nearest-store flow (query staleTime 5 min).

---

## 13. Home page (`/` → `pages/home.tsx`, 93 lines)

Pure promotional landing — **no discovery data** (no restaurants/grocery/recent fetched here).

- Three independent banner queries, each keyed by placement: `['banners','home_hero']`, `['banners','home_promo']`, `['banners','home_restaurant_promo']` → `repositories.banners.getByPlacement('all', <placement>)`.
- Structure: `<HomeHeroCanvas>` → `space-y-3`:
  1. `loading` → `HomeSkeleton` (HeroSkeleton `size="hero" contained` + 3 translucent promo placeholders `bg-white/12`).
  2. Hero → `<HeroCarousel banners size="hero" contained accentClassName="bg-white" ctaClassName="hero-cta"/>` (only if non-empty).
  3. `<PromoCards banners={home_promo}/>` (3-col grid).
  4. `<RestaurantPromos banners={home_restaurant_promo}/>` (carousel/grid).
  5. All-empty fallback card: **`Your city, one home screen.`** / `Food, groceries and rides — delivered to your doorstep.` (white/10 rounded box).

## 14. Home components (`components/home/`)

**`HomeHeroCanvas`** (38): full-bleed `.hero-bg` wrapper; inner `px-[var(--page-gutter)] pb-5`; tail `hero-fade h-8 rounded-b-[1.5rem]` fades into `ink-50`.

**`HeroCarousel`** (210) + `HeroSkeleton`:
- Sizes/aspect: `hero: aspect-[4/3] sm:aspect-[21/9]`, `large: 16/9 → 21/9`, `default: 16/10 → 21/9`.
- Horizontal snap scroller (`scroll-snap-x`, `edge-bleed` unless `contained`), slide width `min(92vw,640px)` or 100% contained.
- Autoplay every **4500 ms** (paused on pointer-down, disabled when `prefers-reduced-motion` or ≤1 slide).
- Per slide: media (`media_type==='video'` → muted loop playsInline autoplay `<video>` with poster, falls back to `<Image>` on error), gradient overlay `from-ink-950/90`, bottom block with `cta_text` pill (default `bg-white/90 text-ink-900`), `title` (`text-xl/2xl`…), `subtitle` line-clamp-2. Click → `navigate(bannerRoute(b))`.
- Dots: `h-1.5`, active `w-5` + accent class, aria `Go to slide {n}`.

**`PromoCards`** (107): `grid grid-cols-3 gap-2 sm:gap-3`, `aria-label="Promotions"`. Each card `hero-surface` + `ring-white/20` rounded-2xl, aspect-4/3 image (or placeholder), service chip labels: food→`Food` `bg-food-600 text-white`, grocery→`Grocery` `bg-grocery-500 text-ink-900`, rides→`Rides` `bg-brand-700 text-white`, all/other→`General` `bg-white/20 text-white`. Chip row: `Tag` + `cta_text`; then `title` (2-line clamp) + `subtitle` (1-line). Click → `bannerRoute(b)`. Empty → null.

**`RestaurantPromos`** (80): `aria-label="Featured Restaurant Offers"`, heading **`Featured Restaurant Offers`** + mobile hint `Swipe`. Phone: snap carousel `w-[78vw] max-w-[330px]`; `sm+`: grid 2 cols, `lg`: 3. Cards `hero-surface` with image, gradient, chip **`Restaurant offer`** (`bg-food-600`), `cta_text` pill, `title`, `subtitle`. Empty → null.

**`SectionHeader`** (53) + `Rail` (48): title `text-[17px] font-extrabold` with optional `Icon` (`text-accent-500`), subtitle `text-xs text-neutral-500`, right `Link` `See all` + `ChevronRight` (actionLabel default `See all`). `Rail`: `edge-bleed -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar scroll-snap-x`.

**`QuickActions`** (65): `aria-label="Services"`, 3 gradient cards (`theme.gradient`):
| service | tag | desc | cta | icon |
|---|---|---|---|---|
| food | `30 min` | `Meals from top restaurants` | `Order food` | `UtensilsCrossed` |
| grocery | `15 min` | `Daily essentials, fast` | `Shop now` | `ShoppingBasket` |
| rides | `5 min` | `Anywhere, in minutes` | `Book a ride` | `Car` |
(Note: component exists but Home page does not currently render it.)

**`CategoryRail`** (48): 72px tiles, `h-16 w-16 rounded-2xl` image + 2-line label; link per service: grocery → `/search?type=grocery&q={name}`, else `/restaurants?cuisine={name}`.

**`PromoRail`** (68): `Offer[]` cards `w-[248px]` with left service-color bar, service icon plate, `tag` chip, `title`, `subtitle`, `code` (dashed box, click → toast `` `Code {code} copied to clipboard` ``) or `TicketPercent` `Tap to explore` (click → `SERVICE_ROUTES[service]`).

**`MonthlyEssentials`** (143): SectionHeader **`Your Monthly Essentials`**, subtitle `Suggested for you · {n} items to restock` (when >1 qty suggested) else `Based on your previous purchases`, icon `Sparkles`, link `/grocery`. Cards `w-[184px]`: image (essential badge), discount chip, name, price, `AddToCartControl`; footer button `aria-label="Add all monthly essentials to cart"` with `Check`/`Plus` + `CalendarClock` last-purchased label (`today`/`yesterday`/`{n} days ago`/`{n} mo ago`).

## 15. Food page (`/food` → `pages/food.tsx`, 169 lines)

Queries: `['food-home'] → repositories.food.getHome()`, `['food-categories'] → getCategories()`, `['banners','food_home_hero'] → banners.getByPlacement('food','food_home_hero')`.

Order of sections:
1. Hero: `HeroSkeleton size="large"` while loading; `<HeroCarousel banners size="large"/>` in `rounded-3xl overflow-hidden` when present.
2. `<FoodCategories categories loading/>`.
3. `<PromoRail promos={home.promos}/>` when non-empty.
4. `<ExploreMore onSelect={selectFilter}/>`.
5. `<FoodFilterChips active={filter} onChange={selectFilter}/>`.
6. **Popular dishes** — SectionHeader `Popular dishes` / `What everyone is ordering right now` / `Icon=Flame` / `to="/restaurants"`; horizontal `Rail` of `DishCard` (skeleton: 3 × `w-[172px]`).
7. **Deals for you** (if `deals.length>0`) — SectionHeader `Deals for you` / `Discounted favourites, limited time` / `Icon=Tag`.
8. **`#food-feed`** (`scroll-mt-32`) — SectionHeader `Restaurants delivering to you` + subtitle `FILTER_CAPTION[filter]`, `to="/restaurants"`.
   - Empty: `EmptyState` title `No restaurants delivering to you right now` (recommended) else `No restaurants match these filters`, description `Try a different filter or check back shortly.`, icon `Flame`, action `Clear filters` when filtered.
   - Error: `ErrorState` `Couldn't load restaurants` / `We couldn't fetch restaurants right now.` / `Retry`.
   - Grid `sm:grid-cols-2 lg:grid-cols-3` of `FoodRestaurantCard`.

Filter behavior: `selectFilter(f)` toggles (re-selecting active → `recommended`), then smooth-scrolls to `#food-feed`. Filtering runs client-side over `home.recommended` via `applyFoodFilter`.

## 16. Food components (`components/food/`)

**`FoodCategories`** (62): loading → 6 circle skeletons (`h-[68px]`); empty → null. Rail: leading **`All`** chip (`bg-food-600` circle, `UtensilsCrossed`, aria `All restaurants` → `/restaurants`), then category chips `w-[76px]` circles → `/restaurants?cuisine={name}` (aria `{name} food`).

**`FoodFilterChips`** + `FILTER_LABELS`/`FILTER_CAPTION`/`applyFoodFilter` (`food-filters.tsx`):
- Labels: rating `Top rated`, fast `Fastest delivery`, offers `Free delivery`, veg `Pure veg`.
- Captions: recommended `Handpicked for your delivery location`, rating `Highest rated kitchens first`, fast `Quickest delivery first`, offers `Kitchens with free delivery offers`, veg `Pure veg kitchens only`.
- Sort logic: rating → sort by `avg_rating ?? rating`; fast → sort `avg_delivery_time_min` asc; offers → filter `delivery_fee === 0 || free_delivery_above !== null`; veg → `is_veg === true`.
- Chips row prefixed with uppercase `Filters` label; active chip `border-food-600 bg-food-600 text-white`.

**`ExploreMore`** (43): rail of 4 cards `w-[142px]` (aria `Show {label} restaurants`):
| id | label | caption | icon | tint |
|---|---|---|---|---|
| offers | `Offers` | `Free delivery deals` | `BadgePercent` | `bg-food-50 text-food-600` |
| rating | `Top rated` | `Best rated near you` | `Star` | `bg-success/10 text-success` |
| fast | `Fastest` | `Quick delivery first` | `Zap` | `bg-brand-50 text-brand-600` |
| veg | `Pure veg` | `Veg only kitchens` | `Leaf` | `bg-emerald-50 text-emerald-600` |

**`DishCard`** (83): `w-[172px]` card; square image with `{off}% off` chip (`bg-food-600`) or `Sold out` overlay (`bg-ink-900/45 uppercase tracking-widest`); name 2-line clamp; meta `unit_label ?? Available/Out of stock` + veg mark + `Star In stock`; price + strike MRP; `<AddToCartControl size="icon" type="food">`. Links carry `state={{product,type:'food'}}`.

**`FoodRestaurantCard`** (108): 4:3 cover + gradient; offer chip `Free above ₹{n}` / `Free delivery` (`bg-food-600`); `Heart` fav toggle (local state, aria `Add to favourites`/`Remove from favourites`); `Closed now` overlay; rating chip `★ {x.y}` (`bg-success`); body: name + veg mark, `cuisine_type`, meta row `{n} min` (`Clock`), `Free delivery`/`₹{fee}` (`Bike`), `₹{min}+`, `{n} ratings`.

## 17. Restaurants page (`/restaurants` → `pages/restaurants.tsx`, 59 lines)

- Query `['restaurants', search, lat, lng]` → `repositories.food.getRestaurants({search, latitude, longitude})`.
- H1 **`Restaurants`**, sub `Find something delicious near you.`
- Input placeholder `Search restaurants…` (aria `Search restaurants`).
- States: `CardSkeleton count={6}` · `ErrorState` `Couldn't load restaurants` + `Retry` · `NoResultsState query onClear` · grid `sm:grid-cols-2 md:grid-cols-3` of `RestaurantCard`.
- Ignores `?cuisine=` query param (links from category rails land here but no cuisine pre-filter is applied client-side in this page).

## 18. Restaurant detail (`/restaurant/:id` → `pages/restaurant-detail.tsx`, 303 lines)

Queries: `['restaurant', id] → getRestaurant`, `['menu', id] → getMenu`. Cart via `useCart('food')` for bottom padding.

Layout:
1. Compact header: round `ArrowLeft` back to `/restaurants` (aria `Go back to restaurants`) + truncated name.
2. Cover `aspect-[21/9] rounded-3xl` + gradient; name overlay, `cuisine_type`, `MapPin` address.
3. Info chips: `Star` rating pill (`bg-success`, value via `ratingLabel`, `New` when unrated), `{n} ratings`, `Delivery in {n} min` (`Clock`), `Min order ₹{n}`.
4. Offer strip (if `free_delivery_above`): `BadgePercent` `Free delivery on orders above ₹{n}` (`bg-food-600/10 text-food-700`).
5. Service badges: `Delivery & Pickup` (`Bike`, when `order_type==='both'`), `Dine-in available` (`MapPin`), `Pure veg` (`Leaf`).
6. Sticky filter bar (`top-[4.25rem]`): `Veg`/`Non-veg` toggles (`Leaf`/`Beef`, aria-pressed), divider, `Recommended` chip (if featured), then one chip per menu category → smooth-scroll to `#category-{id}` (`scroll-mt-[7.5rem]`).
7. Menu (`#restaurant-menu`): **`Recommended for you`** section (`is_featured` products), then category sections with header `{name}` + `{n} items`; rows are `ProductListItem` separated by hairlines.
8. Empty menu message: `No items match your search or filters.`
9. Fixed bottom bar (mobile; in-flow `md:`): search input placeholder/aria `Search in {name}` (clear button aria `Clear search`) + `Menu` button (`bg-food-600`) scrolls to menu.
10. `<ViewCartBar type="food" bottomClass="bottom-[calc(7.5rem+…)]"/>`.

Client filters: text query (name/description contains) + veg/nonveg set; categories recomputed with filtered products.

## 19. Restaurant & list components

**`RestaurantCard`** (99): `rounded-2xl` card, `h-36` cover, gradient, always-on offer chip (`Free above ₹{n}` / `Free delivery`, `BadgePercent` with `text-food-600`), `Heart` fav toggle, `Closed now` overlay, `★ {rating}` chip; body: name, veg indicator (`title="Pure veg"/"Non veg"`), `cuisine_type`, `{n} + ratings`, meta `{prep} min` (`Clock`), `Free`/`₹{fee}` (`Bike`), `₹{min}+`/`—` (`MapPin`). `horizontal` variant `w-[248px]`.

**`ProductListItem`** (76): row layout for menu lists — left: veg mark, `{off}% off` chip (`bg-food-600`), name, price + strike MRP, 2-line description, `Out of stock` (`text-danger uppercase`) when unavailable; right: `w-28 sm:w-32` square image (dark overlay when unavailable), `AddToCartControl size="icon"` overlapping bottom (`-bottom-2`), `Customisable` caption when `product_type==='variable'` or has active option groups.

## 20. Stores pages

**`/stores` (`pages/stores.tsx`, 76)**: query `['stores', search, lat, lng] → grocery.getStores`. H1 **`Stores`**, sub `Groceries near you.`, input `Search stores…`. Skeleton `CardSkeleton count={4}`; error `Couldn't load stores` + `Retry`; `NoResultsState`; grid of cards: `h-32` cover, `Store` icon (`text-success`) + name, `Rating`, meta `{Instant delivery · }{Delivery {fee}}`. Links to `/store/{id}`.

**`/store/:id` (`pages/store-detail.tsx`, 76)**: queries `['store', id]`, `['store-products', id] → grocery.getProducts(id, {})`. Back link `ArrowLeft` `Back` (to `/stores`, `text-success`). Cover card: `h-40` image, name, address, `Rating`. Section heading **`Products`**, grid `grid-cols-2 sm:grid-cols-3` of `ProductCard type="grocery" addSize="icon"`. `ViewCartBar type="grocery"`. Error: `Store not found` + action `Go back` (history.back). Page gets `pb-24` when grocery cart non-empty.

## 21. Product detail (`/product/:id` → `pages/product-detail.tsx`, 110 lines)

- **Product comes from router `location.state`** (`{product, type}`) — no fetch. Missing state → `ErrorState` `Product not found` / `` `We couldn't find product #${id}. Browse from a store or search instead.` `` / action `Go to search`.
- Back link: `ArrowLeft Back` → `/stores` (grocery) or `/restaurants` (`text-brand-600`).
- Image card `aspect-[4/3]`: `{n}% off` `Badge variant="danger"` when `compare_at_price > price`; veg/non-veg mark top-right (`title Pure veg / Non-veg`).
- Body: name (`text-xl font-extrabold`), `unit_label`, `Price` (`size="lg"` with compareAt) + inline `AddToCartControl` **unless** `needsOptionSelection(product)` → then `<ProductConfigurator>` instead.
- `Description` card (`Info` icon) when present.
- Meta cards (2-col): `Prep time` `{n} min` (`Clock`), `Tax` `{n}%` (`Tag`, only if `tax_rate > 0`).

## 22. Product components (`components/product/`)

**`ProductCard`** (109) + `discountPercent(p)` helper (exported, used everywhere):
- `discountPercent`: `round((mrp-price)/mrp*100)` when `compare_at_price > price`, else null.
- Card `p-2.5 rounded-2xl`; square image; `{off}% off` chip (`bg-food-600`); brand name (10px uppercase) when present; 1-line name; `unit_label` + veg mark; price + strike; `In stock` (with `Star`) or `Out of stock` (`text-danger`); `AddToCartControl` (size default: grocery → `icon`, food → `md`).
- `horizontal` variant `w-[172px]`.

**`AddToCartControl`** (173): three shapes:
- **Variable/optioned product**: button opens `VariableProductModal` (label: icon `Plus` for `icon` size, `Add +` for compact, `SlidersHorizontal Add to cart` for md). If not selectable → toast `This item is unavailable right now` (error).
- **Qty 0**: add button → `add.mutate({product_id, quantity:1, cart_type})`.
- **Qty > 0**: pill stepper `− qty +` (white pill, `ring-neutral-200`); minus at 0 removes item.
- Tones: grocery `bg-grocery-500 text-ink-900 hover:bg-grocery-400`; food `bg-food-600 hover:bg-food-700`.
- Sizes: icon grocery `h-11 w-11` (plus `h-5 w-5`), icon food `h-8 w-8`; compact `h-8 px-2.5 text-[11px]`; md `h-8 px-3 text-xs`.
- aria: `Add to cart`, `Decrease`, `Increase` (title `Add to cart`).

**`ProductConfigurator`** (333): renders option groups from `activeOptionGroups(product)`.
- Group header: name + `Required` chip (`bg-danger/10 text-danger`) when `min>0`; rule text via `selectionRule`: `Required · choose 1`, `Select up to 1 option`, `Select {n} option(s)`, `Select {min}–{max} options`, `Select up to {max} options`.
- Single-select → radio rows (`role="radiogroup"`, custom circle; grocery `success`, food `food-600`); multi → checkbox rows with SVG tick; unavailable/maxed rows `opacity-40` disabled.
- Collapses groups with >3 values behind `+{n} more` button.
- Validation errors (`role="alert"`): `Please select "{group}".`, `Please select at least {min} option(s) for "{group}".`, `You can select at most {max} option(s) for "{group}".`
- Footer: quantity stepper (aria `Decrease quantity`/`Increase quantity`, min 1), total via `formatCurrency`, CTA **`Add item {total}`** (variant `default` grocery / `accent` food). Success → toast **`Added to cart`**, `onAdded` callback; failure → toast/error text.
- `variant="card"` wraps in `Card` with header `Tag Customize`; `bare` for sheet; `sticky` footer with safe-area padding.

**`VariableProductModal`** (74): `BottomSheet title={product.name}`; header block with image (`h-20/24 rounded-2xl`), veg mark, `{off}% off`, name, price + strike, 2-line description; then `ProductConfigurator variant="bare" sticky onAdded={close}`.

**`SelectedOptionsList`** (78): renders chosen options grouped by `group_name`, inline (single truncated line per group: `Group: opt +₹x · opt`) or list; price suffix via `selectedOptionPrice`.

---

## 23. Search page (`/search` → `pages/search.tsx`, 420 lines)

**Query params**: `?q=` (pre-filled query), `?type=` = `all` | `food` | `grocery` (default `all`).

**State**: `query` (input), `submitted` (executed query), `scope`, `sort` (`relevance` | `rating` | `price_low` | `price_high`), `recent`.

**Recent searches**: persisted in `localStorage` key **`sb-recent-searches`** (JSON array, max 6, dedup case-insensitive). Written on submit and on `?q=` load. Read via `readRecent()`/`writeRecent()`.

**Header**: `h1` **"Search"** (text-xl extrabold neutral-900); subtitle **"Find restaurants, stores, and products instantly."**

**Form**: Input with leading `Search` icon (h-5 w-5 neutral-400), placeholder **"Search food, groceries, products…"**, aria-label `Search`; clear `X` button (aria `Clear`) when non-empty; submit `Button` label **"Search"** (disabled when empty).

**Scope tabs** (`Tabs variant="pill"`): **All / Food / Grocery**.

**Sort row** (only when results exist): `{totalResults} results` + native `<select aria-label="Sort results">` with options **Relevance / Top rated / Price: Low to high / Price: High to low**.

**Idle (no query)** sections:
1. **Recent searches** — `Clock` icon; chips (full-round, white, border-neutral-200, hover `border-brand-300 text-brand-700`).
2. **Popular searches** — `TrendingUp` icon; hard-coded `POPULAR = ['Pizza', 'Biryani', 'Milk', 'Atta', 'Healthy', 'Pasta']` (bg-neutral-100 chips).
3. **Browse categories** — `CategoryBrowse`: `repositories.food.getCategories()` or `grocery.getCategories()` (queryKey `['categories', scope]`), slice 12 (all) / 8; `grid grid-cols-4`, img h-16 w-16 rounded-2xl, link to `/stores` (grocery) or `/restaurants`.

**Grocery scope optimization**: when `scope === 'grocery'` and an active store exists, cross-store discovery is skipped — results come from `useStoreCatalogue(activeStoreId, { search, perPage: 40 })` (products only, sorted locally by price) plus the active store itself. Banner note: `Showing results from your nearest store, {name}` (`Store` icon, `bg-success/[0.06]`).

**Data path**: `repositories.search.search(submitted, scope==='all' ? undefined : scope)` (queryKey `['search', submitted, scope]`), client-side post-filter: products name/description match when `scope==='all'`; `food` drops stores; `grocery` drops restaurants; rating/price sorts applied to arrays.

**States**: loading `CardSkeleton count={4}`; error `ErrorState title="Search failed"` with description **"We couldn't load products from your nearest store. Try again."** (grocery-scoped) or **"Something went wrong while searching. Try again."** + action **Retry**; empty `NoResultsState query onClear`.

**Result groups** (`ResultGroup`, titles **Restaurants / Stores / Products**):
- `FoodResultCard` → `/restaurant/{id}`: Card p-3, cover img h-16 w-16 rounded-2xl, name + veg mark (border-success square), `cuisine_type`, `Rating`, `ChevronRight` (h-4 neutral-300).
- `StoreResultCard` → `/store/{id}`: same layout, `Store` icon (text-success) instead of veg mark, address line.
- Products → `ProductCard type={grocery|food}` in `grid-cols-2 sm:3 md:4`.
- Per-group empty text: **"No restaurants found" / "No stores found" / "No products found"** (or `No matches at {store}`), shown with `Package` icon card.

**Icons**: `Search, X, Clock, TrendingUp, ChevronRight, Store, Package`.

## 24. Grocery landing page (`/grocery` → `pages/grocery.tsx`, 431 lines)

**Concept** (file header): user location → nearest eligible store → ACTIVE STORE → store categories → store products → cart → checkout. Exactly one active store; every section scoped to it. `?category=<id>` switches to the category screen (Section 26).

**Hooks**: `useActiveGroceryStore()` (`activeStore, activeStoreId, distanceKm, isLoading, isError, refetch`), `useStoreCatalogue(activeStoreId, { perPage: 60 })`, `useGroceryCategories(stockedCategoryIds)`, `useQuery(['grocery-home'], repositories.grocery.getHome(), staleTime 5min)`.

**Active-store branches**:
- error → `ErrorState` **"Couldn't load grocery stores"** / "Please check your connection and try again." / **Retry**.
- loaded & none → `Skeleton h-28` + `EmptyState` icon `Store`, **"No grocery stores available near you"**, desc **"Try changing your delivery location."**, action **"Change location"** (opens `LocationSelector`).
- loading & none → skeleton strip (`h-11` + `h-24` rounded-2xl).

**Body order** (only when `activeStore`, and only when no category selected — strips hidden on category screen):
1. `CategoryCarouselSkeleton` / `ErrorState` "Couldn't load categories" / `EmptyState` `Tags` **"No categories available"** ("Grocery categories have not been added yet. Products are still listed below.") / `<CategoryCarousel>`.
2. Promotions: `HeroCarousel banners` if any, else `PromoRail promos` (filtered `service === 'grocery'`). Banners filtered to active store: `target_type==='store'` must equal `activeStoreId`; `target_type==='product'` must be in store's product ids; others kept.
3. **"Frequently bought"** shelf (`subtitle` "From your recent grocery orders", `buyAgain.slice(0,10)` via `productsOfStore(..., activeStoreId)`).
4. `CategoryGrid title="Grocery & Kitchen"` (`subtitle` `{n} categories`) for non-grouped categories, then one `CategoryGrid` per backend parent section (`title={parent.name}`, `subtitle="More from {name}"`). Grouped parent ids excluded from unified grid.
5. Anchor `<div id="grocery-catalogue" className="scroll-mt-32" />`.
6. If category selected → `<GroceryCategoryView key={selectedCategoryId}>` (remount resets filters).
7. Else catalogue error → `ErrorState` **"Couldn't load this store's products"** (`We're having trouble loading the catalogue for {store}. Try again.` / **Retry**); else shelves:
   - **"Deals for you"** / `Discounted picks at {store}` (sorted by `discountPercent` desc, ≤12) + `SeeAllProductsLink` → `/search?type=grocery`.
   - **"Recommended for you"** / "Popular at this store" (`is_featured`, fallback first 12).
   - **"Recently viewed"** (if any).
   - One shelf per product category: `title={category.name}`, `subtitle="{n} item(s)"`.
   - `<StoreTerms>` footer card.
8. `<ViewCartBar type="grocery" />` + `<LocationSelector>`.

**Page skeletons**: `CategoryCarouselSkeleton` (6× `w-[74px]` circle h-16 + line), `CategoryGridSkeleton` (8 tiles, `border-grocery-200`).

**`StoreTerms`** card (`rounded-2xl border-grocery-200 shadow-card`): `Rating`; `{distance} away` (`Truck`, success) via `formatDistanceKm`; `Min order ₹{n}` (`PackageOpen`) when >0; `Delivery ₹{n}` (`TagIcon`) or **"Free delivery"** (success) when 0.

**Category selection**: `selectCategory(id|null)` mutates `?category=` search param (URL is the state).

## 25. Grocery components (`components/grocery/`)

### `grocery-header.tsx` (166 lines)
- **`GroceryEtaRow`** — top-band ETA on `/grocery`: `useActiveGroceryStore` → `estimateDeliveryMinutes` + `formatDistanceKm`. Text **"Delivery in {eta} min"** (white extrabold, `Clock` icon `text-grocery-200`) + `{distance}` (`Navigation`, 12px grocery-200); fallback **"Delivery times"**; loading = pulsing `h-4 w-28 bg-white/70` bar. Light text for the dark bronze grocery band.
- **`GroceryCategoryHeader`** — sticky (`top-0 z-40 border-b border-grocery-200 bg-grocery-100/95 backdrop-blur`) header for `?category=` screens. Row: back `ArrowLeft` (aria `Back`; history-aware `goBack()` → `navigate(-1)` or `/grocery` on deep link), `h1` = category name from `useGroceryCategories` (fallback **"Grocery"**), search `Link` to `/search?type=grocery` (aria = theme searchPlaceholder), conditional `Share2` button (`navigator.share({title, url})`, aria `Share`), cart `Link` to `/cart?type=grocery` (aria `Cart, {n} items`, count badge `bg-ink-900 animate-pop`), `Avatar` → `/profile` or `/auth/login` (ring-2 `ring-grocery-200`). Row 2: location button (aria `Change delivery location`) — `MapPin` (grocery-700 filled) + **"Delivering to"** + `{label}` bold + `· {address}` + `ChevronDown`; opens `LocationSelector`.

### `store-context.tsx` (89 lines)
- **`StoreContext`** — single-row pill card (`border-grocery-200 shadow-card`): `Store` icon tile (grocery-100/700), loading pulse `h-3.5 w-44`; else **"Shopping from "** + `{store.name}` extrabold; right: `{distance}` (`Navigation` grocery-700), `{eta} min` (`Clock`, only when `supports_instant_delivery`), status pill **Open** (`bg-emerald-50 text-emerald-700`, dot `bg-emerald-500`) / **Closed** (`bg-red-50 text-red-700`, dot `bg-red-500`), `Details` link → `/store/{id}` (`ChevronDown` rotated -90°).
- **`SeeAllProductsLink({count, to})`** — pill link **"See all products"** + `ChevronRight` (grocery-700, border-grocery-200); null when count 0.

### `category-browser.tsx` (164 lines)
- **`CategoryCarousel`** — `Rail gap-2.5` of `w-[74px]` tiles: leading **"All"** tile (`✦` glyph, active `bg-grocery-500 text-ink-900 ring-grocery-500 shadow-pill`), then category circles (h-16 w-16, `Image object-contain p-1`, active `ring-2 ring-grocery-500 shadow-pill`), labels 11px line-clamp-2, `aria-pressed`.
- **`CategoryGrid({title='Shop by category', subtitle})`** — `grid-cols-4 sm:5 md:6 lg:8`, tiles `rounded-2xl border bg-white p-2`, aspect-square image `rounded-xl bg-ink-50`, active `border-grocery-500/60 shadow-pill`, labels 11px line-clamp-2.

### `product-shelf.tsx` (77 lines)
- **`ProductShelf`** — section header `h2` 17px extrabold `text-ink-900` + optional `subtitle` 12px + optional `action` node; content `Rail` of `ProductCard type="grocery" horizontal`; loading = 4× `Skeleton h-[248px] rounded-2xl`; hidden when empty.
- **`ProductGrid`** — responsive grid `grid-cols-2 sm:3 lg:4` of `ProductCard type="grocery" addSize="icon"`; 6 skeleton tiles when loading; hidden when empty.

## 26. Grocery category screen (`/grocery?category=<id>` → `components/grocery/category-view.tsx`, 736 lines)

Shown by `GroceryPage` when `?category=` is present; page renders `GroceryCategoryHeader` and hides the home strips. Mounted with `key={selectedCategoryId}` so local filter state resets per category.

**Local state**: `sort` (`name` | `price_asc` | `price_desc` | `discount`), `veg` (`all` | `veg` | `nonveg`), `brandId`, `offersOnly`, `pageSize` (24, grows by 24), `sheet` (`filters` | `sort` | `veg` | `brand` | null).

**Data**: `useStoreCatalogue(store.id, { categoryId, perPage: pageSize, isVeg })` — `is_veg` is the only filter sent server-side; brand/offers/sort applied client-side to the fetched page. Category tree from props (`findGroceryCategory`, `buildCategoryRail`).

**Filter bar** (`CategoryFilterBar`, horizontally scrolling `edge-bleed` strip of `FilterChip`s):
- `SlidersHorizontal` **"Filters"** / **"Filters ({n})"** when `activeCount>0`
- `ArrowUpDown` sort label (current option; active when ≠ name)
- `Leaf` **Type / Veg / Non-veg** (only if any product has `is_veg !== null`)
- `Tag` brand label or **"Brand"** (only if brands exist)
- toggle **"Offers only"** (only if any product has a discount)

**BottomSheets**: **"Filters"** (helper "Only the filters this category's data supports are listed here."; rows **"Discounted items only"** hint "Items that have a real compare-at price", **"Veg only"** hint "Filtered by the is_veg field on the product", **"All brands"**; footer **"Clear all filters"**); **"Sort by"** — **Name (A to Z) / Price: low to high / Price: high to low** + **Biggest discount** (when offers exist); **"Type"** — **All items / Veg / Non-veg**; **"Brand"** — **"All brands"** + each brand name. Radio-style `OptionRow`.

**Left rail** (`CategoryRail`, `w-[92px] sm:124 lg:176`, sticky `lg:top-28`, `max-h-[68dvh]` scroll box): leading **All** button (`LayoutGrid`), then categories with image or `Tags` fallback icon; active = `bg-grocery-100` + left grocery-600 bar; children indented (`pl-3`). 8-item skeleton while loading.

**Hero** (`CategoryHero`): prefers banner with `placement === 'grocery_category'` (img `h-28 sm:h-36` + gradient + grocery-500 uppercase CTA pill from `banner.cta_text`, title/subtitle card) else compact header: category image `h-14 rounded-xl` or `Tags` tile, `h1` name, 2-line description, count label **"{n} item(s) at {store}"** (11px grocery-700).

**Product grid**: `grid-cols-2 sm:3 lg:4 xl:5` of `GroceryProductCard` — `rounded-xl border p-1.5 shadow-card`; square `object-contain` image; `{off}% off` badge (`bg-success`, top-left); brand 9px uppercase; 2-line name; `unit_label` + `VegMark` (3×3 border-success/danger square with dot, aria `Veg`/`Non-veg`); `Price` with compare-at; **"In stock"** (success) / **"Out of stock"** (danger); `AddToCartControl productId type="grocery" size="icon"` bottom-right.

**Pagination**: button **"Show more products ({n} left)"** (`border-grocery-300 text-grocery-700`) when `products.length < total`.

**States**: loading `ProductGridSkeleton` (10 cards); error `ErrorState` **"Couldn't load this category"** (`We're having trouble loading products from {store}. Try again.` / **Retry**); empty `EmptyState` icon `PackageOpen` **"No products available in this category"** — with filters: desc **"No products match the filters you picked. Try clearing them."** action **"Clear filters"**; without: desc **"{store} has no products in this category right now."** action **"Browse all categories"**.

**Brand safety**: if the selected brand disappears from results, `activeBrandId` resets to null so the grid never empties silently.

**Icons**: `ArrowUpDown, ChevronDown, LayoutGrid, Leaf, PackageOpen, SlidersHorizontal, Tag, Tags`.

---

## 27. Food cart (`/cart?type=food` → `pages/food-cart.tsx`, 941 lines)

**Route switch**: `CartRoute()` — `?type=grocery` renders `GroceryCartPage`, else `FoodCartPage`. On mount `FoodCartPage` sets app service to `'food'`.

**Queries**: `useCart('food')`; `repositories.food.getRestaurant(firstRestaurantId)` (queryKey `['restaurant', id]`); `repositories.food.getMenu(id)` (Key `['restaurant-menu', id]`, flattened to `menuProducts`); `repositories.user.getCoupons()` (Key `['coupons']`, enabled when items exist + authenticated).

**States**: loading = 3 skeletons (`h-24`, `h-40`, `h-24`); error `ErrorState` **"Couldn't load your cart"** / "Something went wrong while fetching your cart." / **Retry**; empty `EmptyState` icon `ShoppingBag` **"Your cart is empty"**, desc **"Add delicious meals from a restaurant to get started."**, action **"Browse restaurants"** → `/restaurants`.

**Sections (in order, `max-w-2xl` column)**:
1. **`RestaurantContextCard`** — gradient `from-food-600 to-food-700` card: label **"Your cart"** (11px uppercase white/70), `h1` restaurant name, pills `{n} items`, `~{eta} min` (`Timer`), `Min. order ₹{n}` (when >0).
2. **`FreeDeliveryOffer`** — when `free_delivery_above` set: `Gift` tile, **"Special offer for you"** + **"Unlocked"** pill (`CheckCircle2`, success) when reached; locked text `Get free delivery (₹0) on orders above {amount}.`, unlocked text `Free delivery is applied automatically at checkout.`; progress bar (success when unlocked else `bg-food-500`); footer `Add {amount} more to unlock`.
3. **`CartItemsSection`** — header **"Cart items"** + count. `Card divide-y` of `FoodCartLine`: img 72×72 rounded-2xl (`object-cover`), name + `unit_label`, `Trash2` remove (aria `Remove {name}`; hover danger; disabled while busy), inline `SelectedOptionsList` + `selected_addons` line, unit `Price × qty` (busy → `Loader2` brand spinner), `line_total` (md), optional **Edit** pill (`Pencil`, shown only for variable/optioned products) + `QuantityStepper size="sm" tone="food"`.
4. **`EditItemSheet`** — `BottomSheet title={product.name}` wrapping `ProductConfigurator type="food" variant="bare" sticky initialSelections initialQuantity`; `onAdded` compares `optionSignature()` — if config changed, removes old line to avoid duplicates.
5. **`AddMoreItemsLink`** — dashed pill **"Add more items"** (`Plus`, brand-600) → `/restaurant/{id}`.
6. **`PreparationSection`** — `FoodPreparationChips` bound to `cartStore.foodRestaurantNote` / `foodNoCutlery`.
7. **`CompleteYourMeal`** — header **"Complete your meal"**; `Rail` of `w-[150px]` cards (img aspect-square, name, `Price`, `AddToCartControl type="food" size="sm"`); picks available menu products not in cart, featured first, ≤10; hidden if none.
8. **`DeliveryInfoCard`** — `Timer` tile; **"Delivery in ~{eta} min"** or **"Delivery time not available"**; sub **"ASAP · No scheduling available for food"**; right pill **"Delivery"** (brand-50/700).
9. **`CouponsSection`** (title **"Offers & coupons"**) — unauthenticated: **"Apply a coupon"** / "Login to apply coupons and save on this order." / **"Login now"** link. Authenticated: applied row (`Check` success tile, **"Coupon applied"**, code, **Remove** danger) or first 3 coupons (name, description or `Use code {code}`, **Apply** pill `bg-food-600`) + row **"Have a coupon code?"** / **"Change coupon"** (`Tag` tile, `ChevronRight`) opening **BottomSheet "Apply coupon"**: input placeholder **"Enter coupon code"** (uppercase tracking), **Cancel** / **Apply** buttons (accent, spinner while pending), **"Available coupons"** list with code chips + `· Min. order ₹x`. Toasts: **"Coupon applied"** success; error **"This coupon can’t be applied"**.
10. **`AddressSection`** — header **"Deliver to"** + **Change/Choose** button; selected = `cart.address_id` else default; shows `MapPin` (brand), label, **"Default"** pill, formatted address line; busy → `Updating delivery fee...` spinner; empty state button **"Select delivery address"** + **Choose**. Unauthenticated → card with **"Add a delivery address to continue"** + **"Login now"**. BottomSheet **"Select delivery address"**: radio rows (active `border-food-600 bg-food-50`, dot `bg-food-600`), empty text **"No saved addresses. Add one first."**, dashed **"Add new address"** link → `/profile/addresses`. Mutation `useSetDeliveryAddress {addressId, type:'food'}`, error toast **"Could not update delivery address."**
11. **`ContactCard`** — **"Contact"** label, user name, `Phone` `{country_code} {phone}`, `Mail` email (hidden when no user).
12. **`BillCard`** — title **"Bill details"**; rows: **Item subtotal**, **Coupon discount ({code})** (`-₹`, success) when >0, **Taxes** when >0, **Delivery fee** (**"Free"** success when 0), **Packaging charge** / **Handling fee** (when >0), **Delivery GST ({pct}%)** (when >0), divider + **"To pay"** + `cart.total` (md extrabold). All values from backend.
13. **`CheckoutBar`** — fixed bar `bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30` (md: `bottom-0`): `CreditCard` + **"Pay via UPI · Cards · Cash"**, total, `Button variant="accent" size="lg"` **"Checkout"** + `ChevronRight` → `/checkout?type=food`.

**Icons**: `Check, CheckCircle2, ChevronRight, CreditCard, Gift, Loader2, Mail, MapPin, Pencil, Phone, Plus, ShoppingBag, Tag, Timer, Trash2`.

## 28. Grocery cart (`/cart?type=grocery` → `pages/grocery-cart.tsx`, 962 lines)

Blinkit-inspired, presentation-only: cart from `GET /cart?type=grocery`; quantity/coupon/address via cart hooks; all amounts are backend values.

**Queries**: `useCart('grocery')`; store from `items[0].product.store_id` → `repositories.grocery.getStore` (Key `['store', id]`); `['addresses']`, `['coupons']` (auth + items). ETA = `haversineKm(store, selectedAddress)` → `estimateDeliveryMinutes`. Schedule detection via optional `CartSchedule` fields (`delivery_mode==='scheduled'` + `scheduled_at`/`slot_date`).

**States**: 4 skeletons (`h-20/40/24/32`); error `ErrorState` **"Couldn't load your cart"** (same as food); empty `EmptyState` `ShoppingBag` **"Your cart is empty"**, desc **"Add groceries from a store to get started."**, action **"Browse stores"** → `/stores`.

**Sections (`max-w-5xl`, bottom padding clears fixed CTA `pb-[calc(9.5rem+env(safe-area-inset-bottom))]`)**:
1. **`GroceryCheckoutHeader`** — sticky `top-0 z-40 border-b border-grocery-200 bg-grocery-50/95`: back `ArrowLeft` (aria `Back`), `h1` **"Checkout"** + subtitle **"Shipment of {n} item(s)"**, optional `Share2` (aria `Share cart`, title **"My SuperBasket grocery cart"**). No logo/location/store row (presented once below).
2. **`DeliveryGroup`** — Card with `Zap` (ASAP) or `CalendarClock` (scheduled) grocery tile; headline **"Delivery in {n} min"** / **"Scheduled"** / **"Delivery time shown at checkout"**; scheduled sub = localized datetime or `slot_label`/`{day} · {start} – {end}`; ASAP sub = **"Shipment of {n} item(s)"**; store line `StoreIcon` + name (or **"Loading store…"** / **"Your grocery store"**) + `· {km} km`; right pill **"Slot"** / **"ASAP"** (grocery-100/800 uppercase).
3. **`CartItemsCard`** — header **"Shipment of {n} item(s)"**; `GroceryCartLine`: img 72×72 `object-contain`, name + unit, `Trash2` (aria `Remove {name}`, disabled while busy), inline `SelectedOptionsList`, `unit_price × qty` + `{off}% off` (success) when compare-at; busy → `Loader2` grocery spinner else `QuantityStepper size="sm"`; right: `line_total` (14px extrabold), **"MRP ₹{n}"** (compare_at × qty, 11px neutral-400), `{off}% off`.
4. **`YouMightAlsoLike`** — `SectionHeader title="You might also like" to="/grocery" actionLabel="See all products"`; store-scoped `useStoreCatalogue(storeId, {perPage:24})` filtered to available & not-in-cart ≤10; `Rail` of `RecommendationCard w-[132px]` (img with `{off}% off` badge, 2-line name, unit, `Price` w/ compareAt, `AddToCartControl type="grocery" size="sm"`); 3× `h-44 w-[132px]` skeletons; hidden if empty.
5. **`CouponsSection`** (title **"Coupons & offers"**) — same structure as food but `bg-grocery-500 text-ink-900` **Apply** pills, grocery focus rings/colors; applied row shows `· you saved ₹{n}`; free-delivery row **"Yay! You got FREE delivery"** when fee 0; shows first 2 coupons; trigger row **"Apply coupon"** / **"Change coupon"**; sheet titled **"Apply coupon"** with grocery-tinted buttons; same toasts (**"Coupon applied"**, **"This coupon can’t be applied"**); unauthenticated login card link color `text-grocery-700`.
6. **`BillDetails`** — **"Bill details"**: **Items total**, **Coupon discount ({code})** `-₹` success, **Taxes**, **Delivery charge** (busy → `Calculating…`; 0 → uppercase **"FREE"** success), **Delivery GST ({pct}%)**, dashed divider + **"Grand total"** + total (or **"Calculating…"** while `feePending`).
7. **`DeliverToRow`** — **"Delivering to"** + **Clear** (when cart has address) + **Change**; `MapPin` grocery-600, label + **"Default"** pill, address line, busy **"Updating delivery fee…"**; empty button **"Select delivery address"** + **Choose**. Address BottomSheet identical to food but grocery tints (`border-grocery-500 bg-grocery-50`, dot `bg-grocery-600`, **Default** pill grocery-100/800, dashed **"Add new address"** grocery-700); empty text **"No saved addresses. Add one first."**; errors toast **"Could not update delivery address."**
8. **`GroceryCheckoutBar`** — fixed bar (same offset, `border-grocery-200`): `Clock` + **"Total payable"**, total or **"Calculating…"**, full-width `Button` **"Choose address at next step"** + `ChevronRight` (`bg-grocery-500 text-ink-900 h-11 rounded-xl`) → `/checkout?type=grocery`.

**Icons**: `ArrowLeft, CalendarClock, Check, ChevronRight, Clock, Loader2, MapPin, Plus, Share2, ShoppingBag, Store, Tag, Trash2, Zap`.

## 29. View cart bar (`components/cart/view-cart-bar.tsx`, 46 lines)

Floating CTA shown on food/grocery listing pages.

- Hidden unless cart exists and item quantity sum > 0.
- Position: `fixed inset-x-0 z-40 px-[var(--page-gutter)]`, mobile `bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--spacing)*3)]`, `md:bottom-4`.
- Inner `Link to="/cart?type={type}"` `max-w-3xl rounded-2xl px-4 py-3 shadow-float`, tones: grocery `bg-grocery-500 text-ink-900 hover:bg-grocery-400` (chip `bg-ink-900/10`), food `bg-food-600 hover:bg-food-700` (chip `bg-white/20`).
- Content: `{n} item(s)` (sm semibold, left), `formatCurrency(cart.total)` (ml-auto bold), chip **"View Cart"** + `ChevronRight`.
- aria-label: `View cart, {label}, total ₹{total}`.
- Icon: `ChevronRight`.

---

## 30. Checkout (`/checkout?type=food|grocery` → `pages/checkout.tsx`, 473 lines)

**Type**: `?type=grocery` else `food` (`OrderType`). Local state: `selectedAddressId`, `payMethod` (`wallet` | `cash_on_delivery` | `online`, default **`wallet`**), `couponOpen`, `code`, `deliveryMode` (`asap` | `scheduled`), `selectedSlot`.

**Queries**: `['cart', type]`, `['addresses']`, `['wallet']` (`repositories.wallet.getWallet`), `['delivery-slots', storeId]` (`repositories.grocery.getDeliverySlots`, grocery only, storeId from cart item).

**Header**: `h1` **"Checkout"** + subtitle **"Grocery order"** / **"Food order"**.

**States**: 2 skeletons `h-24`; error `ErrorState` **"Couldn't load checkout"** / **Retry**; empty `EmptyState` **"Your cart is empty"** / "Add items before checking out." / action **"Go to cart"**.

**Sections**:
1. **Delivery address** — `h2` **"Delivery address"** + `Plus` **"Add new"** link → `/profile/addresses`. Skeleton `h-20`; empty card `MapPin` **"No saved addresses. Add one first."**; radio rows: label + **"Default"** pill, address line; active row tinted `border-brand-600 bg-brand-50` (grocery) or `border-food-600 bg-food-50` (food) with matching dot. Click → `setSelectedAddressId` + `useSetDeliveryAddress({addressId, type, deliveryMode})`.
2. **`DeliverySlotPicker`** (grocery only) — mode toggle asap/scheduled + slot list (see Section 34). Changing mode calls `applyDeliveryMode` mutation → `setDeliveryAddress({addressId, type:'grocery', deliveryMode: 'instant'|'scheduled'})` to reprice the cart (error toast **"Could not update delivery charges."**).
3. **`PaymentSelection`** — `h2` **"Payment method"**; rows (icon tile 10×10; active = `bg-brand-600`/`bg-food-600 text-white` + tinted border):
   - `WalletIcon` **"SuperBasket Wallet"** — desc `Balance {walletBalance}` or **"Pay from wallet"**
   - `Banknote` **"Cash on delivery"** — **"Pay when you receive"**
   - `CreditCard` **"Card / UPI"** — **"Pay securely online"**
   - each row ends with `ChevronRight` (neutral-300).
4. **`CouponCard`** — button text `Coupon applied: {code}` or **"Apply a coupon"** (`ChevronRight`, brand-700); **"Remove coupon"** (danger) when applied. Opens BottomSheet **"Apply coupon"** (input **"Enter coupon code"**, full-width **Apply**; success toast **"Coupon applied"**, error toast **"Invalid coupon code"**).
5. **`BillSummary`** (title **"Order summary"**) — rows: **Item subtotal**, **Coupon discount** `-₹` (success), **Taxes**, **Delivery fee** (`Calculating...` while pending; `FREE` success when 0 + scheduled, else price), **Packaging charge** / **Handling fee** (when >0, hidden while pending), **Delivery GST ({pct}%)**, divider + **"To pay"** + total (`Calculating...` while pending).
6. **Sticky CTA bar** — `sticky bottom-[4.5rem] z-30 md:bottom-0`: Card with **"Total to pay"** + total (or **"Calculating..."**), `Button` **"Place Order"** (variant `default` grocery / `accent` food; `Loader2` spinner while pending).

**Place order mutation** (`placeOrder`):
- Guards: cart exists; scheduled grocery requires `selectedSlot` (throws **"Choose a delivery slot"**).
- `repositories.orders.createOrder({ order_type, address_id, payment_method, delivery_slot_id?, restaurant_note?, send_cutlery? })` (food note/cutlery come from `cartStore.foodRestaurantNote`/`foodNoCutlery`).
- `online` → `createUsableCheckout(payments.initiate({payable_type:'order', payable_id, payment_method:'card', idempotency_key}), 'checkout:{id}')` → `completeOrderPayment(checkout)` (Razorpay, Section 60).
- Success paths: food → `clearFoodInstructions()`; non-online or paid → toast **"Order placed successfully!"** → `/order-confirmation/{id}`; payment cancelled → toast error **"Payment cancelled. You can pay again from the order page."** → `/order/{id}`; thrown → error toast (message or **"Payment could not be completed."**) → `/order/{id}`. Failure → toast (message or **"Could not place order."**).

**canPlace**: cart has items && `addressId` && (!needsSlot || selectedSlot) && mutation idle.

**Icons**: `Loader2, ChevronRight, MapPin, Plus, Wallet, Banknote, CreditCard`.

## 31. Order confirmation (`/order-confirmation/:id` → `pages/order-confirmation.tsx`, 158 lines)

**Query**: `['order', id]` → `repositories.orders.getOrder`. Sets app service to food/grocery from `order.order_type` (`serviceTheme(service)` for icon colors).

**States**: loading = 2 rounded-3xl skeletons (`h-32`, `h-48`); error `ErrorState` **"Order not found"** + action **"Go to orders"**.

**Hero**: gradient card (`from-success to-emerald-700` grocery / `from-food-600 to-food-700` food): `CheckCircle2` in `bg-white/20` circle, `h1` **"Order confirmed!"**, **"We've received your order."**, `order_number`.

**Order card**: row **"Grocery order"** / **"Food order"** + `Badge` status (variant danger when `CANCELLED` else warning, status text underscores→spaces); item rows (img h-12 w-12, name, compact `SelectedOptionsList`, `{qty} × unit_price`, line_total); divider; **"Total paid"** + `total_amount`; `via {payment_method}` (underscores→spaces).

**Info card** (3 rows, icons tinted `theme.strong`): `MapPin` **"Delivery address"** → `{address_line_1}, {city}` or **"Address on file"**; `WalletIcon` **"Payment"** → capitalized payment method or **"Online"**; `Timer` **"Estimated delivery"** → localized `scheduled_at` when `timing_type==='scheduled'` else hard-coded **"30–40 minutes"**.

**CTA row** (stacked mobile, inline `sm:`): **"Track Order"** + `ChevronRight` (variant accent food / default grocery) → `/order/{id}`; **"View Orders"** (outline) → `/orders`; **"Continue Shopping"** (secondary) → `/`.

**Icons**: `CheckCircle2, MapPin, Wallet, Timer, ChevronRight`.

## 32. Orders & rides activity (`/orders` → `pages/orders.tsx`, 663 lines)

**Header**: `ReceiptText` (brand-600) + `h1` **"Your Orders"**; subtitle **"Track, reorder and review everything you've ordered."**

**Tabs** (`Tabs variant="pill"`): **All / Food / Grocery / Rides** (Food tab gets `bg-food-50 text-food-600` active class). Changing tab clears search.

**Search**: rounded-full input, placeholder **"Search by restaurant or dish"**, aria `Search orders`, `XCircle` clear (aria `Clear search`). Matches `order_number + restaurant/store name + item names`; rides match `ride_number + addresses + driver`.

**Queries**: `['orders']` → `repositories.orders.getOrders({})`; `['ride-history']` → `repositories.rides.getRideHistory()`.

**Mutations**: `reorder(id)` → `repositories.orders.reorder`, toast **"Items added to cart"**, invalidate `['cart']`, hard-navigate to `/cart?type=grocery` or `/cart`; failure toast **"Could not reorder"**. `cancel(id)` → `repositories.orders.cancelOrder(id, 'Customer requested')`, toast **"Order cancelled"**, invalidate `['orders']`; failure **"Could not cancel order"**.

**Empty states**:
- searching → `NoOrdersEmptyState` (`SearchX` tile): **"No matching orders found"** / **"Try a different restaurant, dish or order number."**
- rides tab → `Car` **"No rides yet"** / "Book a ride and it will show up here." / **"Book a ride"** → `/rides`
- food → `UtensilsCrossed` **"No Food orders yet"** / "Start exploring restaurants and place your first order." / **"Order food"** → `/restaurants`
- grocery → `ShoppingBasket` **"No Grocery orders yet"** / "Order groceries from a store near you to see them here." / **"Shop groceries"** → `/stores`
- all → `ReceiptText` **"No orders yet"** / "Your food orders, grocery orders and rides will appear here." / **"Explore food"** → `/restaurants`
- error → `ErrorState` **"Couldn't load activity"** / **Retry**; loading = 3× `Skeleton h-44 rounded-3xl`.

**Status badge map** (`statusVariant`): success = `DELIVERED, TRIP_COMPLETED, PAID, COMPLETED`; brand = `PLACED, CONFIRMED, DRIVER_ASSIGNED, TRIP_STARTED, IN_PROGRESS`; warning = `PREPARING, READY, PICKED_UP, OUT_FOR_DELIVERY, ARRIVED, PARTNER_ASSIGNED, REQUESTING, SEARCHING_DRIVER, DRIVER_ARRIVING, DRIVER_ARRIVED, PENDING`; danger = `CANCELLED, NO_DRIVER_FOUND`; else neutral. Badge text = status with underscores → spaces.

**`OrderCard`** (Card, clickable → `/order/{id}`): outlet img h-14 (`cover_image ?? logo`) or type tile (`UtensilsCrossed` food-50/600, `ShoppingBasket` success/10); outlet name (fallback `order_number`), address + `· ★ {rating}`; **"View menu"** / **"View store"** button (`ChevronRight`); `MoreVertical` menu (aria `Order options`); optional payment-failed banner (`AlertTriangle`, **"Payment failed"**, refund note `Refund of ₹{n} ({status})` or "We couldn't complete your payment for this order."); item list (max `MAX_VISIBLE_ITEMS = 3`, green dot, `{qty} × name`, inline options, `Note: {special_instructions}`), **"+ {n} more items"**; footer: `Order placed on {DD Mon, hh:mm AM}` + status Badge, right total + `ChevronRight`; actions: **Rate** (outline, only when DELIVERED, `Star`) + **Reorder** (`RefreshCw` / `Loader2`, accent for food, default grocery, label **"Reorder"**, busy **"Adding to cart…"**).

**Order options BottomSheet** (title **"Order options"**, `MenuAction` rows): **"View order"** (`Eye`); **"View menu"** / **"View store"** (`MapPin`, only when outlet id exists); **"Rate order"** (`Star`, only `DELIVERED`); **"Reorder"** (`RefreshCw`); **"Cancel order"** (`XCircle`, danger; only when not cancelled and status not in `DELIVERED, ARRIVED, OUT_FOR_DELIVERY, PICKED_UP, PARTNER_ASSIGNED`; busy label **"Cancelling…"**).

**`RideCard`** (→ `/ride/{id}`): `Car` tile (brand-50/700), `ride_number`, `pickup → destination` (fallback **Pickup**/**Drop**), `Driver: {name}` when present, `ChevronRight`; divider; `Ride on {date}` + status Badge; fare `final_fare ?? estimated_fare` + `ChevronRight`.

**`RateSheet`** (BottomSheet **"Rate your order"**): 5 `Star` buttons (aria `{n} stars`; active `fill-warning text-warning`, inactive `text-neutral-200`), textarea placeholder **"Add a comment (optional)"** (rows 3), **"Submit"** button; `repositories.orders.rateOrder(id, rating, comment)` → toasts **"Thanks for your rating!"** / **"Could not submit rating"**.

**On All tab**: first 3 rides shown under heading **"Ride history"**, then order cards.

**Icons**: `UtensilsCrossed, ShoppingBasket, Car, ChevronRight, ReceiptText, Search, MoreVertical, Star, RefreshCw, Loader2, MapPin, Eye, XCircle, AlertTriangle, SearchX`.

---

## 33. Order detail / tracking (`/order/:id` → `pages/order-detail.tsx`, 360 lines)

**Queries**: `['order', id]` (`repositories.orders.getOrder`, retry false) merged with **realtime** `useRealtimeOrder(id)` (live overrides initial) and `useRealtimeTracking(id)`; `['app-config']` → `repositories.user.getAppConfig()` (staleTime 5min) → `maps.public_key` only when `maps.enabled` (else map hidden).

**Flow arrays**: `FOOD_FLOW = PLACED → CONFIRMED → PREPARING → READY → PARTNER_ASSIGNED → PICKED_UP → OUT_FOR_DELIVERY → ARRIVED → DELIVERED`; `SCHEDULED_FLOW = [SCHEDULED, ...FOOD_FLOW]` when status is `SCHEDULED`. Steps built by `buildSteps(ordered, status, isCancelled)`.

**States**: not-found card (`XCircle` danger): **"Order not found"** / **"This order was removed or is no longer available."** / buttons **"Back to orders"** (outline) + **"Try again"** (`RefreshCw`); loading 3 rounded-3xl skeletons (`h-40`, `h-48`, `h-24`).

**Layout (`max-w-2xl`)**:
1. Back link `ArrowLeft` **"Orders"** (brand-600) → `/orders`.
2. **Header card**: `h1` `order_number`, sub `{order_type} · {localized created_at}` (capitalize), `Badge` status (danger cancelled / accent food / brand grocery). Cancelled → banner **"This order was cancelled."** (`bg-danger/10`); else `<StatusTracker steps tone>`.
3. **`OrderTrackingCard`** (only when `tracking && isTrackingActive`): title **"Live tracking"**, sub **"Updates every few seconds"**, ETA `Badge` (accent/brand); `OrderTrackingMap h-56` when `mapsApiKey` else placeholder **"Turn on maps to see your delivery on the way"**; partner row (`UserCircle2` circle tile food-100/700 or brand-100/700): `{partner.name}` + `Vehicle {no}` or **"Delivery partner"**, or **"Assigning a delivery partner…"**; right: `{distance}`, **"Live"** pulsing green dot when live & not stale, **"Location paused"** when stale.
4. **`DeliveryOtpCard`** — active for food/grocery when status ∈ `OUT_FOR_DELIVERY, ARRIVED` and `delivery_otp_verified_at` empty (see Section 34).
5. **Payment cards**: when not cancelled → `CashCollectedCard` if `delivery_payment_collected_at`; else for `online`/`cash_on_delivery` → `PaymentReceivedCard` when paid (`isOrderPaid`) else `PayNowCard`.
6. **Items card** — title **"Items"**; rows img h-14 + name + `SelectedOptionsList` + `{qty} × unit` + line_total; bill rows (`BillRow`): **Subtotal**, **Discount** `-₹` (success, when >0), **Taxes**, **Delivery fee** (`FREE` success when 0+scheduled), **Packaging charge** / **Handling fee** (when >0), **Delivery GST ({pct}%)**, **Total** (extrabold); footer note: **"Paid in cash to your delivery partner"** / **"Cash on delivery · paid online"** / **"Cash on delivery"** / `Paid via {method}`.
7. **`DeliveryScheduleCard`** (grocery only).
8. **Address card** — `MapPin` (food-600 / brand-600), **"Delivery address"**, snapshot `{line1}, {city} {postal}` or **"Address on file"**.
9. **Action buttons** (flex-wrap): **"Cancel order"** (danger, `XCircle`/spinner; when not cancelled & status not in `DELIVERED, ARRIVED, OUT_FOR_DELIVERY, PICKED_UP, PARTNER_ASSIGNED`), **"Reorder"** (outline, `RefreshCw`; toast **"Items added to cart"**, invalidate cart, hard-nav to `/cart`), **"Rate order"** (accent/default; only DELIVERED) → BottomSheet **"Rate your order"** (5 stars aria `{n} stars`, textarea **"Add a comment (optional)"**, **Submit**; toasts **"Thanks for your rating!"** / **"Could not submit rating"**).
10. **Cancel mutation** → `cancelOrder(id, 'Customer requested')` toast **"Order cancelled"**; failure **"Could not cancel order"**.

**Icons**: `ArrowLeft, MapPin, RefreshCw, Star, XCircle, Loader2, UserCircle2`.

## 34. Order components (`components/order/`, 860 lines total)

### `status-tracker.tsx` (150)
`StatusTracker({steps, tone})` — horizontal auto-scrolling stepper (`no-scrollbar touch-pan-x`, `w-24` steps mobile / flex-1 md); scroll-into-center the current step on change. Step states from `buildSteps(ordered, current, cancelled)` → `done` (before current), `current`, `todo` (cancelled ⇒ all todo). Circles: done = solid `bg-food-600`/`bg-brand-600` + `Check` (strokeWidth 3); current = food: solid + white dot + `ring-4 ring-food-600/20`, brand: `border-2 border-brand-600 text-brand-700` showing step number; todo = `border-2 border-neutral-200` + number. Connectors `h-0.5` (`bg-food-500`/`bg-brand-500` done, `bg-neutral-200` todo). Labels 10px (current bold food-700/brand-700; done neutral-600; todo neutral-400); food current adds pill **"Currently in progress"** (`bg-food-50 text-food-600`). `aria-current="step"` on current. Labels = status with underscores → spaces.

### `TrackingMap.tsx` (139)
`OrderTrackingMap({tracking, apiKey})` — Google Maps JS via `loadGoogleMaps(apiKey)` (Section 60). Map: zoom 14, `disableDefaultUI` + `zoomControl`, `clickableIcons:false`, center = pickup else fallback `{lat: 28.6139, lng: 77.209}` (New Delhi). Circle markers scale 9 white stroke: pickup `#16a34a`, partner `#2563eb`, dropoff `#ea580c`; route = decoded `route.polyline` polyline (partner blue, opacity .85, weight 4); `fitBounds` over all points. States: spinner `Loader2 brand-600` while loading; **"Map unavailable"** on error. Redraws markers/route whenever `tracking` changes.

### `delivery-otp-card.tsx` (89)
`DeliveryOtpCard({orderId, active, tone})` — query `['order', id, 'delivery-otp']` → `repositories.orders.getDeliveryOtp`, `refetchInterval` 15s while active, retry false. Null when inactive. Error branch: if message contains **"Ask your delivery partner"** → neutral **"Delivery OTP not ready yet"** + "Your delivery partner will request your code when they arrive."; else amber **"Delivery code unavailable"** + message + **"Try again"** (outline sm). Pending = pulsing placeholder. Success = Card: header `KeyRound` + **"Delivery verification"** + right **"for your order"** (tinted bg-food-50/600 or bg-brand-50/600); body: "Your delivery partner needs this 6-digit code to complete delivery.", label **"Delivery OTP"**, code `text-3xl tracking-[0.3em]` (food-700/brand-700), validity **"Valid until {time}"** or **"This code has expired — ask your partner to request a new one."**, refresh outline button (`RefreshCw`/`Loader2`); footer note "Share this code with your delivery partner to confirm your delivery. Don't share it with anyone else."

### `delivery-schedule-card.tsx` (55)
`DeliveryScheduleCard({order})` — reads `order.meta.delivery_schedule`. Not scheduled → Card `Zap` (brand-600) **"Delivering as soon as possible"** + "We'll notify you when it's on the way." Scheduled → `CalendarClock` + formatted `{weekday, day, month, hour, minute}` from `slot_date`+`start_time` + sub `{label ?? 'Scheduled delivery'} · Scheduled|Confirmed` (by `order.status === 'SCHEDULED'`).

### `delivery-slot-picker.tsx` (182)
`DeliverySlotPicker` — section title **"Delivery time"**; two `ModeOption` cards: `Zap` **"As soon as possible"** / **"Delivered in about 45-60 min"**; `CalendarClock` **"Schedule delivery"** / **"Pick a date and time"** (disabled → **"No slots available"**, opacity-50). Active = `border-brand-600 bg-brand-50`. ASAP mode → Card "Your order will be delivered as soon as it is ready." Scheduled mode: 2× skeleton `h-16`; error `ErrorState` **"Couldn't load delivery slots"** / **Retry**; empty `EmptyState` **"No delivery slots available"** / "This store has no open slots right now."; else date chips row (`min-w-[84px]`, weekday short + `day month`) and slot grid (2-col): `slot.label` + `{availability} left` / **"Full"**; selection = `selectedSlotId`.

### `food-preparation-chips.tsx` (145)
`FoodPreparationChips({note, noCutlery})` — two-row white card in the food cart:
1. Row button (`UtensilsCrossed` circle; filled `bg-brand-600` when note set): **"Add a note for the restaurant"** + note preview or hint **"e.g. Please make it medium spicy."**, `ChevronRight`. Opens BottomSheet title **"Add a note for the restaurant"** with textarea (maxLength `FOOD_NOTE_MAX_LENGTH` = 500, rows 4), `{n}/500` counter, buttons **"Remove"** (outline, only when note) + **"Save note"** (trims, slices to max).
2. Switch row `role="switch"` `aria-checked`: `UtensilsCrossed` circle + **"Don't send cutlery"** + check circle toggle (brand when on).
Values live in `cartStore.foodRestaurantNote` / `foodNoCutlery`; sent as `restaurant_note` / `send_cutlery` at order placement.

### `pay-now-card.tsx` (59)
`PayNowCard({order})` — Card `CreditCard` tile (brand-100/700), **"Payment pending"**, sub `Order total {amount} · ` + **"Pay online now to skip cash at the door."** (COD) or **"Complete payment to confirm your order."**; full-width button **"Pay now"** / **"Processing…"** — Razorpay via `createUsableCheckout(payments.initiate({payable_type:'order', payable_id, payment_method:'card', idempotency_key}), 'order:pay:{id}')` + `completeOrderPayment`; success toast **"Payment successful!"** + invalidate `['order', id]`; failure toast (message or "Payment could not be completed.").

### `payment-received-card.tsx` (41)
- **`PaymentReceivedCard`** — `border-success/30`, `BadgeCheck` tile (success/10), **"Payment received"**, sub `{payment_status underscores→spaces || 'Paid'} · {total} via online payment`.
- **`CashCollectedCard`** — `HandCoins` tile (success/10), **"Paid in cash"**, sub **"Your delivery partner collected {total} at your door."**

### `pay-now-card` for rides — see Section 37 (`components/rides/pay-now-card.tsx`).

---

## 35. Rides booking page (`/rides` → `pages/rides.tsx`, 753 lines)

**Layout**: two-column on `lg:` — sticky map (left, `h-[44dvh] min-h-[240px]` mobile / `h-[calc(100dvh-8.5rem)]` lg, `rounded-3xl shadow-float`) + booking panel (right, `max-w` column). Mobile map is first.

**Config/queries**: `['app-config']` → `maps.enabled && maps.public_key` = maps available; `['ride-promos']` → `repositories.rides.getPromos()` → `PromoRail`; `['saved-places']` → `getSavedPlaces().catch([])`; `['ride-route', coords]` → `getRoute` (staleTime 60s); `['ride-estimates', coords]` → `estimate` (staleTime 60s); `['nearby-drivers', lat, lng, vtId]` → `getNearbyDrivers` (staleTime 15s, **refetchInterval 30s**).

**Location**: on first load (maps available) `currentLocation` from `@/lib/location` → sets pickup, toast **"Using your current location."**; failure → toast **"Could not access your location."** Locate button (`LocateFixed`, aria/title **"Use my location"**) top-right of map.

**Map flow chip** (top-left, `bg-white/95` pill with brand dot): `MAP_FLOW_LABEL` — boot **"Loading app…"**, disabled **"Maps are currently unavailable"**, initializing **"Loading map…"**, locating **"Finding your location…"**, location-error **"Location unavailable"**, idle **"Where would you like to go?"**, placing-pickup **"Tap the map to set pickup"**, placing-drop **"Tap the map to set destination"**, calculating **"Calculating route…"**, route-ready **"Route ready"**, error **"Map could not be loaded"**.
- Maps disabled → centered placeholder: `Map` tile, **"Maps are currently unavailable"**, "You can still book a ride — search for your pickup and destination below."
- `<RideMap apiKey currentLocation pickup drop mode route drivers driversLoading onPick onCancelPick onReady onError>` (Section 37).

**Search card** (white `shadow-float`):
- **Pickup** row: `MapPin` success circle, label **"Pickup"** (10px uppercase), `AddressSearchBox placeholder="Search pickup address…"` with trailing **Map/On map** toggle button (aria `Pick pickup on map`; active `bg-brand-600 text-white`) and `LocateFixed` button (aria **"Use my current location as pickup"**). Focus tone: success ring.
- connector `ml-[21px] w-px` line.
- **Destination** row: `Navigation` accent circle, label **"Destination"**, `AddressSearchBox placeholder="Where to?"` + same **Map/On map** toggle (aria `Pick destination on map`, focus accent ring). Right: swap button (`ArrowUpDown`, `bg-ink-900` circle, aria/title **"Swap"** / `Swap pickup and destination`).
- `AddressSearchBox` internals: `Search` icon, 350ms debounce, `repositories.user.searchPlaces(term)` with AbortController (min 2 chars), error toast **"Address search is unavailable. Please try again."**; dropdown rows (`MapPin`, `{main}` + `{secondary}`) `shadow-float`; no-results row **"No matching locations found."**; clear `X` (aria `Clear search`), spinner while searching. Pick → `onSelect({latitude, longitude, label: main, place_id, formatted_address})`.
- Map pick (`mode` ≠ none): tap map sets pending point → `confirmMapPick` labels **"Selected location"** then async `repositories.user.reverseGeocode(lat, lng)` replaces label with the real address.
- Saved places chips row (when any): `RideChip` (active = `bg-ink-900 text-white`), `MapPin` icon + label; click sets pickup.

**Estimates section**: error → `ErrorState` **"Couldn't estimate fares"** / "Check your pickup and destination and try again." / **Retry**; loading 4× `Skeleton h-28`. Header **"Choose a ride"** + route summary `{distance_km} km · ~{duration_min} min`. Grid 2-col of vehicle cards (`VEHICLE_META`): bike → `Bike` success tile/border; auto → `CarTaxiFront` warning; cab/cab_xl → `Car` brand. Card: 12×12 tile icon (active+cheapest → `Check`), name, `{description}` or `{capacity} pax`, `{distance_km} km · ~{duration_min} min`, availability line (**"{n} nearby"** success / **"Limited availability"** amber-600 / **"No drivers nearby"** neutral / spinner **"checking availability"**), `Price estimated_fare`. **"Cheapest"** badge (success pill) when cheapest && not active; active card gets 2px chip-colored border + `shadow-float`. Cheapest = lowest `estimated_fare`; default selection = cheapest when estimates arrive.

**Booking** — `BookNowBar` (fixed `bottom-14 z-30` mobile / inline `hidden lg:block`): `bg-ink-900` bar, `Check` accent circle, `{vehicle} · {destination}` + `{pickup} → {destination}` subline, `Button` **"Book"** (spinner while pending). Mutation `repositories.rides.book({pickup/destination lat+lng, vehicle_type_id, pickup_address, destination_address, payment_method: 'online'})` → toast **"Ride booked! Driver will be assigned soon."** → `/ride/{id}`; failure toast **"Could not book the ride."**

**Icons**: `MapPin, Navigation, Loader2, Check, Bike, Car, CarTaxiFront, ArrowUpDown, Map, Search, X, LocateFixed`.

## 36. Ride detail / tracking (`/ride/:id` → `pages/ride-detail.tsx`, 395 lines)

**Queries**: `['ride', id]` (`getRide`, retry false) + realtime `useRealtimeRide(id)` (live wins); `['app-config']` for map key.

**Flow**: `RIDE_FLOW = REQUESTING → DRIVER_ASSIGNED → DRIVER_ARRIVING → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED`; label overrides `RIDE_FLOW_LABELS`: **SEARCHING DRIVER / DRIVER ASSIGNED / DRIVER ARRIVING / DRIVER ARRIVED / TRIP STARTED / TRIP COMPLETED**. Cancelled = `CANCELLED` or `NO_DRIVER_FOUND` (all steps todo).

**States**: not-found card (`XCircle`): **"Ride not found"** / **"This ride was removed or is no longer available."** / **"Back to rides"** (outline → `/orders`) + **"Try again"** (`Search` icon); loading 2 skeletons (`h-48`, `h-40`).

**Layout (`max-w-2xl`)**:
1. Back link `ArrowLeft` **"Rides"** → `/orders`.
2. **Header card**: `h1` `ride_number`, sub `{vehicle_type.name ?? 'Ride'} · {localized created_at}`; `Badge` (danger cancelled / warning `REQUESTING` / brand). Searching → banner: `Search` tile (brand-600), **"Searching for a driver…"** + **"This usually takes a minute."**. Cancelled → **"No driver was found. Please try booking again."** (NO_DRIVER_FOUND) or **"This ride was cancelled."**; else `StatusTracker` (hidden while searching).
3. **Tracking card** (when status ∈ `DRIVER_ASSIGNED, DRIVER_ARRIVING, DRIVER_ARRIVED, IN_PROGRESS` && maps key && pickup/dest points): `RideTrackingMap h-56` with labels (pickup/destination addresses, driver name) + caption row `Navigation` tile: **"Your driver has been assigned and is heading your way."** / **"Your driver is on the way to the pickup point."** / **"Your driver has arrived at the pickup point."** / **"Your trip is in progress. Sit back and enjoy the ride."**
4. **Route card**: `MapPin` brand circle **"Pickup"** `{pickup_address ?? 'Pickup location'}`; `ml-4` connector; `Navigation` success circle **"Destination"** `{destination_address ?? 'Drop location'}`; optional `{distance_km} km · {duration_min} min`.
5. **Driver card** (when `ride.driver`): `User` circle, name (`driver.name ?? driver.user?.name ?? 'Your driver'`), `Rating` or **"Driver"** label, `Phone` call button (brand-600 circle, aria `Call driver`, `tel:` link).
6. **Trip OTP card** (when not cancelled, `!otp_verified`, driver + otp present, status ∈ `DRIVER_ASSIGNED/ARRIVING/ARRIVED`): centered brand-50 panel: `KeyRound` tile, label **"Trip OTP"** (10px uppercase brand-700), code `font-mono text-3xl tracking-[0.3em]`, "Share this code with your driver. They will ask for it before starting the trip."
7. **Fare details card** — `FareRow`s (skipped when null/'0.00'/''): **Base fare, Distance charge, Time charge, Booking fee, Platform fee, Surge** (when >0), **Discount** `-₹` success; divider **"Final fare"** (or **"Estimated fare"**) + `final_fare ?? estimated_fare`.
8. **Payment state banners**: paid online → emerald row `BadgeCheck` **"Paid online"**; cash collected & !settled & !finished → amber card **"Cash payment"** + amount + "Cash payment collected by driver."; settled → emerald `BadgeCheck` **"Payment completed"**; `pendingOnlinePayment` (not finished, `payment_method==='online'`, not paid) → `RidePaymentCard`.
9. **Actions**: **"Cancel ride"** (danger; when status ∈ `REQUESTING, DRIVER_ASSIGNED, DRIVER_ARRIVING, DRIVER_ARRIVED`) → `rides.cancel(id, 'Customer cancelled')` toast **"Ride cancelled"** / **"Could not cancel ride"**; **"Rate driver"** (default; when `TRIP_COMPLETED`/`COMPLETED`) → BottomSheet **"Rate your driver"** (5 stars, textarea **"How was your trip? (optional)"**, **Submit**; toasts **"Thanks for rating your driver!"** / **"Could not submit rating"**).

**Icons**: `ArrowLeft, MapPin, Navigation, User, XCircle, Star, Loader2, Phone, Search, KeyRound, BadgeCheck`.

## 37. Ride components (`components/rides/`, 702 lines total)

### `RideMap.tsx` (418) — booking map
- **Colors**: current `#3b82f6`, pickup `#16a34a`, drop `#ea580c`, driver `#1f2937`, polyline `#111827`. Default center New Delhi `{28.6139, 77.209}`.
- Loads Google Maps (`loadGoogleMaps(apiKey)`), zoom 14, no mapType/fullscreen/streetView controls, `clickableIcons:false`; click handler active only when `mode !== 'none'` (moves pending pin).
- **Markers** (SVG data-URI teardrops 36×44): current = blue circle dot (z1, title "You are here"); pickup/drop pins (z2, titles `Pickup:`/`Destination:` + label); pending pin (z10, draggable, letter **"P"**, title "Pickup – tap map or drag to adjust" / "Destination – …"); driver pins = white-headed vehicle glyph (`bike`/`auto`/`car` silhouette from `vehicleKind(name)` regex; stroke color `#1f2937`), title `{vehicle} · {distance_km} km · ETA {eta_min} min`.
- **Route**: decoded `route` polyline (`strokeWeight 5`, opacity .9) else straight pickup→drop line (weight 3, opacity .5).
- **Driver clustering**: drivers within **30 m** share an anchor; members fan around it with radius from pin footprint (34 px, min 18 px) converted to metres at current zoom; thin connector "spokes" (driver color, opacity .45) from anchor to each marker; refan on `zoom_changed`.
- **Fit**: `fitBounds` with padding `{top:90,right:90,bottom:70,left:90}` when >1 anchor, else center current/pickup at zoom 15.
- **Overlays**: loading (`Loader2 brand-600`, **"Loading map…"**); error (**"Map could not be loaded"** / "Please check the Google Maps integration in admin and try again."); driver loading pill **"Finding nearby drivers…"** (bottom center); legend pill (bottom-left, sm+): colored dots **Pickup / Drop / Driver**; pick-mode bar (bottom): **"Set pickup point"** / **"Set destination"** + hint **"Tap the map or drag the green|orange pin"** + `X` cancel (aria `Cancel`) + brand **"Confirm"** button (`Check`).

### `RideTrackingMap.tsx` (173) — live ride map
- Colors: driver `#2563eb` (dot symbol scale 8), pickup `#16a34a`, destination `#ea580c`, route `#111827`. Fallback center New Delhi; zoom 14, `disableDefaultUI` + zoomControl.
- Draws driver dot (z5) + pickup/drop pins; straight line driver→pickup (or pickup→destination) colored driver blue (opacity .45) when driver present else route gray (.55); `fitBounds`.
- Overlays: spinner while loading; **"Map unavailable"** on error; legend pill top-left with colored dots `{driver|pickup|destination}` labels (defaults **Driver / Pickup / Drop**); **"Navigate"** link (brand-600 pill bottom-right, `Navigation` icon) → `https://www.google.com/maps/dir/?api=1&origin=...&destination=...` opening in new tab.
- Icons: `Loader2, Navigation`.

### `pay-now-card.tsx` (111) — `RidePaymentCard`
- Card `CreditCard` tile (brand-100/700), **"Payment pending"**, sub `Trip fare {estimated_fare} · Complete payment to finish your trip.`; full-width button **"Pay now"** / **"Processing…"**.
- Mutation: `createUsableCheckout(payments.initiate({payable_type:'ride', payable_id, payment_method:'card', idempotency_key}), 'ride:pay:{id}')` → `completeOrderPayment`; success toast **"Payment successful!"** + invalidate `['ride', id]`; failure toast (message or "Payment could not be completed.").

---

## 38. Design tokens — `src/index.css` (468 lines, exhaustive)

Tailwind v4 (`@import "tailwindcss"` + `@theme`). Font: `--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`.

### Color scales (exact hex)

| Scale | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **brand** (blue) | #eef6ff | #d9ecff | #bcdeff | #8ecaff | #59abff | #3386ff | #1b66f5 | #1451e1 | #1743b6 | #193c8f | #142657 |
| **accent** (orange) | #fff4ed | #ffe6d5 | #fec9aa | #fda274 | #fb703c | #f94d16 | #ea320c | #c2230c | #9a1e12 | #7c1c12 | — |
| **food** (red) | #fdf4f4 | #fbe5e5 | #f6cfcf | #eeaaaa | #e37779 | #d94a4c | #d42021 | #b21618 | #941418 | #7b1518 | — |
| **grocery** (gold) | #fffdf5 | #fff8e1 | #fdf0c8 | #fae39a | #f7cf4f | #f5b921 | #e0a008 | #b87f06 | #94620f | #7a5212 | — |

**Neutrals — `ink`** (warm gray): `ink-50 #f7f6f4`, `ink-100 #e9e7e3`, `ink-500 #6b675f`, `ink-700 #37332e`, `ink-800 #211d19`, `ink-900 #17140f`, `ink-950 #100e0a` (no 200/300/400/600).

**Semantic**: `--color-success #16a34a`, `--color-danger #dc2626`, `--color-warning #f59e0b`.

### Shadows (custom)

- `--shadow-card: 0 1px 2px rgb(16 14 10 / 0.04), 0 6px 18px -8px rgb(16 14 10 / 0.1)`
- `--shadow-float: 0 12px 32px -8px rgb(16 14 10 / 0.22)`
- `--shadow-pill: 0 4px 14px -6px rgb(16 14 10 / 0.18)`

### Base layer

- `:root { --page-gutter: 1rem }`; `@media (min-width: 640px)` → `1.5rem`.
- `html`: `-webkit-tap-highlight-color: transparent; scroll-behavior: smooth`.
- `body`: `bg-ink-50 text-neutral-900 antialiased`, `font-feature-settings: "cv02","cv03","cv04","cv11"`, `text-rendering: optimizeLegibility`.
- `*:focus-visible` → `outline-2 outline-offset-2 outline-brand-600`.
- `img { -webkit-user-drag: none }`.

### Utilities

`.no-scrollbar` (webkit + `-ms-overflow-style: none` + `scrollbar-width: none`), `.safe-bottom` / `.pb-safe` (`padding-bottom: env(safe-area-inset-bottom)`), `.pt-safe`, `.scroll-snap-x` (`x mandatory`), `.snap-start`, `.snap-center`, `.tap` (`cursor-pointer select-none; -webkit-touch-callout: none`), `.edge-bleed` (`margin-inline: calc(var(--page-gutter) * -1); padding-inline: var(--page-gutter)`).

### Top-band theme variables (`[data-service-theme]`)

`:root, [data-service-theme='rides']` (= neutral/home default):
- `--hero-header-bg: linear-gradient(to bottom, brand-800, brand-900)`
- `--hero-bg: linear-gradient(to bottom, brand-900, brand-950)`
- `--hero-surface: color-mix(in srgb, white 12%, transparent)`
- `--hero-active-color: brand-600` · `--hero-active-contrast: white`
- `--hero-search-accent: brand-600` · `--hero-muted-text: color-mix(white 55%)` · `--hero-module-dark: brand-950`

`[data-service-theme='food']`: header `food-800→food-900`; bg `food-900 → color-mix(food-900 55%, ink-950)`; active/search accent `food-600`; module-dark `food-900`; muted `color-mix(white 58%)`. (Comment: `#d42021` reserved for selected module/banner CTA/mic; never accent orange.)

`[data-service-theme='grocery']`: header `grocery-800→grocery-900`; bg `grocery-900 → color-mix(grocery-900 60%, ink-950)`; `--hero-surface: color-mix(grocery-100 14%)`; active color `grocery-500` with **contrast `ink-900`** (dark text on gold); search accent `grocery-600`; muted `color-mix(grocery-200 72%)`; module-dark `grocery-900`.

**Consuming classes** (`@layer components`): `.hero-header-bg`, `.hero-bg`, `.hero-surface`, `.hero-cta` (bg = active color, text = active contrast), `.hero-search-accent`, `.hero-badge`, `.hero-muted`, `.hero-fade` (gradient transparent → `color-mix(ink-50 45%)` 55% → `ink-50`).

### Module tabs (`.module-tabs` system)

- `.module-tabs`: `display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); padding-inline: 3%` (absorbs the SVG flare overflow).
- `.module-tab`: column flex, `justify-content:flex-end`, gap `.25rem`, padding `0.5rem .25rem .875rem`, `isolation: isolate`, `overflow: visible`. `.active`: `z-index: 2; margin-top: -0.5rem; padding-bottom: 1.25rem`.
- `.module-background`: absolute SVG, `left: -8%; width: 116%; height: 100%`, `z-index: -1`, `pointer-events:none`, `transition: transform .2s ease-out`. Idle path `fill: color-mix(hero-module-dark 55%, transparent)`, stroke `color-mix(white 12%)`, `stroke-width:1`, `vector-effect:non-scaling-stroke`. Active path `fill: var(--hero-active-color)`, stroke `color-mix(white 22%)`.
- `.module-content` flex column; `.module-icon` color `color-mix(white 72%)`, active → `var(--hero-active-contrast)` + `scale(1.06)`, `transition .2s ease-out`.
- `.module-label`: 11px (`0.6875rem`) / 700 / ellipsis, color `color-mix(white 62%)`; active → 12px (`0.75rem`), active-contrast.
- `.module-tab:focus-visible`: `2px solid white`, offset `-2px`, radius `.5rem`.
- `.module-tab.has-badge`: `padding-top: 1.125rem` (reserved badge room; applied from JSX, not `:has()`).
- `.time-badge`: absolute `top .25rem`, centered (`left:50%; translate:-50% 0`), pill, `0.5625rem`/700, `color: ink-900; background: white`.

### Animations (`@theme --animate-*` + keyframes)

| Token | Timing |
|---|---|
| `fade-in` | `0.2s ease-out` (opacity) |
| `fade-up` | `0.3s cubic-bezier(.16,1,.3,1)` (opacity + translateY(10px)→0) |
| `scale-in` | `0.2s ease-out` (opacity + translate(-50%,-50%) scale(.96)→1) |
| `sheet-up` | `0.28s cubic-bezier(.16,1,.3,1)` (opacity .4→1, translateY(100%)→0) |
| `slide-down` | `0.25s cubic-bezier(.16,1,.3,1)` (translateY(-8px)→0) |
| `slide-up` | `0.25s cubic-bezier(.16,1,.3,1)` (translateY(8px)→0) |
| `pulse-soft` | `2s ease-in-out infinite` (opacity 1→.55→1) |
| `pop` | `0.25s cubic-bezier(.34,1.56,.64,1)` (scale(.6)→1 + opacity) |
| `wiggle` | `0.4s ease-in-out` (rotate 0 → -8deg@30% → 8deg@60% → 0) |
| `image-in` | `0.35s ease-out` (opacity) |

**RN note**: no border-radius or font-size scale tokens exist in CSS (radius utilities are literal Tailwind values in JSX — `rounded-full`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`); copy hex values verbatim into a theme object; reproduce keyframes with `react-native-reanimated`; replace `env(safe-area-inset-*)` with `react-native-safe-area-context` insets.

---

## 39. UI primitives (`components/ui/*`, 2250 lines)

| Component | Props | Details |
|---|---|---|
| `Avatar` | `src?, alt?, name?, size sm/md/lg/xl` | `img` rounded-full, or gradient `from-brand-500 to-brand-700` circle with initials (first letters of first 2 words, upcase, fallback "U"); sizes: 8/10/14/20 (h-8 w-8 … h-20 w-20), text xs/sm/lg/2xl |
| `Badge` | `variant neutral/success/warning/danger/brand/accent` | pill `px-2.5 py-0.5 text-xs`; values: `bg-neutral-100 text-neutral-700`, `bg-success/10 text-success`, `bg-warning/15 text-amber-700`, `bg-danger/10 text-danger`, `bg-brand-50 text-brand-700`, `bg-food-50 text-food-600` |
| `Button` | cva `variant` default/accent/secondary/outline/ghost/danger/link; `size` default/sm/lg/icon/iconSm; `asChild` (Radix Slot) | base: `rounded-xl text-sm font-semibold`, `active:scale-[0.98]`, focus ring depending on variant. default `bg-brand-600 text-white hover:bg-brand-700`; accent `bg-food-600`; secondary `bg-neutral-100`; outline `border border-neutral-200 bg-white`; danger `bg-danger text-white`; link `text-brand-600 underline-offset-4`. sizes: h-11 px-5 / h-9 px-3.5 text-xs / h-12 px-6 text-base / h-11 w-11 / h-9 w-9 |
| `Card` | `onClick?` | `rounded-2xl border border-neutral-200/80 bg-white shadow-sm`; clickable → `cursor-pointer hover:shadow-md active:scale-[0.99]` |
| `Input` | `label?, error?` | `h-11 rounded-xl border-neutral-200`, `placeholder:text-neutral-400`, `focus:border-brand-500 focus:ring-2 ring-brand-500/20`; error → `border-danger`, `text-danger` caption |
| `Select` | `label?, error?, options` | like Input + `ChevronDown` absolute right; error border |
| `Checkbox` / `Radio` | `label?` | native inputs `accent-brand-600`, 4×4 box, labels `text-sm leading-snug`, integrated `<label>` with htmlFor |
| `Price` | `value, compareAt?, size sm/md/lg, className?` | `<span class="font-bold {size}">{formatCurrency(value)}</span>` + strikethrough compareAt `text-xs text-neutral-400` when compareAt > value. Sizes: sm `text-sm`, md `text-base`, lg `text-lg` |
| `QuantityStepper` | `value, onChange, min=1 max=99, size sm/md, tone brand/food` | pill group `border-neutral-200 bg-white p-1`: minus circle `bg-neutral-100` (disabled at min), count `min-w-6 text-sm font-semibold` (`aria-live=polite`), plus circle `bg-brand-600`/`bg-food-600` (disabled at max). buttons size h-7 w-7 / h-9 w-9; icons `Minus`/`Plus` (h-3.5) |
| `Rating` | `value, count?, size sm/md, align` | no value → "{count} ratings" or **"New"**. Else success stars: how many full `Star` (fill-current) + optional `StarHalf`, then value via `ratingLabel()`; value font-semibold; `(count)` in neutral-400. aria `Rated {x} out of 5` |
| `Skeleton` | `className` | `animate-pulse rounded-lg bg-neutral-200/70`. `CardSkeleton`: grid-cols-2/3/4 of card outlines (h-32 thumb, 2 text bars) |
| `Tabs` | generic `value,onChange,options,className,variant underline/pill,getActiveClass?` | **pill**: `flex gap-1 rounded-full bg-neutral-100 p-1`, active `bg-white text-neutral-900 shadow-sm`; **underline**: `flex gap-6 border-b`, active `text-brand-700` + `absolute -bottom-px h-0.5 bg-brand-600`, inactive `text-neutral-500`. Both `role=tablist`/`role=tab` `aria-selected` |
| `Modal` (Radix Dialog, z-50) | `open,onOpenChange,title?,children` | overlay `bg-black/40 backdrop-blur-sm animate-fade-in`; content `fixed left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md rounded-3xl bg-white p-6 animate-scale-in shadow-2xl`; header title `text-xl font-bold` + circular `bg-neutral-100` close (aria **"Close"**, `X` h-4) |
| `BottomSheet` (Radix Dialog, z-50) | `open,onOpenChange,title?,showClose=true` | overlay same; content `fixed inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl bg-white animate-sheet-up`, sm+ → `sm:bottom-4 sm:max-w-lg sm:rounded-3xl`; sticky header `px-5 py-4 border-b` + `h-1 w-10 bg-neutral-200` grabber (mobile only); body `px-5 py-4 pb-safe` |
| `Image` | `src, eager?, ...img` | `IMAGE.placeholder` URL on error; fade-in `opacity-0→100 transition-opacity duration-300` on load; `lazy` by default |
| `Toaster` | — | see Section 40 |

**Icons used in primitives**: `X, ChevronDown, Minus, Plus, Star, StarHalf, AlertTriangle, SearchX, PackageOpen, Inbox, CheckCircle2, Info, Loader2`.

## 40. States, toast & shared shell components

### `ui/state.tsx` — state blocks (all `animate-fade-in`, icon 16×16 rounded-2xl, `px-8 py-14` centered)
- `EmptyState` (`{title, description?, action?, icon?}`): neutral-gray icon tile (`bg-neutral-100 text-neutral-500`, default `Inbox`), `h3 text-base font-semibold`, desc `text-sm text-neutral-500`, secondary-size action Button.
- `ErrorState` (default title **"Something went wrong"**, default icon `AlertTriangle`): **danger** tile `bg-danger/10 text-danger`, outline action.
- `NoResultsState` (`{query?, onClear?}`): `SearchX`, title **"No results found"**, body `We couldn't find anything matching "{query}". Try a different search.` (or generic "Try adjusting your filters or search."), **"Clear filters"** secondary action.
- `GenericEmpty` = alias of EmptyState (default `PackageOpen`).

### `ui/toast.tsx` — toast store + `Toaster`
- zustand `useToastStore` (module singleton, id counter); `push(message, tone='success'|'error'|'info')` auto-dismisses after **3000ms**; `dismiss(id)`.
- `toast(message, tone)` = imperative helper.
- `<Toaster>`: fixed top-center `z-[100]`, `adjusts` `flex-col gap-2 px-4 max-w-sm`, `aria-live=polite`, rows `rounded-2xl border bg-white px-4 py-3 shadow-lg animate-slide-down`; tone icon left (`CheckCircle2 text-success` / `AlertTriangle text-danger` / `Info text-brand-600`), message `text-sm font-medium text-neutral-800`, `X` dismissal (aria **"Dismiss"**); border tint per tone (`border-success/20`/`border-danger/20`/`border-brand-200`). Mounted once in `AppShell`/root.

### `map/MapPicker.tsx` (473) — address picker (Google Maps + reverse geocode + place search)
- Loads Maps via `loadGoogleMaps(publicKey)`, zoom 15, map click + draggable pin; auto geolocates (timeout 8s) when no `initialLatitude/Longitude`.
- Debounced (350ms) `repositories.user.searchPlaces(term, countryCode)` results dropdown, `AbortController`, fallback amber **"Address search is temporarily using a fallback service. Results may be less accurate."**; no results → **"No matching locations found."**
- Choosing a result sets coords, pans (zoom 16), then `placeDetails(result.id)` to upgrade components; reverse geocode debounced 450ms on any pin move.
- Reverse-info card `{resolved.address}` + `{city, state, postal_code, country}` join.
- Controls: search input placeholder **"Search for an address…"**, clear `X`; buttons **"My location"** (`LocateFixed`), **"Use this address"** (brand, `MapPin`), **"Cancel"**. Geolocation error mapping: code 1 "Location permission denied…", 2 "Your location could not be determined…", 3 "Location request timed out…".
- `onSelected(SelectedPlace)` emits `{label, address_line_1, city, state, postal_code, country, latitude, longitude, place_id?, formatted_address?, locality?, area?, provider?}` (label fallbacks: "Delivered here" / "Selected location").

### `auth/require-auth.tsx` (28)
- If `!initialized` → screens of `Skeleton` blocks; if `!isAuthenticated` → `<Navigate to="/auth/login?redirect={pathname+search}">`, else children. Calls `initialize()` once.

### `auth/google-sign-in-button.tsx` (198)
- Loads GIS script once (`module`-level promise); `init({client_id, ux_mode:'popup', context, callback, error_callback})`; renders official `google.accounts.id.renderButton` (outline, large, pill, `width:max(240, parent clientWidth||320)`) into a container; boot placeholder div (spinner + **"Continue with Google"**), disabled state hides button. Failure → inline **"Google sign-in is unavailable right now. Please use email, phone, or try again later."**
- Error wording map: popup_closed_by_user **"Google sign-in was cancelled."**; access_denied **"Google sign-in was declined."**; invalid_client/missing_client_id **"Google sign-in is not set up correctly yet. Please contact support."**; network **"Could not reach Google. Check your connection and try again."**
- `GoogleSignInDivider` ("or" with hairlines).

### `brand/brand-logo.tsx` (46) — `BrandLogo`
- Rounded-xl gradient **accent-400→accent-600** tile with bold white **"SB"**, wordmark **"SuperBasket"** (accent-500 colored "Basket"), `tone` dark/light, `responsiveText` hides text below `sm`.

### `layout/BottomNav.tsx` (66)
- 5 tabs: **Home** (`/`, `Home`, matches /, /food, /grocery, /restaurant, /store), **Orders** (`ReceiptText`, matches /orders, /order), **Rides** (`Car`, matches /rides, /ride), **Wallet** (`Wallet`, /wallet, auth), **You** (`CircleUser`, /profile, auth).
- `fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t backdrop-blur pb-safe md:hidden`; `aria-label="Primary"`; active: `text-ink-900` + top indicator bar (`h-1 w-8 rounded-b-full` in theme solid first color) + icon `scale-110` tinted `theme.strong`, strokeWidth 2.4; inactive `text-neutral-400`.
- Service resolved from route (startsWith /grocery → grocery; /rides|/ride → rides; else stored service).
- Auth tabs hidden when signed out unless the tab itself is active.

### `layout/location-selector.tsx` (258)
- BottomSheet **"Choose your location"**.
- Search (debounced, `searchPlaces`, ≥2 chars, staleTime 30s) results (`MapPin` + `{main}` / `{secondary}`); fallback amber notice; **"No matching locations found."**
- **"Use current location"** card (`brand-50 border-brand-100`, `LocateFixed` in brand-600 tile): `currentLocation()` from `@/lib/location`, then `reverseGeocode` to build `Location`; picks on success or falls back to plain coords with toast **"Location updated (no address details)"**.
- **"Saved addresses"**: merged from `user.getAddresses()` (icon `Home` or `Work`→`Briefcase`) and `rides.getSavedPlaces()` (keyed `address-{id}` / `saved-place-{id}` — never deduped).
- **"Popular areas"** (`POPULAR_AREAS` from lib/location) with `MapPin`.
- Client-side filtering by query across saved + popular; server list wins when present. Empty-all → `No areas found for "{query}". Try a nearby landmark.`
- Footer link **"Reset to default location"** → `DEFAULT_LOCATION`.
- Icons: `Search, MapPin, Home, Briefcase, LocateFixed, Loader2, Info`.

---

## 41. Wallet (`/wallet` → `pages/wallet.tsx`, 198 lines)

**Queries**: `['wallet']` (`getWallet`), `['wallet-transactions']` (`getTransactions`); topup mutation `wallet.topup(amount)`.

**Layout (`max-w-2xl`)**:
- Header: **Wallet** (`text-xl font-extrabold`) + sub **"Payments, refunds & top-ups."**
- Balance hero card: `rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 text-white p-6`; `WalletIcon` + **"Available balance"** (white/80), `text-3xl font-extrabold` balance, buttons **"+ Add money"** (white bg, `text-brand-700`, non-clickable white → `bg-brand-50`) and **"Pay with wallet"** (white/20 backdrop-blur pill → `/checkout`); **"Pending balance: ₹x"** (`text-white/70`).
- **Transactions** section: rows toggle a `TransactionDetail` BottomSheet; list items = Card rows: tile `bg-success/10 text-success` (`ArrowDownLeft`) for credit / `bg-danger/10 text-danger` (`ArrowUpRight`) for debit; title `{description ?? type}` (underscores → spaces); sub `{type} · {date}` via `toLocaleString('en-IN', {day:'numeric', month:'short'})`; trailing **+/-** amount (`text-success` credit / `text-neutral-900` debit); `ChevronRight`.
- Empty → `EmptyState` (`WalletIcon`): **"No transactions yet"** / "Top up your wallet to get started." / **"Add money"** action.
- Info card (`Info` brand): **"Refunds and cashbacks for cancelled orders are automatically credited to this wallet."**
- **Add money** BottomSheet: preset amounts `[100, 500, 1000]` tiles (selected `border-brand-600 bg-brand-50 text-brand-700`), submit `Add {amount} to wallet` (spinner); disabled `amount<=0||pending`; caption **"Payment gateway integration coming soon."** Success toast **"₹{amount} added to wallet"** + invalidate wallet queries; error **"Could not add money"**.
- **TransactionDetail** BottomSheet **"Transaction details"**: amount hero `text-lg font-extrabold` +/-, `transaction_id` sub, then `DetailRow`s **Type / Date / Status / Balance after** (`₹{balance_after}`); `DetailRow` = flex row with `border-b border-neutral-100`, label `text-neutral-500`, value `font-semibold capitalize`.

**Icons**: `ArrowUpRight, ArrowDownLeft, Wallet, Plus, Loader2, ChevronRight, Info`.

## 42. Profile (`/profile` → `pages/profile.tsx`, 191 lines)

**Guarded**: not authenticated → centered `Avatar "Guest" lg` + **"You're not signed in"** / "Sign in to manage orders, wallet and addresses." + **Sign in** (`/auth/login`) + **Create account** (outline, `/auth/register`).

**Signed-in (`max-w-md`)**:
- Identity card (`Card p-5`): `Avatar name lg`, name `truncate text-lg font-extrabold`, `{email}` + `· +{country_code}{phone}`, `Referral: {referral_code}` pill (`bg-brand-50 text-brand-700 text-[11px]`).
- Menu (divided Card rows, `ChevronRight`, icon `h-5 text-neutral-400`): **Edit profile** (`CircleUser`→`/profile/edit`), **My addresses** (`MapPin`→`/profile/addresses`), **Payment methods** (`CreditCard`→`/profile/payments`), **Wallet** (`Wallet`→`/wallet`), **Notifications** (`Bell`→BottomSheet), **Language** (`Languages`→toast "Language settings coming soon"), **Privacy** (`ShieldCheck`→toast), **Security** (`Lock`→toast), **Help & support** (`LifeBuoy`→toast "Support tickets coming soon"), **Terms & policies** (`FileText`→toast "Terms will open soon").
- **Logout** outline full-width (`LogOut`; danger row below: **Delete account** `Trash2`).
- **Sign out?** Modal: copy "You will need to sign in again to access your orders and wallet."; Cancel / danger **Sign out** (spinner when running) → `logout()` → toast **"Signed out"** → navigate `/`.
- **Delete account?** Modal: "This will permanently delete your account and data. This action cannot be undone."; Cancel / danger **Delete** (currently no handler).
- **Notifications** BottomSheet: `['notifications']` (`getNotifications`, enabled when open + authed) → skeleton / **"No notifications yet."** / Cards with `{title}` + `{body}`.

## 43. Edit profile (`/profile/edit` → `pages/edit-profile.tsx`, 60 lines)

- Back link `ArrowLeft` **"Profile"** → `/profile`; title **"Edit profile"**.
- Avatar card: `Avatar {name}` + **"Profile photo coming soon"**.
- Form Card (name/email/phone `Input`s seeded from auth store) → mutation `user.updateProfile({name?,email?,phone?})`; success `setUser(updated)` + toast **"Profile updated"**; error **"Could not update profile"**. Submit **"Save changes"** (spinner).
- Icons: `ArrowLeft, Loader2`.

## 44. Addresses (`/profile/addresses` → `pages/addresses.tsx`, 349 lines)

**Queries**: `['addresses']` (`getAddresses`), `['app-config']` (staleTime 5 min). Mutations: `createAddress`/`updateAddress`, `setDefaultAddress`, `deleteAddress`; toasts **"Address added"/"Address updated"/"Default address updated"/"Address deleted"**, save fail **"Could not save address"**. Save throws **"Please pick your location on the map first."** if no coords.

**List (`max-w-2xl`)**: back link + **"My addresses"** title + **"+ Add"** button. Empty state (`MapPin`): **"No addresses yet"** / "Add a delivery address to checkout faster." / **"Add address"**. Row Cards: `{label}` bold + **"Default"** pill (`bg-brand-50 text-brand-700`), `address_line_1{`, line_2}`, `{city} {postal_code}`, `{contact_phone}`; actions: **"Set default"** (outline sm, disabled while pending, spinner per-row via `variables===id`), **Edit** (ghost sm), trash icon (neutral-300→hover danger, aria **"Delete"**).

**Add/Edit address Modal** (`max-w-md`, title "Add address"/"Edit address"):
- Label chips grid `Home / Work / Other` (active `border-brand-600 bg-brand-50 text-brand-700`).
- Contact name + contact phone inputs (grid-cols-2).
- **Map section**: header **"SELECT LOCATION ON MAP"** + **"Location set"** success tag when picked; map button states — `loading` (**"Loading map…"**, disabled if no `maps.public_key`), picked (`border-success/40 bg-success/5 text-success`, **"Change location on map"**), else (`bg-brand-50 text-brand-700`, **"Pick location on map"`). `MapPicker` embedded with init from form; `onSelected` backfills form (address_line_1 ||= place label…) + toast **"Location set"**.
- Fields: Address / House no., Building (required), Landmark, City/State/Postal code/Country (read-only, filled from picker).
- Submit: **"Add address"** / **"Save changes"** (disabled without location).
- **Delete address?** Modal: "This address will be removed permanently." Cancel / danger **Delete**.

**Icons**: `ArrowLeft, Plus, MapPin, Trash2, Loader2, MapIcon`.

## 45. Payment methods (`/profile/payments` → `pages/payments.tsx`, 75 lines)

Static demo page (`max-w-md`): back link + **"Payment methods"** title.

- Saved card: **UPI** `a***@okhdfc` + **"Default"** success pill; **Credit card** `HDFC •••• 4521` + `Exp 09/27`; **Cash** `Pay on delivery / at destination`.
- **"+ Add payment method"** → toast **"Add payment method coming soon"** (never wired); caption "Wallet balance is managed from the Wallet tab."
- `METHODS` info list (rows → toast **"Coming soon"**): **UPI** (`Smartphone`, tile `bg-brand-50 text-brand-600`, "Google Pay, PhonePe, Paytm"), **Credit / Debit cards** (`CreditCard`, `bg-accent-50 text-accent-600`, "Visa, Mastercard, RuPay"), **Net banking** (`Landmark`, `bg-success/10 text-success`, "All major banks").

## 46. Auth (`/auth/login`, `/auth/register` → `pages/auth.tsx`, 320 lines)

**Modes**: `login` | `register` | `otp` (OTP is only ever one screen; final form login). `redirect` query param honored (default `/`); success `finish()` → toast **"Welcome!"** → `navigate(redirect, {replace:true})`.

**Header block** (brand-600 `ShieldCheck` tile, `max-w-md`, centered):
- login: **"Welcome back"** / "Sign in to continue to your orders & wallet."
- register: **"Create your account"** / "Order food, groceries and rides with one account."
- otp: **"Verify your number"** / "We sent an OTP to +91 {phone}."

**Segmented toggle (login/register)**: `rounded-xl bg-neutral-100 p-1 grid-cols-2`, active `bg-white text-neutral-900 shadow-sm` (**"Sign in"** / **"Sign up"**).

**Login form**: Email or phone (placeholder "you@example.com or 9876543210") — dispatch: `@` → `loginWithEmail`, else `loginWithPhone(identifier sans spaces/dashes)`; Password; link **"Forgot Password?"** → `/auth/forgot-password`; **Sign in** submit; optional Google block (rendered only when `appConfig.google.enabled`); **"Continue with phone OTP"** (`Smartphone`).

**Register form**: Full name, Phone, Email (optional), Password (min 8, placeholder "At least 8 characters"), Confirm password; inline check `Passwords do not match.` error toast; **"Create account"** → `register({name, phone, email?, password, password_confirmation})`; Google button.

**OTP mode**: Phone input + **"Send OTP"/"OTP sent — resend?"** (secondary; requires non-empty phone; `sendOtp` → toast **"OTP sent to +91 {phone}"**, toggle `otpSent`), OTP input (`maxLength=6`, disabled until sent), **"Verify & continue"** (enabled at exactly 6 digits) → `loginWithOtp(phone, otp)`; **"Back to sign in"** link. Send-OTP error toast **"Could not send OTP. Please try again."**

**Footer**: "By continuing you agree to our **Terms** & **Privacy policy**." (both → toast opens); demo note **"Demo mode: any credentials work."** + **"Take me home"** link.

**Shared error handling**: any auth failure → toast **"Authentication failed. Please try again."** except Google (uses server/wrapped message) and OTP send.

## 47. Forgot password (`/auth/forgot-password` → `pages/forgot-password.tsx`, 119 lines)

- `ShieldCheck` hero → after submit swaps to `MailCheck` + **"Check your email"** / "If a reset link was sent, it will arrive shortly."
- Form: Email input (placeholder "you@example.com"), **"Send Reset Link"** (spinner). Empty → toast **"Enter your email address."**; `forgotPassword(email)` returns the server's own wording displayed verbatim (anti-account-enumeration) in a `bg-brand-50` panel; **"Send to a different email"** (secondary) resets.
- Failure: server message or **"We couldn't send the reset email right now. Please try again later."**
- **"Back to Login"** (`ArrowLeft`); footnote: "Signed up with Google or phone OTP? Continue with that method instead — those accounts don't use a password."

## 48. Reset password (`/auth/reset-password` → `pages/reset-password.tsx`, 150 lines)

- Reads `token` + `email` straight from query string (`INVALID_LINK_MESSAGE = 'This password reset link is invalid or has expired.'`); missing → amber panel **"Request a new link"** → `/auth/forgot-password`.
- Form: New Password + Confirm Password (both min 8, `autoComplete` new-password); mismatch → inline `text-red-600` note + submit disabled; short → toast **"Password must be at least 8 characters."**; mismatch submit → toast **"The password confirmation does not match."**
- `resetPassword({token, email, password, password_confirmation})`; error → toast (message or `INVALID_LINK_MESSAGE`).
- **Done screen**: `CheckCircle2` emerald (h-14), **"Password updated"** / "Your password has been reset successfully. You can now sign in with your new password." / **"Go to Login"** → `/auth/login` replace.
- Footer **"Back to Login"** link.

---

## 49. Zustand stores (`src/store/`, 3 files)

### `appStore.ts` (`useAppStore`, persisted `sb-app`)
- State: `service: ServiceType` (default `'food'`), `location: Location | null`, `setService`, `setLocation`. `persist` middleware keeps only `{service, location}` in `localStorage` key `sb-app`.

### `authStore.ts` (`useAuthStore`)
- State: `user: User|null`, `isAuthenticated`, `initialized`, `otpToken: string|null`; actions: `sendOtp, loginWithEmail, loginWithPhone, loginWithOtp, loginWithGoogle, register, forgotPassword, resetPassword, logout, fetchProfile, setUser, initialize`.
- `MOCK_USER` = `{id:1, name:'Aarav Sharma', email:'aarav@example.com', phone:'9876543210', country_code:'+91', user_type:'customer', referral_code:'AARAV10'}`.
- Token store: `localStorage['sb-token']`; non-mock flows set it from API. `postWithMessage` used for forgot-password so server wording passes through verbatim. Mock mode `delay(500)` then sets `sb-token='mock-token'`.
- `initialize()`: mock → `initialized` only; live → reads `sb-token`, else `/profile`; 401 clears.
- `logout()`: attempts `POST /auth/logout` (ignored on failure), clears token + user.
- Endpoints (live): `POST /auth/otp/send` `{phone, country_code:'+91', purpose:'login'}`; `POST /auth/login/email`; `POST /auth/login` `{phone,password,country_code}`; `POST /auth/otp/verify` `{phone,otp,token,country_code}`; `POST /auth/google` `{credential}`; `POST /auth/register`; `POST /auth/forgot-password`; `POST /auth/reset-password`; `POST /auth/logout`; `GET /profile`.

### `cartStore.ts` (`useCartStore`)
- `const FOOD_NOTE_MAX_LENGTH = 500`.
- State: `foodCount`, `groceryCount` (badge numbers synced from cart queries), `rideActive`; cart-level prefs `foodRestaurantNote` + `foodNoCutlery` (maps to `send_cutlery=false`; default stays `send_cutlery=true`); actions `setCount, increment, setRideActive, setFoodRestaurantNote, setFoodNoCutlery, clearFoodInstructions`.

## 50. React Query hooks (`src/hooks/`, 4 files)

- **`useCart.ts`**: `cartKeys` (`['cart']`, `['cart', type]`); `useCart(type)` → `getByType` + syncs count to cartStore; `useAddToCart` (`repositories.cart.addItem({product_id, quantity, cart_type?, selected_options?})` → sync + invalidate `['cart']`); `useSetDeliveryAddress` (`{addressId, type, deliveryMode}` → `setDeliveryAddress` + `setQueryData` + invalidate); `useUpdateCartItem` (`{itemId, quantity}`), `useRemoveCartItem` (itemId); `useApplyCoupon(code)`, `useRemoveCoupon()`.
- **`useActiveGroceryStore.ts`** (`['grocery','active-store', coordsKey(origin)]`): `getStores({latitude, longitude, per_page:50})`, staleTime 5 min; runs `nearestEligibleStore` → returns `{origin, ranked, activeStore, activeStoreId, distanceKm}`; re-runs when location changes (coords in key). Origin = appStore location or `DEFAULT_LOCATION`.
- **`useGroceryCategories.ts`** (`['grocery-categories']`, staleTime 10 min): one request for carousel + grid + sections; builds `{categories (parents in backend sort_order), sections (parents with ≥1 stocked child, children filtered by stockedCategoryIds)}`.
- **`useStoreCatalogue.ts`** (`['grocery-products', storeId, categoryId, query, isVeg]`): `getProducts(storeId, {category_id?, search?, per_page:60, is_veg?})` + client-side `filter(p.store_id === storeId)` guard; per-store cache entries. `productsOfStore(products, storeId)` helper for discovery payloads. `is_veg` is a server-side filter (`is_veg: 1|0`), not a local toggle.

## 51. API client, data source & images

### `lib/apiClient.ts`
- `API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'`.
- Token key `sb-token` (localStorage); `setToken(token|null)` add/remove.
- `request<T>`: adds `Accept: application/json`, `Authorization: Bearer {token}`, `Content-Type: application/json` (when body); wraps `fetch`; on non-OK throws `ApiError(message, status, payload?.errors)` where message = payload.message or **"Session expired. Please log in again."** (401) / **"Something went wrong."**; on 401 additionally clears token and dispatches `window` event `'auth:unauthorized'`.
- Response envelope: `ApiResponse<T> = {success, message, data, meta?, errors?}` → `api<T>` returns `data`, `apiWithMessage<T>` returns `{data, message}`.
- `apiClient` methods: `get, post, put, patch, delete, postWithMessage`.

### `config/dataSource.ts`
- `VITE_DATA_SOURCE === 'api'` → `IS_API` else `IS_MOCK` (default mock).

### `config/images.ts`
- `IMAGES.base` ('' — swap for CDN in production); `IMAGES.placeholder` = inline SVG data URI (ink-100 gray rect `#e9e7e3`, person/blob `#c9c5bd`); `imageUrl(src)` passes through `/`-relative, `data:` or `https?:` paths, else prepends base.

## 52. Repositories layer (`src/repositories/`)

- `interfaces.ts`: typed contract per domain (`FoodRepository, BannerRepository, GroceryRepository, RideRepository, OrderRepository, CartRepository, WalletRepository, PaymentRepository, UserRepository, SearchRepository`) + shared shapes `MonthlySuggestion`, `DeliverySlot`.
- `api/`: `Api*Repository` classes implementing every interface via `apiClient` (see endpoint sections 53–58).
- `mock/`: `Mock*Repository` implementing the same interfaces with in-memory state (Section 62).
- `index.ts`: `buildRepositories(getDataSource())` → exported singleton `repositories` (`{food, grocery, rides, orders, cart, wallet, payments, user, search, banners}`). All components import `repositories` and never touch `apiClient` directly.

## 53. Endpoint inventory A — discovery / banners / search / geocoding / config

| Method & path | Params / body | Returns (mapped) |
|---|---|---|
| `GET /discovery/home` | — | food: `recommended_restaurants`/`food.recommended`, `food.popular/.top/.fast/.offers/.recently_ordered`, `food.products`/`recommended_products`, `food.deals`, `food.banners`/`banners`, `categories`, `offers`; grocery: `grocery.buy_again/.monthly_essentials/.recommended/.deals/.stores/.categories/.recently_viewed/.banners/.offers` |
| `GET /banners` | `service=all\|food\|grocery\|rides`, `placement=<string>` | `Banner[]` |
| `GET /discovery/search` | `query`, `type?` | `{restaurants=restaurants\|\|food, stores=stores\|\|grocery, products, categories}` |
| `GET /geocode/search` | `q`, `country?` | `SearchPlacesResponse {results[], provider?, fallback?, correlation_id?}` |
| `GET /geocode/details` | `place_id` | `PlaceDetails` |
| `GET /geocode/reverse` | `lat`, `lng` | `ReverseGeocode` |
| `GET /app-config` | — | `AppConfig {maps{enabled,provider,public_key}, delivery?, captcha?, analytics?, media?, payments?, google?}` |

## 54. Endpoint inventory B — food & restaurants

| Method & path | Params | Returns |
|---|---|---|
| `GET /food/restaurants` | `cuisine?, search?, page?, sort?, latitude?, longitude?` | `Paginated<Restaurant>` |
| `GET /food/restaurants/{id}` | — | `Restaurant` |
| `GET /food/restaurants/{id}/menu` | — | `ProductCategory[]` (menu sections w/ products) |
| `GET /food/categories` | — | `Category[]` |
| `GET /food/cuisines` | — | `string[]` |
| `POST /orders` (food) | `order_type:'food'`, `address_id?`, `payment_method?`, `idempotency_key?`, `customer_note?`, `tip_amount?`, `restaurant_note?` (≤500), `send_cutlery?` (false="Don't send cutlery") | `Order` |

## 55. Endpoint inventory C — grocery & cart

| Method & path | Params / body | Returns |
|---|---|---|
| `GET /grocery/stores` | `search?, page?, per_page?, latitude?, longitude?` | `Paginated<Store>` |
| `GET /grocery/stores/{id}` | — | `Store` |
| `GET /grocery/stores/{id}/products` | `category_id?, brand_id?, search?, page?, per_page?, sort?, is_veg?(1\|0)` | `Paginated<Product>` (skips store-scoping client-side) |
| `GET /grocery/products` | same (unscoped variant) | `Paginated<Product>` |
| `GET /grocery/categories` | — | `Category[]` (parents + `children`, admin `sort_order`) |
| `GET /grocery/brands` | — | `{id,name}[]` |
| `GET /ai/grocery/monthly` | — | `MonthlySuggestion[]` |
| `GET /grocery/delivery-slots` | `store_id`, `days?` | `DeliverySlot[]` |
| `GET /cart` / `GET /cart?type=food\|grocery` | — | `Cart` (envelope unwrap: raw array → `{cart:null,items:[]}`) |
| `POST /cart/items` | `{product_id, quantity, cart_type?, product_variant_id?, selected_options?, selected_addons?, special_instructions?}` | `Cart` |
| `PUT /cart/items/{id}` | `{quantity}` | `Cart` |
| `DELETE /cart/items/{id}` | — | `Cart` |
| `POST /cart/coupon` | `{code}` | `Cart` |
| `DELETE /cart/coupon` | — | `Cart` |
| `POST /cart/delivery-address` | `{address_id, cart_type, delivery_mode?('instant'\|'scheduled') for grocery}` | `Cart` (reprices per delivery config) |
| `DELETE /cart` | — | void |

## 56. Endpoint inventory D — orders

| Method & path | Params / body | Returns |
|---|---|---|
| `GET /orders` | `status?, order_type?, page?` | `Paginated<Order>` |
| `GET /orders/{id}` | — | `Order` (includes `restaurant`/`store`, `items`, `statusHistory` as rehydrated from mock or API) |
| `POST /orders` | `order_type:'food'\|'grocery'`, `address_id?`, `payment_method?`, `idempotency_key` (alias `order_idempotency_key`), `customer_note?`, `tip_amount?`, `delivery_slot_id?`, `restaurant_note?`, `send_cutlery?` | `Order` |
| `POST /orders/{id}/cancel` | `{reason}` | `Order` |
| `POST /orders/{id}/reorder` | — | `Order` |
| `POST /orders/{id}/rate` | `{rating, comment?}` | void |
| `GET /orders/{id}/tracking` | — | `OrderTracking {order, partner, location{lat,lng,heading,speed,accuracy,recorded_at,is_stale}, route{polyline,...}, eta, tracking{enabled,in_progress,source,last_updated_at,location_stale}}` |
| `GET /orders/{id}/delivery-otp` | — | `{otp, expires_at}` |
| `GET /orders/{id}/preparation-instructions` | — | `PreparationInstructionsPayload {service, options[{key,label,emoji}], editable, editable_statuses, max_note_length, instructions{selected,note,restaurant_note,send_cutlery,updated_at}, items[]}` |
| `PATCH /orders/{id}/preparation-instructions` | `{selected[], note?, items?[{order_item_id, selected[], note?}]}` | same payload |

## 57. Endpoint inventory E — rides

| Method & path | Params / body | Returns |
|---|---|---|
| `GET /rides/promos` | — | `Offer[]` (errors → `[]`) |
| `GET /vehicle-types` | — | `VehicleType[]` |
| `POST /rides/estimate` | `{pickup_latitude, pickup_longitude, destination_latitude, destination_longitude, vehicle_type_id?}` | `RideEstimate[]` |
| `POST /rides/route` | same coords | `RideRoute {distance_km, duration_min, polyline, source, status}` |
| `GET /rides/nearby-drivers` | `latitude, longitude, vehicle_type_id?, radius_km?` | `NearbyDriver[]` (polled every 30s) |
| `POST /rides` (book) | `{pickup/destination_latitude/longitude, vehicle_type_id, pickup_address?, destination_address?, payment_method?('cash'\|'wallet'\|'online'), scheduled_at?}` | `Ride` |
| `GET /rides/{id}` | — | `Ride` |
| `GET /rides` | — | `Ride[]` (paginated API unwrapped to array) |
| `POST /rides/{id}/cancel` | `{reason}` | `Ride` |
| `POST /rides/{id}/rate` | `{rating, comment?}` | void |
| `GET /saved-places` | — | `{id,label,address,latitude?,longitude?}[]` (also used by user repo) |

## 58. Endpoint inventory F — wallet, payments, user/profile

| Method & path | Params / body | Returns |
|---|---|---|
| `GET /wallet` | — | `Wallet {balance, pending_balance, ...}` |
| `GET /wallet/transactions` | — | `WalletTransaction[]` (paginated unwrapped) |
| `POST /wallet/topup` | `{amount}` | `{wallet?, transaction?}` (mock only ends here; gateway "coming soon") |
| `POST /wallet/verify-payment` | `payload` | `{balance}` (stringified from `wallet.balance`) |
| `POST /payments/initiate` | `{payable_type:'order'\|'ride', payable_id, payment_method:'upi'\|'card'\|'net_banking'\|'wallet', idempotency_key?}` | `PaymentCheckoutPayload {payment_number, provider_order_id, amount_paise, amount, currency, method, key_id, mock}` |
| `POST /payments/verify` | `{payment_number, provider_payment_id, provider_order_id, signature}` | `PaymentVerifyResult {status:'SUCCESS'\|'FAILED', already_processed, payment_number, paid_at}` |
| `GET /profile` | — | `User` |
| `PUT /profile` | `Partial<User>` | `User` |
| `GET /addresses` | — | `Address[]` |
| `POST /addresses` | `Partial<Address>` | `Address` |
| `PUT /addresses/{id}` | `Partial<Address>` | `Address` |
| `DELETE /addresses/{id}` | — | void |
| `POST /addresses/{id}/default` | — | `Address` |
| `GET /notifications` | — | `{id,title,body,is_read,created_at}[]` |
| `GET /coupons` | — | `Coupon[]` |
| `GET /activity` | — | `{food, grocery, rides}` (unwraps `orders` filtered by `order_type`) |

---

## 59. Types — `catalog.ts` (domain entities)
`Location {label,address,latitude,longitude,place_id?,formatted_address?,locality?,area?}` · `Service='food'|'grocery'|'rides'` · `Banner {id,title,subtitle,image,cta_text,service,placement?,media_type?,video?,poster_image?,target_type:'restaurant'|'store'|'product'|'search'|'service'|'url'|null,target_id,target_url,sort_order,is_active}` · `Offer {type:'percentage'|'flat'|'buy_x_get_y', value, code, service, min_order, ends_at, title, subtitle, tag}` · `User` · `Address {label, contact_name, contact_phone, address_line_1/2, landmark, city, state, postal_code, country, place_id?, formatted_address?, latitude:string|null, longitude:string|null, type:'delivery'|'pickup'|'billing', is_default, meta}` · `Wallet` · `WalletTransaction` (13 `WalletTransactionType` values incl. TOP_UP/PURCHASE/REFUND) · `Category {children?}` · `Restaurant {cuisine_type, is_veg, is_halal, dine_in, avg_prep_time_min, avg_delivery_time_min, rating, rating_count, min_order_amount string, delivery_fee string, free_delivery_above, order_type:'delivery'|'pickup'|'both', menu?, products?, vendor?}` · `Store {store_type, supports_instant_delivery, supports_scheduled_delivery, substitution_policy:'contact'|'auto'|'none'}` · `Brand` · `Addon/AddonOption` · `ProductVariant` · `OptionGroup {selection_type:'SINGLE'|'MULTIPLE', is_multi_select, is_required, min_select, max_select, values:ProductOption[]}` · `Product {type:'food'|'grocery', unit_type/value/label, min_order_qty, max_order_qty, is_veg:boolean|null, addons?, variants?, variation_options?, category?, brand?}` · `ProductCategory {products[]}`.

## 60. Types — `models.ts` (runtime/domain) & `api.ts` (envelope)
- `ServiceType`, `OrderType='food'|'grocery'`, 13 `OrderStatus`, 7 `OrderPaymentStatus`, `CartItem`/`Cart` (`cart_type`, `delivery_mode?, subtotal, discount, tax, delivery_fee, delivery_gst_percent/amount, packaging_fee?, handling_fee?, delivery_distance_km?, total, coupon_code, items_count`), `OrderItem`, `OrderStatusHistory`, `Order` (snapshot address via `delivery_address_snapshot`, `delivery_otp_verified_at`, `delivery_payment_collected_{at,via}`, `delivery_payment_settled_at`, `timing_type`, `scheduled_at`, refund fields, `items`, `statusHistory`/`status_history`, `restaurant/store`).
- `PreparationInstruction*s` (`emoji` per option), `PaymentCheckoutPayload`, `PaymentVerifyResult`, `Coupon`, `RideStatus` (13 states), `VehicleType {code, icon?, capacity, ac}` , `RideEstimate {vehicle_type, distance_km, duration_min, base_fare, distance_charge, time_charge, booking_fee, platform_fee, tax_amount, estimated_fare, fare_rule_id}` , `Ride` (all status timestamps, `driver{name?,phone?,rating?,latitude?,longitude?,user?}`), `AppConfig`, `PlaceResult`/`SearchPlacesResponse`/`PlaceDetails`/`ReverseGeocode`, `RideRoute`, `NearbyDriver {vehicle_type_name, distance_km, eta_min, rating}`, `OrderTracking*` (pickup/dropoff, partner, location w/ `is_stale`, route, eta, status w/ `source:'realtime'|'polling'`). `types/api.ts`: `ApiResponse`, `Paginated<T>` (Laravel-style cursor fields incl. `next_page_url`, `per_page`, `total`). `types/index.ts` re-exports everything; `types/razorpay.d.ts` declares `window.Razorpay`.

## 61. Infra libs — realtime, payments, maps, geo, misc

### `realtime.ts`
- `ChannelProvider {subscribe(channel, handler): ()=>void}` registered via `setChannelProvider` (default **none** — falls back to polling).
- `useRealtime<T>(id, channelName, pollFn)` polls every **POLL_INTERVAL_MS = 5000**; transparently swaps to the provider when registered. Exposed: `useRealtimeOrder(id)` → `order.{id}`, `useRealtimeRide(id)` → `ride.{id}`, `useRealtimeTracking(id)` → `private-orders.{id}` (returns `OrderTracking`).

### `razorpay.ts`
- Loads `https://checkout.razorpay.com/v1/checkout.js` once (`loadScript`).
- `createUsableCheckout(request, baseKey)`: accepts intent if `mock` or has `provider_order_id`, else re-requests under `{baseKey}:fresh`; still unusable → throw **"Could not start payment. Please try again."**
- `completeOrderPayment(checkout) → {status:'paid'|'cancelled', verify?}`: mock → verifies with deterministic `pay_`+`sha256(provider_order_id)` prefix16; real → opens Razorpay modal (`name:'SuperBasket', description:'Payment {payment_number}', theme.color:'#1b66f5'`, `ondismiss` → cancelled) then server-verifies.

### `googleMaps.ts` / `loadScript.ts`
- `loadGoogleMaps(key)`: once per key via `@googlemaps/js-api-loader` (`v:'weekly'`, libraries `maps`+`marker`+`geometry`), promise cached, dropped on failure. `loadScript(src)` caches script loads (Map-prefixed keys).

### `geo.ts`
- `parseCoordinate` (number|string|null → number|null), `hasValidCoordinates` (|lat|≤90, |lng|≤180), `haversineKm` (great-circle, `EARTH_RADIUS_KM=6371`), `canDeliverToCustomer` (`order_type !== 'pickup'`), `nearestEligibleStore` (open + deliverable + valid coords, min distance), `formatDistanceKm` (**"820 m"** / **"1.4 km"**), `estimateDeliveryMinutes` (clamped 8–60, null beyond 25 km), `coordsKey` (`lat.toFixed(4),lng.toFixed(4)`).

### `orderTracking.ts`
- `TRACKING_ACTIVE_STATUSES = ['PARTNER_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY','ARRIVED']`; `isTrackingActive`, `hasLiveLocation`, `formatEta` (**"~45 min"** / **"~1.5 hr"**), `formatDistance` (2dp <10 km, 1dp ≥10 km).

### `productOptions.ts`
- Option group helpers: `optionPrice` (price ?? price_adjustment), `optionAvailable` (is_available ?? is_active ?? true), `groupIsSingle` (`is_multi_select` false OR `selection_type==='SINGLE'`), `activeOptionGroups` (active, sort by `sort_order`), `groupMinSelect`/`groupMaxSelect` (single → 1), `defaultSelections` (defaults first, fill to min), `unitPricePreview` (single-group priced option replaces base price; multi adds `optionPrice`), `selectedOptionPrice`, `optionPriceLabel` (**"+₹10"**).

### `groceryCategories.ts`
- `findGroceryCategory(categories, id)` (deep child lookup for `?category=` links); `buildCategoryRail(categories, stockedIds)` → parent + stocked children indented (`isChild`).

### `location.ts`
- `DEFAULT_LOCATION` = `{label:'Home', address:'12 MG Road, New Delhi', lat 28.6139, lng 77.209}`; `POPULAR_AREAS` (5 New Delhi areas: Connaught Place 28.6315,77.2167 · Karol Bagh 28.645,77.19 · Saket 28.5245,77.206 · Lajpat Nagar 28.567,77.244 · Vasant Kunj 28.545,77.178); `currentLocation()` → Promise `{ok, location?, error?}` (permission/timeout/failure messages, timeout 8s, maxAge 60s); label "Current location".

### `utils.ts`
- `cn` (clsx + tailwind-merge), `formatCurrency` (`Intl.NumberFormat('en-IN',{currency:'INR'})`, NaN → **"₹0"**), `formatDate` (en-IN `7 Oct 2026`), `formatDateTime`, `timeFromNow` (**"just now"/"5m ago"/"2h ago"/"3d ago"**), `ratingLabel` (**"4.6"**, empty → **"New"**), `isOrderPaid` (lowercase === 'paid').

### `banner.ts`
- `bannerRoute(b)`: restaurant → `/restaurant/{target_id}` (fallback `/restaurants`), store → `/store/{id}`, product → `/product/{id}`, search → `target_url ?? '/search'`, url/service → `target_url ?? '/'`, null → `/`.

## 62. Mock data layer (`repositories/mock/`, 1638 lines)
- `mockState.ts`: shared `{carts: Map<string,Cart>, orders: Order[], walletBalance: 2500, walletTransactions: []}`; `recalculateCart` (subtotal/tax=0/delivery fee rebate ≤2 km grocery/`delivery_gst_percent`/packaging+handling − discount → total, min 0); `getOrCreateCart(userId, type)` key `"{userId}-{type}"`.
- `data.ts`: `img(seed)` Unsplash `(https://images.unsplash.com/photo-…?w=600&q=80)`; `mockCategories` (5 food + 5 grocery), 3 seed restaurants (Spice Villa 4.6, Biryani House 4.3, Tavola 4.2…), stores, products with addons/variation_options, coupons, delivery slots, saved places, vehicle types, banners.
- Repos: `food.ts` (83), `grocery.ts` (100), `ride.ts` (251, incl. `estimate`/`route`/`nearby-drivers` deterministic), `order.ts` (244, reorder/cancel/tracking/OTP/prep-instructions flows), `cart.ts` (164), `wallet.ts` (93), `payments.ts` (37, mock Razorpay verify), `user.ts` (184, auth + addresses + geocode fakes), `search.ts` (30, keyword filter), `banner.ts` (19, placement filter). All nodes rehydrate entities with `mockState`, so navigating works fully offline/demo.

## 63. A11y & responsive conventions
- `aria-label` on icon-only buttons (e.g. **"Close"**, **"Delete"**, **"Call driver"**, **"Cash"**, **"Clear search"**, **"Decrease/Increase quantity"**, **"Use my location"**, **"Dismiss"**, **"Swap pickup and destination"**); `aria-live="polite"` on toast region + quantity value; `aria-selected`/`role=tab` on tabs; `aria-current="page"` on active bottom-nav link; `aria-hidden` on decorative images.
- `focus-visible:outline-2 outline-brand-600` everywhere via button/input primitives + global `*:focus-visible`.
- Bot/nav: bottom nav is `md:hidden`, header content hidden on `sm` breakpoint, `sm:` blocks for map legend/toggle; `lg:` two-column on `/rides`, `/restaurants`, `/food`; `edge-bleed` full-bleed carousels; `no-scrollbar` horizontal rafts with `scroll-snap-x`.
- Skeleton loaders (`Skeleton`, `CardSkeleton`), `animate-pulse`; tap targets ≥ 44px for bottom-nav (min-h-14) and steppers.
- Date/time/currency always `en-IN`; `pb-safe` for iOS home-indicator; `dvh` for dynamic viewport heights.
- Empty/error/loading tri-state pattern standard: `EmptyState`/`ErrorState`/`Skeleton` per page section.

## 64. React Native (Expo) parity checklist & build guidance
1. **Nav**: convert `BrowserRouter` tree (Section 3) to Expo Router in `src/app/`: `(tabs)/` for `index`(Home)/`orders`/`rides`/`wallet`/`profile` (matches BottomNav, Section 6); stack routes for `food`, `grocery`, `restaurants`, `restaurant/[id]`, `stores`, `store/[id]`, `product/[id]`, `search`, `cart`, `checkout`, `order-confirmation/[id]`, `order/[id]`, `ride/[id]`, `profile/edit`, `profile/addresses`, `profile/payments`, `auth/login`, `auth/register`, `auth/forgot-password`, `auth/reset-password`. Guard auth-only routes with a `RequireAuth`-equivalent layout (`authStore.initialized` + `isAuthenticated`, redirect to `/auth/login?redirect=…`).
2. **Theme**: copy hex tables from Section 38 into a theme file (colors, ink, semantic, 3 shadows); service themes live in AppShell/shell state (rides=brand, food=food, grocery=grocery, neutral=brand) — drive header band + module tabs from the same var set; module-tab silhouettes can be drawn as SVG paths (reuse the razed `.module-background` paths) or simplified to overlapping rounded-top chips.
3. **Data**: port `apiClient` → fetch wrapper (base `http://localhost:8000/api/v1`, `sb-token` in expo-secure-store or AsyncStorage, 401 → clear + `auth:unauthorized` event); keep envelope unwrap + `ApiError`. Repositories layer ports 1:1; `IS_MOCK` default keeps the app runnable without a backend.
4. **State**: Zustand stores port verbatim (replace `localStorage` persist with `AsyncStorage` via `zustand/middleware` `persist` `storage` option; `sb-app` key).
5. **Queries**: keep `@tanstack/react-query` (works in RN); port `hooks/*` unchanged; query keys identical.
6. **Maps**: Google Maps JS API does not drop into RN — use `react-native-maps` + a provider map (`@react-native-google-places-autocomplete`, `google-places-autocomplete` for search/reverse) and keep the Google-Maps-linked flows (RideMap marker clustering/fan-out, MapPicker drag-pin, RideTrackingMap live dot + "Navigate" deep link via `Linking.openURL(url)`) as native equivalents; use `@react-native-community/geolocation` for `currentLocation()`.
7. **Payments**: port Razorpay Checkout to `react-native-razorpay` (load script concept is web-only); keep idempotency-key logic (`createUsableCheckout` base vs `:fresh`).
8. **Realtime**: swap polling (`5000 ms`) for a native provider when ready — keep `ChannelProvider`/`useRealtime*` shapes.
9. **Icons/typography**: `lucide-react` → `lucide-react-native` (same names); Inter via `expo-font` (`@expo-google-fonts/inter`).
10. **Dates/currency**: keep `Intl.NumberFormat('en-IN')` where Hermes supports it, else port `formatCurrency` via a small intl polyfill or a hand-rolled grouping to match **₹1,23,456.00** Indian style (assert with snapshots).
11. **Fire-and-forget**: local `toast()` → `react-native-toast-message` or a custom Animated toast store; `Modal`/`BottomSheet` → `react-native-modal` / `Modal from react-native` / `@gorhom/bottom-sheet`.
12. **Media**: `ImageProps` placeholder behavior → `expo-image` placeholder + transition.
13. **Units**: all strings are already kebab/camel-safe; keep exact user-facing copy (CTAs, empty states, errors, toasts) verbatim for feature parity.
14. Validate with `npx expo lint` + `npx tsc --noEmit` before done; test on both `ios` and `android` simulators against the mock data source first.
