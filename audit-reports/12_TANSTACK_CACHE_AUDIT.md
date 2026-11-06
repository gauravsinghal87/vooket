# TanStack Query Cache Audit

Date: 2026-11-02

## Shared client

| Platform | File | Defaults |
|---|---|---|
| Web | `customer-web-optimized/src/shared/query/queryClient.ts` | `staleTime: 60 s`, `retry: 1` |
| Mobile | `customer-app-optimized/src/shared/query/queryClient.ts` | `staleTime: 30 s`, `retry: 1`, `refetchOnWindowFocus: false` |

Both clients are module-level singletons so auth code can clear them.

## Key policies

| Query | Key | Stale | GC | Refetch on focus |
|---|---|---:|---:|---|
| Discovery | `['discovery-home', coordsKey]` | 5 min | 30 min | No |
| Food categories | `['food-categories']` | 10 min | 30 min | No |
| Food hero banner | `['banners','food_home_hero']` | 5 min | 30 min | No |
| Food restaurants | `['food-restaurants', filter, lat, lng]` | default | default | default |
| Grocery categories | `['grocery-categories', coordsKey]` | 10 min | 30 min | No |
| Grocery hero/brand/festive banners | `['banners', placement]` | 5 min | 30 min | No |
| Active grocery store | `['grocery','active-store', coordsKey]` | 5 min | 30 min | default |
| Grocery catalogue | store/filter/coords key | 5 min | 30 min | default |
| Rides promos/banners | `['ride-promos']`, `['banners','rides_promotions']` | 5 min | 30 min | No |
| Rides saved places | `['saved-places']` | 1 min | 10 min | default |
| App config | `['app-config']` | 5 min | default | default |

## Duplicate prevention

- TanStack deduplicates simultaneous requests with the same key.
- The important fix was making Food and Grocery use the same discovery key. Before, their keys differed, so the cache could not dedupe a module switch.
- Measured Food → Grocery switch: no discovery request.
- Measured warm Grocery → Food and Rides → Food: 0 requests.

## Cache clearing

- `resetQueryCache()` calls `queryClient.clear()`.
- Called on login/register/logout/initialize failure and on authenticated 401.
- The 401 listener checks `isAuthenticated` first. A guest cart 401 is expected and must not wipe public discovery. This was found during measurement: the first implementation cleared on every 401 and caused Food queries to refetch on every return.
- Cache keys are coordinate-scoped, not user-scoped; clearing on auth change is therefore mandatory for user-specific sections.

## Remaining considerations

- `food-restaurants` and some other queries still use default stale times. They are less expensive than discovery; tune only with evidence.
- Prefetching discovery data on dock hover was not added; chunk prefetch was added. Data prefetch could be a next step but may waste requests for users who do not switch.
- The rides driver/estimate queries intentionally use shorter stale times because their data is time-sensitive.
