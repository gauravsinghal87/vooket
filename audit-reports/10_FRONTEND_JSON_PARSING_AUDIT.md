# Frontend JSON Parsing and Transform Audit

Date: 2026-11-02

## Discovery parsing

- `/discovery/home` decoded body at Jaipur South: 86,193 B.
- The browser performs the JSON parse; the app then runs a shallow mapper:
  - Food: rails, products, banners, categories, promos, serviceability.
  - Grocery: buy-again, monthly essentials, recommended, deals, stores, categories, recently viewed, banners, promos, serviceability.
- Both mappers run once per successful shared query and the result is cached in TanStack Query.
- Before the fix, Food and Grocery used different query keys, so a module switch could fetch, parse and map the same envelope again.

## Other transforms observed

| Transform | Location | Cost/notes |
|---|---|---|
| Restaurant list flattening | Food pages | Small page-1 list; no profiling data. |
| Category tree grouping | Food/Grocery hooks | Memoized; one pass over category arrays. |
| Grocery shelves grouping | Mobile Grocery home | One `Map` pass over store products; memoized. |
| Cart/price calculations | Cart/product components | Small arrays; not a discovery-scale cost. |
| Query mapping | Shared discovery hook | Shallow list extraction; cached. |

## What was not found

- No manual `JSON.parse(JSON.stringify(...))` of discovery data.
- No per-component re-mapping of the full discovery envelope.
- No large string concatenation or `encodeURIComponent` over the payload.
- No evidence of a JSON parse bottleneck separate from network latency in this session.

## Limitations

- The browser Performance API does not expose a standalone JSON parse duration for fetch responses. The report therefore does not claim a parse-time number.
- React render profiling was not instrumented, so parse-to-render attribution is not measured.

## Recommendations

- Keep parsing/mapping in the shared hook; do not duplicate it in page components.
- If the envelope remains monolithic, consider a Web Worker parse only if a real parse profile shows a main-thread problem. There is no evidence for that yet.
- Backend field selection is the higher-leverage fix: less JSON to parse and less memory to hold.
