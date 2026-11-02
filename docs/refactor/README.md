# Customer Apps Refactor — Documentation Index

Optimized apps:

- `customer-web-optimized/` — React 18 + Vite + Tailwind v4
- `customer-app-optimized/` — Expo SDK 54 + Expo Router

Source apps remain unchanged in `customer-web/` and `customer-app/`.

## Documents

| Document | Contents |
| --- | --- |
| [ARCHITECTURE_AUDIT.md](./ARCHITECTURE_AUDIT.md) | Baseline audit, target dependency rules, folder structures, ownership map, risks |
| [MODULE_COMPONENT_MAPPING.md](./MODULE_COMPONENT_MAPPING.md) | Original → optimized path for every page, component, hook, store, service and route |
| [SCREEN_MIGRATION_PLAN.md](./SCREEN_MIGRATION_PLAN.md) | Executed phase plan, route-by-route migration tables, verification gates, rollback |
| [COMPONENT_REUSE_PLAN.md](./COMPONENT_REUSE_PLAN.md) | Shared vs module-specific components, aliases, duplication removed, future reuse rules |
| [CSS_ISOLATION_REPORT.md](./CSS_ISOLATION_REPORT.md) | Web CSS split, `[data-module]` scoping, zero `!important`, mobile theme isolation |
| [THEME_MAPPING.md](./THEME_MAPPING.md) | Shared tokens and Food/Grocery/Rides theme values on web and mobile |
| [REMOVED_DUPLICATES_OPTIMIZED.md](./REMOVED_DUPLICATES_OPTIMIZED.md) | Dead files removed, duplication eliminated, structure optimizations |
| [VERIFICATION_AND_REGRESSION.md](./VERIFICATION_AND_REGRESSION.md) | Commands, build/export results, route manifests, fix list, regression checklist, known issues |

## Final verification snapshot

| App | Typecheck | Lint | Build / Export | Doctor |
| --- | --- | --- | --- | --- |
| Web | Pass | Pass (0 problems) | Vite build pass | – |
| Mobile | Pass | Pass (0 problems) | Web + iOS + Android export pass | 18/18 |

Detailed outputs are in `VERIFICATION_AND_REGRESSION.md`.
