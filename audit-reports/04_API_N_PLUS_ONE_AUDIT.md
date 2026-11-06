# API N+1 and Query-Count Audit

Date: 2026-11-02
Note: production database query counts are not directly accessible. The numbers below come from read-only local Laravel kernel profiling with the production code path.

## Local profiling results

| Route | Status | Time (ms) | Bytes | Queries | SQL (ms) |
|---|---|---:|---:|---:|---:|
| `/api/v1/discovery/home` | 200 | 168.6 | 86,204 | 28 | 20.2 |
| `/api/v1/food/restaurants` | 200 | 27.6 | 8,864 | 12 | 6.4 |
| `/api/v1/grocery/stores` | 200 | 19.2 | 5,358 | 9 | 4.1 |
| `/api/v1/grocery/products` | 200 | 42.5 | 25,633 | 10 | 6.8 |
| `/api/v1/food/categories` | 200 | 19.1 | 14,461 | 2 | 1.4 |
| `/api/v1/grocery/categories` | 200 | 29.2 | 20,534 | 5 | 2.2 |

## Observations

- `/discovery/home` is the heaviest route: 28 queries for one response. The top patterns are cache lookups/inserts, zone/serviceability resolution, restaurant/store rating subqueries, product deal/recommended `exists` subqueries and coupon loads.
- `/food/restaurants` performs zone lookup, a pagination count with Haversine, the restaurant query with an `avg_rating` subquery, and vendor loads.
- `/grocery/stores` performs zone lookup, a count with Haversine, store query with rating subquery, and vendor loads.
- `/grocery/products` eager-loads brands with `whereIn` (good) but loads variation option values in separate queries; the profile showed repeated variation-option query patterns.
- `/food/categories` uses two queries (parents + children), which is a deliberate eager-load pattern rather than row-by-row N+1.
- `/grocery/categories` performs cache lookups, zone lookup and category loads.

## Is this true N+1?

The strongest evidence is in variation option values and per-relation vendor/category loads, not a classic one-query-per-row loop. Rating averages are computed as correlated subqueries, which is one query per endpoint but can be expensive on large tables.

No query was changed. Proposed improvements:

- Eager-load variation option values in one query keyed by the collected IDs.
- Eager-load vendors for restaurants/stores where the serializer needs them.
- Replace correlated rating subqueries with aggregate joins or cached rating columns if data volume grows.
- Keep zone/serviceability caching, but verify cache keys include all location inputs.
- Add endpoint-specific query-count tests so regressions are visible.

## Confidence

- High confidence in the local query counts and SQL timings.
- Medium confidence that the same ratios hold in production; production data volume, indexes and cache warmness may differ.
- No production slow-query log, EXPLAIN plan or DB metrics were available.
