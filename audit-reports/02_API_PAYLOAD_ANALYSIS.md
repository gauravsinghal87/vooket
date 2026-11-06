# API Payload Analysis

Date: 2026-11-02
Primary endpoint: `GET /discovery/home?latitude=26.85&longitude=75.80` (Jaipur South, Food + Grocery serviceable).

## Measured payload sizes

| Endpoint | Decoded bytes | Transfer bytes (live run) | Notes |
|---|---:|---:|---|
| `/discovery/home` | 86,193 | 12,936 | Live endpoint, uncompressed decoded body. |
| `/food/categories` | 14,461 | 2,256 | Full parent/child tree. |
| `/food/restaurants?page=1` | 8,923 | 2,446 | Page 1 only. |
| `/banners?service=food&placement=food_home_hero` | 775 | 754 | Near-empty payload. |
| `/app-config` | 1,144 | 987 | Branding/maps config. |
| `/grocery/stores?per_page=50` | 5,417 | 1,767 | 3 stores at this location. |
| `/grocery/categories` | 20,533 | 4,070 | Larger than Food categories at this location. |
| `/grocery/stores/1/products?per_page=60` | 22,931 | 4,659 | Catalogue request; starts after store resolution. |

Local Laravel profiling measured `/discovery/home` at 86,204 B with 28 queries and 20.2 ms SQL time (kernel dispatch; production database behavior may differ).

## Duplication inside `/discovery/home`

Observed response shape:

- `recommended_restaurants` duplicates `food.recommended`.
- Food rails (`recommended`, `popular`, `top`, `fast`, `offers`) repeat restaurant objects that also appear in the restaurant list endpoint.
- Grocery `stores` and `categories` overlap with the dedicated store/category endpoints.
- `food.products` / `food.deals` are product cards that may also appear in restaurant menus.
- Authenticated responses add user-specific `recently_ordered`, `buy_again` and `monthly_essentials`.

The frontend only needs a subset per surface:

- Food home needs rails, food categories, hero banners, and the first restaurant page.
- Grocery home needs store list, category navigation, hero/brand/festive banners, and one store catalogue.
- Rides does not need `/discovery/home` at all.

## Client-side handling

- Web and mobile now fetch the envelope once per coordinate key and map it into a Food or Grocery shape.
- The map is shallow list extraction plus fallback aliases; it does not clone the full nested object graph.
- Categories, banners and store lists are still fetched from their dedicated endpoints where the module needs the full scoped result. These are small except Food categories and Grocery categories.

## Findings

1. **Monolithic first payload**: 86 kB decoded at a serviceable location is a large first request, and it includes both modules even when the customer only opens one.
2. **Duplicate restaurant/product objects**: the same records appear in multiple rails and in dedicated list endpoints, increasing bytes and parsing work.
3. **User-specific data mixed with public data**: authenticated discovery contains per-user rails. Caching must be user-aware or cleared on auth transitions; the implementation clears the whole client on authenticated logout/401.
4. **No field selection**: the client cannot ask for only Food or only Grocery, nor omit card fields it does not render.

## Recommendations (backend changes need separate authorization)

- Add `?include=food|grocery|both` or module-scoped discovery endpoints.
- Remove `recommended_restaurants` duplication or make it a compatibility alias not serialized twice.
- Paginate restaurant/store rails or cap them explicitly.
- Split summary/detail card fields; omit long descriptions, image metadata and nested options from rails.
- Keep user-specific sections in an authenticated-only response or separate endpoint.
