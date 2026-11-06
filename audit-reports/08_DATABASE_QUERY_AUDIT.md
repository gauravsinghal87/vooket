# Database Query Audit

Date: 2026-11-02
Access: read-only local Laravel profiling. No production database access, migration or write was performed.

## Local measurements

| Route | Queries | SQL time (ms) | Wall time (ms) | Bytes |
|---|---:|---:|---:|---:|
| `/api/v1/discovery/home` | 28 | 20.2 | 168.6 | 86,204 |
| `/api/v1/food/restaurants` | 12 | 6.4 | 27.6 | 8,864 |
| `/api/v1/grocery/stores` | 9 | 4.1 | 19.2 | 5,358 |
| `/api/v1/grocery/products` | 10 | 6.8 | 42.5 | 25,633 |
| `/api/v1/food/categories` | 2 | 1.4 | 19.1 | 14,461 |
| `/api/v1/grocery/categories` | 5 | 2.2 | 29.2 | 20,534 |

`discovery/home` wall time includes kernel dispatch, serialization and response building, not only SQL.

## Patterns observed

- Cache lookups/inserts and zone/serviceability work are a meaningful share of the 28 discovery queries.
- Rating averages are fetched with correlated subqueries in restaurant/store/product queries.
- Product and deal rails use `exists` subqueries.
- Variation option values are loaded in separate queries for collected IDs.
- Vendor/category relations are loaded in additional queries.

## Index candidates (proposed, not applied)

- Restaurant/store latitude/longitude and open/active filters used by zone and Haversine filters.
- Category parent/child foreign keys used by category trees.
- Product store/category/active filters used by catalogue queries.
- Coupon/offer active/date filters used by discovery.

These are hypotheses based on the query shapes. No `EXPLAIN` plan or production slow-query log was available, so they are not confirmed missing indexes.

## Limitations

- Local dataset is small (8 restaurants, 7 stores, 123 products, 72 categories), so query time is not representative of production scale.
- Production DB engine, indexes, cache hit ratio and connection latency were not accessible.
- No query was changed and no database change was proposed as an executed migration.
