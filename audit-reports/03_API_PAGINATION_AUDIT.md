# API Pagination Audit

Date: 2026-11-02

## Paginated endpoints

| Endpoint | Pagination | Observed use |
|---|---|---|
| `/food/restaurants?page=1&latitude&longitude` | Page-based | Food home requests page 1; restaurant list supports infinite pages. |
| `/grocery/products?latitude&longitude&page=1` | Page-based | Product list baseline. |
| `/grocery/stores?latitude&longitude&per_page=50` | `per_page` | Grocery home asks for up to 50 stores. Only 3 returned at Jaipur South. |
| `/grocery/stores/{id}/products?latitude&longitude&per_page=60` | `per_page` | Grocery catalogue asks for 60 products per store. |

## Unpaginated or effectively unbounded responses

| Endpoint | Issue |
|---|---|
| `/discovery/home` | Returns all rails, stores, categories, products, coupons, banners and user sections in one envelope. No page or field selection. |
| `/food/categories` | Full category tree; grows with catalog. |
| `/grocery/categories` | Full tree at the requested location; 20.5 kB live at Jaipur South. |
| `/banners?service=...&placement=...` | Placement-scoped, so usually small; not a pagination problem. |
| `/rides/promos`, `/saved-places` | Small at current data volume, but no pagination contract. |

## Findings

- The main risk is **not** missing `page` parameters on list routes; it is the monolithic discovery envelope and full category trees.
- Grocery home asks for `per_page=50` stores even though the active-store selection needs one store plus perhaps a few alternatives. That is a contract-level over-fetch.
- The store catalogue is limited to 60 products but the page renders all returned products. At larger catalogues this becomes both a payload and render problem.
- Food recommendations are capped by backend rules rather than client pagination; the exact cap was not changed because the backend is read-only.

## Recommended changes (not applied)

1. Add module/field selection to `/discovery/home`.
2. Add cursor/page pagination to discovery rails if rail length can grow.
3. Request a smaller store page for the home (`per_page=10` or a dedicated nearest-store endpoint).
4. Add `summary=1` or explicit field selection to category endpoints.
5. Keep `per_page` bounded and validate the maximum on the backend.
6. For Grocery catalogue, implement infinite scroll instead of requesting 60 items at once when the UI only shows a few shelves initially.

No endpoint contract, backend file or database query was changed in this work.
