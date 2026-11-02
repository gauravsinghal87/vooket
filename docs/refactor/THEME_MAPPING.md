# Theme Mapping — Shared Tokens and Module Identity

## 1. Principle

Colour/spacing/typography values are defined once. A service gets its identity
by reading a module-scoped view of those tokens, not by copying values into each
screen.

- **Web**: CSS custom properties. Shared values live in
  `shared/styles/variables.css`; module values live in
  `modules/*/styles/*-tokens.css` and are scoped by `[data-module]`.
- **Mobile**: TypeScript objects. `shared/theme/index.ts` holds the raw scales;
  `modules/{food,grocery,rides}/styles/theme.ts` expose the branded module view.

## 2. Web token map

### 2.1 Shared foundation

| Token | Value | Used by |
| --- | --- | --- |
| `--color-brand-500` | `#3386ff` | Shared brand accents |
| `--color-brand-600` | `#1b66f5` | Rides identity, links, focus |
| `--color-ink-50` | `#f7f6f4` | App canvas |
| `--color-ink-100` | `#e9e7e3` | Borders |
| `--color-ink-900` | `#17140f` | Primary text |
| `--color-neutral-500` | `#6b675f` | Muted text |
| success / danger / warning | `#16a34a` / `#dc2626` / `#f59e0b` | Semantic states |

### 2.2 Food module (`modules/food/styles/food-tokens.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--color-z-red` | `#e23242` | Primary (Zomato red) |
| `--color-z-red-dark` | `#c72232` | Pressed/dark |
| `--color-z-red-soft` | `#fdeaec` | Tint surfaces |
| `--color-food-50…950` | red ramp, 600 = `#e23242` | Food-only scale |
| `--color-z-green` | `#05893e` | Veg/rating |
| `--color-z-green-soft` | `#e7f6ed` | Veg tint |
| `--color-z-gold` | `#cd9a50` | PRO |
| `--color-z-gold-soft` | `#fbedd1` | PRO tint |
| `--color-z-info` | `#296cd8` | Info |
| `--color-z-info-soft` | `#e3efff` | Info tint |
| `--hero-header-bg`, `--hero-bg` | red gradients | Food hero |
| `--hero-active-color`, `--hero-search-accent` | `--color-z-red` | Food band controls |

### 2.3 Grocery module (`modules/grocery/styles/grocery-tokens.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--color-grocery-500` | `#f5b921` | Primary yellow |
| `--color-grocery-700` | `#b87f06` | Pressed/dark |
| `--color-grocery-100` | `#fff8e1` | Soft surface |
| `--color-grocery-50` | `#fffdf5` | Canvas |
| `--hero-active-color` | `--color-grocery-500` | Grocery band controls |

### 2.4 Rides module (`modules/rides/styles/rides-tokens.css`)

| Token | Value | Role |
| --- | --- | --- |
| `--ride-accent` | `--color-brand-600` (`#1b66f5`) | Rides primary |
| `--hero-active-color` | `--color-brand-600` | Rides band controls |
| map/layout variables | module file | Ride map sizing and overlays |

## 3. Mobile theme map

### 3.1 Shared source: `shared/theme/index.ts`

| Scale | Values | Notes |
| --- | --- | --- |
| `colors.brand` | 50 `#eef6ff` … 600 `#1b66f5` … 950 `#142657` | Rides identity, shared accent |
| `colors.food` | 50 `#fdecee` … 600 `#e23242` … 950 `#4e0d11` | Food identity |
| `colors.grocery` | 50 `#fffdf5` … 500 `#f5b921` … 950 `#241b08` | Grocery identity |
| `colors.ink` / `neutral` | `#f7f6f4` … `#100e0a` | Text/surfaces |
| `colors.zRed/zGreen/zGold/zInfo` | `#e23242` / `#05893e` / `#cd9a50` / `#296cd8` | Zomato tokens |
| `success` / `danger` / `warning` | `#16a34a` / `#dc2626` / `#f59e0b` | Semantic |
| `spacing`, `radii`, `shadows`, `typography` | shared objects | Cross-module geometry |

### 3.2 Module themes

| Module file | Exported object | Primary | Dark | Soft | Canvas | Special |
| --- | --- | --- | --- | --- | --- | --- |
| `modules/food/styles/theme.ts` | `foodTheme` | `colors.food[600]` `#e23242` | `food[700]` `#c72232` | `food[50]` `#fdecee` | `ink[50]` | `veg`, `pro`, `info`, `notch`, `featured`, `hero` |
| `modules/grocery/styles/theme.ts` | `groceryTheme` | `grocery[500]` `#f5b921` | `grocery[700]` `#b87f06` | `grocery[100]` `#fff8e1` | `grocery[50]` `#fffdf5` | `band`, `bandStrong`, `success`, `danger`, `hero` |
| `modules/rides/styles/theme.ts` | `ridesTheme` | `brand[600]` `#1b66f5` | `brand[700]` `#1451e1` | `brand[50]` `#eef6ff` | `ink[50]` | `pickup`, `drop`, `driver`, `map` |

Each module theme also re-exports the shared theme (`export * from
'@/shared/theme'`) so module files have one import path, but the branded object
is the only place that decides which scale is “primary”.

### 3.3 Import ownership (verified)

| Importer | Theme imported |
| --- | --- |
| Food pages/components | `@/modules/food/styles/theme` |
| Grocery pages/components | `@/modules/grocery/styles/theme` |
| Rides pages/components | `@/modules/rides/styles/theme` |
| Shared components, features | `@/shared/theme` |

No module imports another module’s theme.

## 4. Web ↔ mobile mapping

| Concept | Web | Mobile |
| --- | --- | --- |
| Food primary | `--color-z-red` / `--color-food-600` `#e23242` | `colors.food[600]` / `foodTheme.colors.primary` |
| Grocery primary | `--color-grocery-500` `#f5b921` | `colors.grocery[500]` / `groceryTheme.colors.primary` |
| Rides primary | `--color-brand-600` `#1b66f5` | `colors.brand[600]` / `ridesTheme.colors.primary` |
| Canvas | `--color-ink-50` | `colors.ink[50]` |
| Text | `--color-ink-900` | `colors.ink[900]` |
| Muted | `--color-neutral-500` | `colors.neutral[500]` |
| Success | `#16a34a` | `colors.success` |
| Danger | `#dc2626` | `colors.danger` |
| Radii | CSS `--radius-*` | `radii` |
| Shadows | CSS shadows | `shadows.card/float/pill` |

The hex values match the source web app’s Tailwind v4 `@theme` block; they were
copied, not re-derived.

## 5. Rules

1. A new Food/Grocery/Rides colour goes into that module’s token file/theme
   object first.
2. Shared primitives may only use shared tokens; module colour is passed in via
   props or theme context.
3. Never import a module theme from `shared` or from another module.
4. Keep web and mobile hex values in sync when changing brand colours.
