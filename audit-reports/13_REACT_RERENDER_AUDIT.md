# React Re-render Audit

Date: 2026-11-02
Important: no React Profiler/render-count instrumentation was run. This document records structural observations and measured route/network behavior; it does not claim component render counts.

## Structural changes that reduce render work

- Route-level lazy loading means a module switch does not mount Food, Grocery and Rides code at once.
- The shell (header, bottom dock, providers) stays mounted across module switches; only the route subtree changes.
- Discovery data is fetched once and read from cache by the destination module, so a warm switch does not wait for a network response before rendering.
- Shared `PageFallback` is only used while a lazy chunk downloads; warm switches with loaded chunks render directly.
- Mobile rides destination FlatList now has stable keys instead of `Math.random()`, preventing unnecessary row remounts.
- Mobile Food/Grocery homes still use `ScrollView` and map all items. This is a render/memory risk for long feeds.

## Measured behavior

| Scenario | Result |
|---|---|
| Food → Grocery route change | 1 ms to pathname change; 66,301 B JS on first switch |
| Grocery → Food warm | 1 ms; 0 JS, 0 API |
| Food → Rides first | 1 ms; 33,595 B local JS + Google Maps SDK |
| Rides → Food warm | 1 ms; 0 JS, 0 API |

These are not render-completion timings. Visible content still depends on the destination query state; Grocery’s catalogue request resolves after the active store.

## Observations

- Food/Grocery module components read mapped query data; they do not subscribe to the full discovery envelope in Zustand.
- Category grouping and grocery shelves use `useMemo`.
- Rides destination FlatList virtualization props were added; Food/Grocery ScrollView lists were not converted.
- Web images animate opacity on load; this is a small per-image state update, not a list-wide store update.
- No obvious whole-page state loop was found in the route smoke test.

## Recommendations

- Add React Profiler or why-did-you-render in a development-only build before making further render claims.
- Convert the longest mobile home feeds to `FlatList`/`FlashList` with a header component, preserving the sticky search/hero behavior.
- Add `getItemLayout` where row heights are fixed.
- Keep query selectors/mappers stable so cached arrays do not get recreated on every render.
