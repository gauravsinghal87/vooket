# Security and Privacy Audit (Cache/User Data)

Date: 2026-11-02
Scope: frontend caching and auth transitions in the optimized apps. Backend auth was not changed.

## Risks reviewed

| Risk | Mitigation |
|---|---|
| User-specific discovery rails (`recently_ordered`, `buy_again`, `monthly_essentials`) survive logout | `resetQueryCache()` clears the QueryClient on logout/login/register/initialize failure and authenticated 401. |
| Public discovery cache cleared by a guest 401 | Unauthorized handler checks `isAuthenticated`; guest cart 401 does not clear public cache. |
| Cross-account cache leak | Full client clear on auth transitions; user id is not yet part of discovery keys, so clearing is mandatory. |
| Token persistence | Existing token storage was not changed. Web uses the existing localStorage key; mobile uses the existing token service. |
| 401 handling | API clients already dispatch unauthorized events; the optimized apps now clear server state only when an authenticated session ends. |
| Sensitive data in logs/docs | No tokens, passwords or private keys are included in this report. The Google Maps browser key is public client configuration supplied by app config and was not modified. |

## What was verified

- Web auth store calls `resetQueryCache` after successful login/register and on logout/initialize failure.
- Web app providers listen for `auth:unauthorized` and clear only when `isAuthenticated` is true.
- Mobile auth store calls the shared `resetQueryCache` on auth transitions and in `onUnauthorized`, with the same authenticated check.
- Query keys for discovery are coordinate-scoped, not user-scoped; the clear policy is the safeguard.

## Residual risks

- If an authenticated user’s token is replaced without a logout/login transition, stale user-specific cache could remain. The current app flows use logout/login.
- Browser localStorage tokens are exposed to XSS as before; this work did not change token storage.
- Public discovery data itself is not sensitive, but authenticated sections are. A user-scoped key would provide defense in depth.

## Recommendations

1. Include user id in user-specific query keys if multi-account switching is added.
2. Consider httpOnly cookie auth if the architecture allows it; not changed here.
3. Add a test that simulates login → logout → login as a different user and asserts discovery/orders/wallet caches are empty.
4. Keep the authenticated-only 401 clearing condition; do not revert to clearing on every guest 401.
