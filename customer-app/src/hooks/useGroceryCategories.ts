import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/api/repositories';
import { useAppStore } from '@/stores/appStore';
import { DEFAULT_LOCATION } from '@/lib/location';
import { coordsKey } from '@/lib/geo';
import { showsInMainContent, showsInTopNavigation } from '@/lib/groceryCategories';
import type { Category } from '@/types/catalog';

interface GroceryCategoryGroups {
  /** Top-level grocery categories in backend sort order. */
  parents: Category[];
  /**
   * Blinkit-style sections: one per parent that may render in the main content
   * area, with its active child (sub)categories as the image tiles beneath the
   * parent heading. Parents without any main-content children are dropped so
   * the home never renders an empty heading.
   */
  sections: { parent: Category; children: Category[] }[];
}

/**
 * Grocery categories from the existing `GET /grocery/categories` endpoint.
 *
 * Native port of customer-web's `useGroceryCategories`: one request backs the
 * carousel, the grid and the grouped sections, so the page never fans out into
 * per-category requests. The backend returns top-level categories already in the
 * admin-managed `sort_order`, each with `children` preloaded; that order is
 * preserved as-is — the UI never re-sorts categories.
 *
 * The taxonomy is zone-gated too: it is requested for the current delivery
 * coordinates and keyed by them (so an address change refetches instead of
 * showing the previous address's rails), and the backend returns an empty tree
 * when Grocery does not serve that location.
 */
export function useGroceryCategories() {
  const location = useAppStore((s) => s.location);
  const origin = location ?? DEFAULT_LOCATION;

  const query = useQuery({
    queryKey: ['grocery-categories', coordsKey(origin)],
    queryFn: () => repositories.grocery.getCategories({ latitude: origin.latitude, longitude: origin.longitude }),
    staleTime: 1000 * 60 * 10,
  });

  const categories: Category[] = query.data?.categories ?? [];
  const parents = categories;

  /**
   * The two display surfaces are driven by Admin's `display_placement`, split
   * from the single cached payload so the screen never fans out into a second
   * request. `categories` keeps every parent so deep links still resolve.
   */
  const topNavigation = useMemo(
    () => parents.filter((c) => showsInTopNavigation(c.display_placement)),
    [parents]
  );

  const mainContent = useMemo(
    () => parents.filter((c) => showsInMainContent(c.display_placement)),
    [parents]
  );

  /**
   * Each main-content parent becomes a section heading over its own active
   * children. A child with no main-content placement is left out, and parents
   * left with no children are skipped entirely.
   */
  const sections: GroceryCategoryGroups['sections'] = useMemo(
    () =>
      mainContent
        .map((parent) => ({
          parent,
          children: (parent.children ?? []).filter((c) => showsInMainContent(c.display_placement)),
        }))
        .filter((s) => s.children.length > 0),
    [mainContent]
  );

  return {
    categories: parents,
    topNavigation,
    mainContent,
    sections,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    /** Grocery verdict for the delivery address the taxonomy was requested for. */
    serviceability: query.data?.serviceability ?? null,
  };
}