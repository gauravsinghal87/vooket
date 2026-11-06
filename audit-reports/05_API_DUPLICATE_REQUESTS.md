# Duplicate and Overlapping API Requests

Date: 2026-11-02

## Baseline (before shared discovery)

- Food home issued `/discovery/home`, `/food/categories`, the Food hero banner, and `/food/restaurants?page=1`.
- Grocery home issued a second `/discovery/home` with a different query key, plus stores, categories, three banner placements and the store catalogue.
- Switching Food ↔ Grocery could therefore download and parse the same discovery envelope twice.
- `/discovery/home` itself duplicates restaurant objects across `recommended_restaurants`, `food.recommended`, `popular`, `top`, `fast` and `offers`.
- Discovery contains grocery stores/categories that were also fetched from the dedicated grocery endpoints.

## After shared discovery

- One cache key: `['discovery-home', coordsKey]`.
- Food and Grocery map the same envelope into their own shape.
- Measured Food → Grocery first switch: **no** `/discovery/home` request.
- Measured Grocery → Food and Rides → Food warm returns: **0 API calls, 0 JS**.

## Remaining duplicates observed

| Duplicate | Cause | Impact | Status |
|---|---|---|---|
| `/discovery/home` on baseline module switch | Different Food/Grocery query keys | ~86 kB decoded per repeat | Fixed with shared key |
| Food/Grocery rails also in dedicated endpoints | Backend serializes overlapping objects | Extra bytes only on first load | Backend-only fix proposed |
| Guest `/cart?type=grocery` twice | Cart state is requested by more than one mounted surface; both 401 for guests | Two tiny 401 responses (30 B decoded each) | Pre-existing; cache no longer cleared by guest 401 |
| Category data in discovery and `/food/categories` | Discovery includes a limited global category list; Food needs the full tree | Discovery bytes are not independently removable by frontend | Backend field-selection proposal |
| Banner placements | One request per placement | Small; 3 Grocery + 1 Food + 1 Rides request | Candidate for a batched endpoint |

## Measured request counts

| Scenario | Requests | Discovery requests |
|---|---:|---:|
| Initial Food load | 5 | 1 |
| Food → Grocery first switch | 8 (includes two guest cart 401s and delayed catalogue) | 0 |
| Grocery → Food warm | 0 | 0 |
| Food → Rides first switch | 3 | 0 |
| Rides → Food warm | 0 | 0 |

## Conclusion

The high-cost duplicate (discovery) is removed from module switches. The remaining duplicates are either tiny (guest cart) or require a backend contract change (overlapping discovery/list data and per-placement banners). TanStack Query already deduplicates identical in-flight keys; the fix focused on making the keys actually identical across modules.
