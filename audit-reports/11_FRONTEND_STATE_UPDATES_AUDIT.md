# Frontend State Update Audit

Date: 2026-11-02

## State layers

| Layer | Responsibility | Notes |
|---|---|---|
| Zustand `appStore` | Service selection, location, location address, Veg Mode, location picker open state | Persisted; small scalar state. |
| Zustand auth stores | User/session/token state | Cleared on logout and authenticated 401. |
| Zustand cart/rides draft stores | Feature-local draft state | Module/feature scoped. |
| TanStack Query | Server state: discovery, categories, banners, lists, cart, orders, wallet, rides | Shared QueryClient per app session. |
| Component state | UI toggles, scroll/dock visibility, form state | Mostly local. |

## Discovery state

- The discovery envelope is **not** copied into Zustand. It stays in TanStack Query.
- Food/Grocery pages read a mapped slice. A module switch reuses the cached query instead of writing a duplicate store value.
- The shared hook returns the query plus `food`/`grocery` mapped fields. It does not create a new global store.

## Cache clearing and user changes

- Web `resetQueryCache()` clears the QueryClient on email/phone/OTP/Google login, registration, logout, initialize failure and authenticated 401.
- Mobile does the same through the shared query client and auth store.
- A guest cart 401 no longer clears public discovery; only an authenticated session loss clears all server state.
- This prevents `recently_ordered`, `buy_again` and `monthly_essentials` from surviving a user change.

## Observations

- Selectors are used for small Zustand reads (for example service/location) rather than subscribing whole pages to the store.
- Discovery cache updates occur once per fetch; there is no interval or websocket writing the whole envelope.
- No measured Zustand notification count or React render count is available because profiling was not instrumented.

## Risks

- Authenticated discovery data is user-specific but the query key is coordinate-only. The clearing policy is the current safeguard; a user-scoped key would be stronger if multiple accounts can switch without a full logout.
- Long-lived caches for public categories/banners are safe; long-lived caches for user-specific orders/wallet should remain shorter or be invalidated after mutations.

## Recommendations

- If multi-account switching without logout is added, include user id in user-specific query keys.
- Keep server state in Query and UI state in Zustand; do not duplicate the discovery envelope in both.
