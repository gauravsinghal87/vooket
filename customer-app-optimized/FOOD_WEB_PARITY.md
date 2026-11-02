# FOOD WEB PARITY REPORT
## customer-web vs customer-app /food

Source of truth: customer-web/src/pages/food.tsx
Route: /food

### Section Order (web)
1. Food Hero Banner (food_home_hero)
2. Food Categories
3. Promos (PromoRail) — if present
4. ExploreMore + FoodFilterChips (filters)
5. Popular dishes (horizontal Rail) — products from getHome()
6. Deals for you (horizontal Rail) — deals from getHome()
7. Restaurants delivering to you (grid) + filters applied to recommended

### API Endpoints/Queries (web)
- Hero: useQuery({ queryKey: ['banners','food_home_hero'], queryFn: () => repositories.banners.getByPlacement('food','food_home_hero') })
- Home data: useQuery({ queryKey: ['food-home'], queryFn: () => repositories.food.getHome() })
- Categories: useQuery({ queryKey: ['food-categories'], queryFn: () => repositories.food.getCategories() })

Repositories (web): repositories.banners.getByPlacement(service, placement), repositories.food.getHome(), repositories.food.getCategories().

### Data shape (web food.getHome)
Returns: products, deals, promos, recommended (restaurants), etc. (as used above)
- products → Popular dishes (horizontal)
- deals → Deals for you (horizontal) 
- promos → PromoRail
- recommended → Restaurants list (filtered by FoodFilterId: 'recommended'|'topRated'|'fastest'|'freeDelivery')

### Hero
Placement: food_home_hero (service='food')
Component: HeroCarousel banners={banners} size="large" (web). Rendered inside overflow-hidden rounded-3xl.

### Navigation
Restaurant card tap → /restaurant/{id} (via FoodRestaurantCard)
Dish/Product tap/add → DishCard behavior (add to cart/product detail per web)
Category tap → FoodCategories navigation (web component handles)

### Filters
FoodFilterChips: 'recommended','topRated','fastest','freeDelivery'
applyFoodFilter(list, filter) applied to recommended
Caption: FILTER_CAPTION[filter]

### Mobile comparison
Current mobile (food/index.tsx): uses ['home','food'] query (different key), gets cuisines (not categories), renders offers/recommended/top/products/fast in different order. Missing hero (food_home_hero), missing promos, missing ExploreMore/filter chips, missing deals section, uses legacy section names/order. Uses cuisines vs categories endpoint. Uses FoodProductRow vs DishCard style.

### Required changes
Rewrite app/food/index.tsx to match web: hero (separate banners query), categories (['food-categories']), home (['food-home']), apply filters to recommended, add PromoRail if present, add ExploreMore+FoodFilterChips, Popular dishes (products horizontal), Deals for you (deals horizontal), Restaurants delivering to you grid with filter state. Keep Screen, Header/ModuleSwitcher/Search/BottomNav via Screen. Use existing RN components where possible; may need to port or adapt.

## Implementation (customer-app) — DONE
- app/food/index.tsx rewritten to web order: hero → categories → promos → ExploreMore → filter chips → Popular dishes → Deals for you → Restaurants delivering to you.
- src/components/food.tsx new: FoodHeroCarousel (16/9, rounded-3xl, food accent dots, auto-advance 4.5s), FoodCategories (All chip + 68px category circles), FoodPromoRail (248px offer cards w/ service icon + code-toast), ExploreMore (142px filter cards), FoodFilterChips, FoodDishCard (172px, AddToCartControl icon, sold-out overlay, % off badge, compare price), FoodRestaurantCard (4/3 cover grid card), FoodSectionHeader (See all → /restaurants), skeletons, applyFoodFilter/FILTER_LABELS/FILTER_CAPTION (web food-filters port).
- Query keys separated per section: ['food-home'], ['food-categories'], ['banners','food_home_hero'].
- Hero placement confirmed backend: GET /banners?service=food&placement=food_home_hero (backend/routes/api.php + DiscoveryController banners()).
- Filters toggle to 'recommended' on re-selecting the active one (web behavior); feed empty state has Clear filters action when filter !== recommended; feed error state has Retry (home.refetch()).
- Verified: `npx tsc --noEmit` clean, `npx expo-doctor` 18/18, `npx expo export --platform android` succeeds.

## Restaurant listing & image parity (customer-app) — DONE

### Web behavior (source of truth)
- `customer-web/src/pages/restaurants.tsx` (`/restaurants` route) does NOT read the `cuisine` URL param. It queries
  `getRestaurants({ search, latitude, longitude })` with key `['restaurants', search, latitude ?? null, longitude ?? null]`.
  So `Food category → /restaurants?cuisine=Starters` renders the full (unfiltered) restaurant grid — the param is decorative.
- `repositories/api/food.ts getRestaurants` supports `cuisine` qs, but only the web mock repo uses it
  (`cuisine_type?.includes(...)`); the page never passes it.
- Backend `GET /api/v1/food/restaurants?cuisine=X` does `where('cuisine_type', X)` EXACT match (no substring, no case fold).
  `cuisine_type` is CSV like `'North Indian, Mughlai'` — verified `cuisine=Starters` returns 0 rows.
  Dish categories (`Starters`, `Main Course`, `Breads`, `Desserts`, `Beverages`, `Biryani`, `Pizza`, ...) are NOT cuisine types,
  so forwarding them to the API always yields an empty list.

### Mobile implementation
- `app/restaurants/index.tsx` now matches web's request contract: `getRestaurants({ search, latitude, longitude })` — cuisine is not
  forwarded to the API. `cuisine` is still read from the URL, kept in the query key (`['restaurants', cuisine, search, lat, lng]`)
  for cache separation, and shown in a "Showing: {cuisine}" chip with clear action (chip state only; web has no equivalent UI).
- FoodCategories (components/food.tsx) uses web's exact link contract: All → `/restaurants`, category → `/restaurants?cuisine=${encodeURIComponent(name)}`.

### Image fix (was gray placeholders)
- Root cause: `cards.tsx` `coverImg: {}` (RestaurantCard) and `bannerImg: {}` (BannerCarousel) had NO width/height, so
  RN `<Image>` rendered at 0×0 → only the grey fallback panel showed. Fixed to `width:'100%', height:'100%'`
  (parents `cover` 144px / 240×120 already constrain layout).
- Fields: use `restaurant.cover_image ?? restaurant.logo`; Restaurant model accessors fall back to vendor logo/cover_image.
- Resolver (`utils/assetUrl.ts`) already correct: absolute `http://localhost:8000/storage/vendor-images/...` → dev host rewritten
  to the `EXPO_PUBLIC_API_BASE_URL` origin, `/storage` prefix preserved, `/api/v1` never prepended (reused, not duplicated).
- Data reality: only `Spice Villa` in the live `/food/restaurants` feed actually has logo/cover_image; the rest are NULL and
  correctly render the grey placeholder (web shows the same placeholder for null images).
- Dev-only logs (temporary, removed after on-device validation): `[RESTAURANT]` in cards.tsx RestaurantCard
  (name/id/rawImage/resolvedImage/hasImage) and `[RESTAURANTS]` in app/restaurants/index.tsx (cuisine/count/firstImage).

### Verified
`npx tsc --noEmit` clean, `npx expo-doctor` 18/18, `npx expo export --platform android` succeeds.
