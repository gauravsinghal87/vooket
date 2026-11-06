# API Serialization and Frontend Mapping Audit

Date: 2026-11-02

## What the client receives

`/discovery/home` returns a JSON envelope with:

- `data.food` rails and product/category data;
- `data.grocery` rails, stores, categories and user sections;
- `data.recommended_restaurants` duplicate;
- top-level `categories` and `offers`;
- `meta.serviceability` and `meta.grocery_serviceability`.

At Jaipur South the decoded body is 86,193 B. The browser parses it once per fresh coordinate key after the shared-discovery change.

## Frontend mapping

Web and mobile use the same mapping approach:

- `mapFoodDiscovery(data, meta)` selects rails, products, banners, categories, promos and serviceability.
- `mapGroceryDiscovery(data, meta)` selects grocery rails, stores, categories, banners, promos and serviceability.
- Fallback aliases keep compatibility with older response shapes.
- The maps are shallow list selections; they do not deep-clone the envelope.

The mapping runs once per successful query and its result is cached. Food/Grocery pages then read their own mapped slice from the query cache.

## Serialization observations

- No manual `JSON.stringify` of the discovery payload exists in the module pages.
- The previous duplicate fetch caused the browser to parse and map the same 86 kB envelope again on a Food/Grocery switch; that duplicate parse is removed.
- Zustand is not used to store the discovery envelope; it remains server state in TanStack Query. This avoids broad store notifications.
- The backend serializer still emits duplicate object shapes (`recommended_restaurants` and `food.recommended`, overlapping rails). That is serialization cost on the server and bytes on the wire.

## Measured cost context

- Initial Food load API decoded: 111,466 B total, of which discovery is 86,163 B.
- Discovery request duration in the final run: 2,178 ms; this is network/API latency, not JSON parse time.
- No separate JSON.parse timing was captured. The browser does not expose a standard “JSON parse duration” entry for fetch responses, so the report does not invent one.

## Recommendations

- Backend: stop serializing the same restaurant/product object twice; add field selection or module-specific discovery.
- Backend: omit long card fields and nested relations that rails do not render.
- Frontend: keep mapping shallow and cached; do not add a second transform layer per component.
- If parse cost becomes measurable, split the first payload into module-specific requests rather than optimizing client parsing of a monolithic response.
