# Backend Eager-Loading Audit

Date: 2026-11-02
Status: read-only. No backend file, route, model or migration was changed.

## Observed loading behavior

| Area | Observation | Risk | Proposed action |
|---|---|---|---|
| Discovery restaurants | Multiple rails (`recommended`, `popular`, `top`, `fast`, `offers`) are assembled and serialized in one response. | Duplicate objects/bytes. | Deduplicate records or serialize a shared restaurant map with rail IDs. |
| Discovery grocery stores/categories | Also returned by dedicated Grocery endpoints. | Overlap between discovery and module endpoints. | Module-scoped discovery or field selection. |
| Grocery products | Brands eager-loaded with `whereIn` (good); variation option values loaded in separate queries per collected ID set. | Query growth with variation count. | Eager-load option values in one query keyed by collected IDs. |
| Restaurant/store vendor | Vendor relation loaded separately. | Extra queries per list. | Eager-load vendor in the list query when the serializer needs it. |
| Ratings | `avg_rating` correlated subquery per row. | Scales with row count. | Aggregate join or cached rating column if profiling shows pressure. |
| Food categories | Parents + children in two queries. | Not N+1; predictable. | Keep, or cache the tree per locale/active flag. |
| Grocery categories | Cache + zone + category queries. | Moderate. | Keep cache keyed by location/active filters. |

## Evidence

- 28 queries for `/discovery/home` in local profiling.
- 12 for `/food/restaurants`, 9 for `/grocery/stores`, 10 for `/grocery/products`.
- Query list showed repeated variation-option and relation-load patterns; it did not show a per-row query loop for categories.

## Constraints

- Changing eager loads or serializers changes the API response only if output is carefully preserved; it still requires backend authorization and regression tests.
- The local dataset is too small to prove production N+1 severity. The query count is the reliable signal.
- No executed migration or production SQL was prepared as a change. Index candidates are listed in `08_DATABASE_QUERY_AUDIT.md`.

## Recommended order if backend work is authorized

1. Add query-count tests for the six profiled routes.
2. Fix repeated variation-option loads and any confirmed per-row relation loads.
3. Deduplicate discovery serialization and add module/field selection.
4. Re-profile with production-sized data before adding indexes.
