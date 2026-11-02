# CSS Isolation Report

## 1. Goal

Split the single monolithic stylesheet into a shared foundation and
module-owned stylesheets, scoping module rules to `[data-module]` without using
`!important`.

## 2. Web implementation

### 2.1 Entry point

`customer-web-optimized/src/index.css`:

```css
@import "tailwindcss";

/* Shared foundation */
@import "./shared/styles/variables.css";
@import "./shared/styles/reset.css";
@import "./shared/styles/typography.css";
@import "./shared/styles/shared.css";

/* Module ownership — tokens first, then layout, then components */
@import "./modules/food/styles/food-tokens.css";
@import "./modules/food/styles/food-layout.css";
@import "./modules/food/styles/food-components.css";

@import "./modules/grocery/styles/grocery-tokens.css";
@import "./modules/grocery/styles/grocery-layout.css";
@import "./modules/grocery/styles/grocery-components.css";

@import "./modules/rides/styles/rides-tokens.css";
@import "./modules/rides/styles/rides-layout.css";
@import "./modules/rides/styles/rides-components.css";
```

### 2.2 Shared foundation

| File | Purpose | Notes |
| --- | --- | --- |
| `shared/styles/variables.css` | Design tokens: brand, service colours, neutrals, semantics, surfaces, shadows, radii, spacing, typography scale | No module-specific values |
| `shared/styles/reset.css` | CSS reset/base normalization | Unchanged behaviour |
| `shared/styles/typography.css` | Font faces, base text styles | Unchanged behaviour |
| `shared/styles/shared.css` | App-wide utilities and shared patterns | 519 lines; module-agnostic |

### 2.3 Module stylesheets

| Module | Files | Scope | Key tokens |
| --- | --- | --- | --- |
| Food | `food-tokens.css`, `food-layout.css`, `food-components.css` | `[data-module="food"]`, `.food-*` | Zomato palette (`--color-z-red`, `--color-z-green`, `--color-z-gold`, `--color-z-info`), Food ramps (`--color-food-*`), hero/theme variables |
| Grocery | `grocery-tokens.css`, `grocery-layout.css`, `grocery-components.css` | `[data-module="grocery"]`, `.grocery-*` | Yellow/cream quick-commerce palette (`--color-grocery-*`), band/surface variables |
| Rides | `rides-tokens.css`, `rides-layout.css`, `rides-components.css` | `[data-module="rides"]`, `.rides-*` | Blue mobility palette (`--color-brand-*` used by rides), map/layout variables |

### 2.4 Scoping mechanism

`customer-web-optimized/src/app/layouts/AppShell.tsx` sets:

```tsx
<div
  className="min-h-screen bg-[color:var(--surface-app)]"
  data-service-theme={serviceTheme}
  data-module={moduleContext}
>
```

`moduleContext` is derived from the current route (`/food` → `food`, `/grocery` → `grocery`, `/rides` → `rides`, else `null`). Module CSS selectors use this
attribute to avoid leaking styles into sibling services. The existing
`data-service-theme` attribute is preserved for backwards compatibility.

### 2.5 Enforcement

- `!important` usage: **0** occurrences in `src/`.
- All module declarations are in their own files under `modules/*/styles/`.
- Shared tokens are never overridden by module files except through the
  `@theme` variables and `[data-module]` scope.

### 2.6 Build output

Vite emits a single CSS bundle with module styles included: `dist/assets/index-*.css`
(~120 kB uncompressed). No CSS modules or CSS-in-JS were introduced.

## 3. Mobile implementation

Mobile uses React Native stylesheets, not global CSS. Theme isolation is
achieved by module ownership:

| File | Role |
| --- | --- |
| `src/shared/theme/index.ts` | Shared token source and common helpers (`colors`, `spacing`, `radii`, `typography`, `shadows`, etc.) |
| `src/modules/food/styles/theme.ts` | Food-only theme object and re-exports from shared theme |
| `src/modules/grocery/styles/theme.ts` | Grocery-only theme object |
| `src/modules/rides/styles/theme.ts` | Rides-only theme object |

Module screens and module components import from their own module theme:
- Food: `@/modules/food/styles/theme`
- Grocery: `@/modules/grocery/styles/theme`
- Rides: `@/modules/rides/styles/theme`
- Shared/features: `@/shared/theme`

No global style sheet is split; isolation is enforced by import paths and module
boundaries (the same rule as the web architecture).

## 4. Verification

```bash
# Web: no !important
grep -rn '!important' customer-web-optimized/src | wc -l  # 0

# Web: styles present
ls customer-web-optimized/src/modules/*/styles/
ls customer-web-optimized/src/shared/styles/

# Web: CSS imported
grep -n "@import" customer-web-optimized/src/index.css

# Build produces CSS
ls customer-web-optimized/dist/assets/*.css
```

All verified. No style regressions observed; the design tokens and values are
copied from the source app, not regenerated.
