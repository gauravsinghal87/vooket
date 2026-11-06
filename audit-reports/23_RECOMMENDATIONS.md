# Recommendations

Date: 2026-11-02
Ordered by impact and risk.

## High impact, backend authorization required

1. **Make discovery module-scoped**
   - Add `?include=food|grocery|both` or separate endpoints.
   - A Food-only customer should not download the Grocery envelope and vice versa.
2. **Remove duplicate serialization**
   - `recommended_restaurants` duplicates `food.recommended`; overlapping rails repeat objects.
3. **Add summary/detail field selection**
   - Rails need card fields, not menu/variation/detail fields.
4. **Bound or paginate rails**
   - Cap recommendation rails explicitly; paginate restaurant/store lists.
5. **Fix confirmed eager-load hotspots**
   - Variation option values, vendor relations and correlated rating subqueries.
6. **Add query-count/cache tests**
   - Prevent discovery and category routes from regressing.

## High impact, frontend-only

7. **Virtualize long mobile home feeds**
   - Convert Food/Grocery `ScrollView` lists to `FlatList`/`FlashList` with a header component preserving the sticky search/hero.
8. **Defer or lighten Rides maps**
   - The Google Maps SDK is about 1.08 MB decoded on first Rides entry. Load it after the first useful paint, or use a lighter map surface if product requirements allow.
9. **Reduce guest cart 401s**
   - Avoid mounting duplicate cart queries for guests, or skip the cart request when there is no token.
10. **Batch banner placements**
    - One request per placement adds request overhead, especially on Grocery (3 placements).

## Medium impact

11. **Image variants/CDN**
    - Return thumb/card/detail URLs from the backend and use `srcset` on web.
12. **Rebuild and profile mobile APK**
    - The current APK predates the performance edits. Run a device profile after a new EAS build.
13. **Add React Profiler in a dev build**
    - Before making further render-count claims.
14. **User-scoped query keys**
    - If multi-account switching without logout is introduced, include user id in user-specific query keys.

## Low impact / hygiene

15. Tune stale times for restaurant lists only with evidence.
16. Recompress unused demo JPGs if they remain bundled.
17. Add bundle analyzer output to CI.
18. Document CDN cache headers for API/image responses.

## Do not do without explicit approval

- Change API response contracts.
- Run production migrations.
- Modify the original apps.
- Hide loading states to make timings look better.
