import type { Category } from '@/types/catalog';

/**
 * Grocery category helpers for the Blinkit-style category-detail screen.
 *
 * Mirrors customer-web's `resolveCategoryNav`, so both clients derive the same
 * sidebar + active-product state from the existing `GET /grocery/categories`
 * payload (top-level categories in admin sort order, each subtree nested to any
 * depth).
 */

/**
 * True when a category renders in the sticky top navigation strip.
 *
 * Admin's `display_placement` is the single source of truth: `top_navigation`
 * and `both` show here, `main_content` does not. A missing value is treated as
 * `both` so legacy rows are never silently hidden. Mirrors customer-web.
 */
export function showsInTopNavigation(placement: string | null | undefined): boolean {
  return placement !== 'main_content';
}

/**
 * True when a category renders in the main grocery content area (the category
 * cards/grid and grouped sections). Mirrors `showsInTopNavigation`.
 */
export function showsInMainContent(placement: string | null | undefined): boolean {
  return placement !== 'top_navigation';
}

/**
 * Blinkit-inspired pastel tile backgrounds. Every value is a soft, low-saturation
 * wash so the category illustration stays clearly legible on top, and none of
 * them tint or recolour the image asset itself. Mirrors customer-web.
 */
const CATEGORY_TILE_COLORS = {
  mint: '#e7f4e9',
  cream: '#fdf6e3',
  sand: '#f4ead9',
  blush: '#fce8ef',
  lavender: '#efe8fa',
  peach: '#ffe9da',
  butter: '#fff6d6',
  sky: '#e4f0fb',
  aqua: '#e1f4f0',
} as const;

type CategoryTileColor = (typeof CATEGORY_TILE_COLORS)[keyof typeof CATEGORY_TILE_COLORS];

/**
 * Keyword -> tile colour, checked in order against the category slug and name.
 * Slugs are stable, admin-managed identifiers (`grocery-fresh-fruits`,
 * `grocery-milk`, `grocery-soft-drinks`, `grocery-detergents`, ...), so the
 * mapping is deterministic per category identity and never changes between
 * renders. More specific rules are listed before broader ones (`baby` before
 * `care`, `nut` before `fruit`, `soft-drink` before `drink`).
 */
const TILE_COLOR_RULES: { keys: string[]; color: CategoryTileColor }[] = [
  { keys: ['nut', 'dry-fruit', 'dryfruit'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['fruit', 'vegetab', 'herb', 'green', 'leafy', 'salad'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['dairy', 'milk', 'cheese', 'butter', 'yogurt', 'yoghurt', 'curd', 'egg', 'meat', 'kitchen'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['bakery', 'bread', 'bun', 'roll', 'cake', 'pastr', 'sauces'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['grain', 'rice', 'atta', 'flour', 'pulse', 'dal', 'spice', 'masala', 'oil', 'ghee', 'staple', 'cereal'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['snack', 'chip', 'namkeen', 'biscuit', 'cookie', 'cracker'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['chocolat', 'candy', 'sweet', 'dessert', 'ice-cream', 'icecream'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['soft-drink', 'softdrink', 'water', 'soda', 'cola', 'drink', 'beverage', 'tea', 'coffee', 'juice', 'shake'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['baby', 'infant', 'kid'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['ready', 'instant', 'noodle', 'frozen'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['clean', 'detergent', 'laundry', 'disposable', 'house', 'dish', 'home'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['personal', 'bath', 'body', 'hair', 'oral', 'skin', 'beauty', 'cosmetic', 'groom', 'hygiene', 'soap', 'care'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['electronic', 'gadget', 'device', 'mobile', 'charger'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['pharma', 'medicine', 'medic', 'health', 'wellness'], color: CATEGORY_TILE_COLORS.mint },
  { keys: ['decor', 'furniture', 'stationery', 'toy', 'pet'], color: CATEGORY_TILE_COLORS.mint },
];

/** Deterministic pastel background for a grocery category image tile. */
export function categoryTileColor(category: Pick<Category, 'id' | 'name' | 'slug'>): string {
  const haystack = `${category.slug ?? ''} ${category.name ?? ''}`.toLowerCase();
  for (const rule of TILE_COLOR_RULES) {
    if (rule.keys.some((key) => haystack.includes(key))) return rule.color;
  }
  // No keyword matched: fall back to a stable slot derived from the id/slug so
  // a category keeps the same tile colour on every render.
  const seed = `${category.slug ?? ''}:${category.id}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  const palette = Object.values(CATEGORY_TILE_COLORS);
  return palette[hash % palette.length];
}

/**
 * Finds a category by id anywhere in the nested payload (a parent or any depth
 * of child), so a deep link to a subcategory (`?category=116`) resolves to a
 * real name and image. Returns null for an id the API no longer knows about,
 * which is what the callers fall back on.
 */
export function findGroceryCategory(categories: Category[], id: number | null): Category | null {
  return findGroceryCategoryWithParent(categories, id)?.category ?? null;
}

function findGroceryCategoryWithParent(
  nodes: Category[],
  id: number | null,
  parent: Category | null = null
): { category: Category; parent: Category | null } | null {
  if (id === null) return null;
  for (const node of nodes) {
    if (node.id === id) return { category: node, parent };
    const found = findGroceryCategoryWithParent(node.children ?? [], id, node);
    if (found) return found;
  }
  return null;
}

export interface CategoryNav {
  /** The category being browsed (sidebar context): the selected category
      itself when it has subcategories, otherwise its parent. */
  parent: Category | null;
  /** The browsed parent's subcategories, in backend admin order. */
  subcategories: Category[];
  /** Category id whose products the grid fetches and the sidebar highlights. */
  activeCategoryId: number;
  /** Active subcategory (first subcategory by default, or the selected leaf). */
  active: Category | null;
  /**
   * True when there is no subcategory to list, so the grid shows that
   * category's directly assigned products.
   */
  isLeaf: boolean;
}

/**
 * Turns the selected category id into the sidebar + active-product state the
 * Blinkit-style category-detail screen renders.
 *
 * - Selecting a parent with subcategories lists those subcategories in the
 *   sidebar and auto-selects the first one.
 * - Selecting a subcategory highlights it among its siblings and keeps the
 *   sidebar (the same parent context) in place.
 * - A category with no subcategories is a leaf: no sidebar, and the grid shows
 *   that category's own directly assigned products.
 * - Unrelated (global) parent categories are never listed.
 */
export function resolveCategoryNav(categories: Category[], selectedCategoryId: number): CategoryNav {
  const found = findGroceryCategoryWithParent(categories, selectedCategoryId);

  // An id the API no longer knows: fetch its own products, no sidebar.
  if (!found) {
    return {
      parent: null,
      subcategories: [],
      activeCategoryId: selectedCategoryId,
      active: null,
      isLeaf: true,
    };
  }

  const { category: selected, parent } = found;
  const hasChildren = (selected.children ?? []).length > 0;
  const context = hasChildren ? selected : parent;
  const subcategories = context?.children ?? [];

  // No subcategory to list: show the selected category's own products.
  if (!context || subcategories.length === 0) {
    return {
      parent: context,
      subcategories: [],
      activeCategoryId: selected.id,
      active: selected,
      isLeaf: true,
    };
  }

  /* A parent with subcategories opens on its first one; a leaf deep link
     highlights itself among its siblings. */
  const active = hasChildren ? subcategories[0] : selected;

  return {
    parent: context,
    subcategories,
    activeCategoryId: active.id,
    active,
    isLeaf: false,
  };
}