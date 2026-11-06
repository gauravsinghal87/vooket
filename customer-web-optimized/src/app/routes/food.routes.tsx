import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { PageFallback } from '@/shared/components/ui/page-fallback';

/**
 * Food owns every route under its discovery flow. The router only composes
 * these declarations; no Food screen is imported anywhere else in the app.
 *
 * Screens are lazy so the Food bundle is not part of the first paint on
 * Grocery or Rides. `PageFallback` renders inside `AppShell`'s `<main>`, so
 * the header and bottom dock stay mounted while the chunk downloads.
 */
const FoodPage = lazy(() =>
  import('@/modules/food/pages/food').then((m) => ({ default: m.FoodPage }))
);
const RestaurantsPage = lazy(() =>
  import('@/modules/food/pages/restaurants').then((m) => ({ default: m.RestaurantsPage }))
);
const RestaurantPage = lazy(() =>
  import('@/modules/food/pages/restaurant-detail').then((m) => ({ default: m.RestaurantPage }))
);

const page = (element: ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

export const foodRoutes = (
  <>
    <Route path="food" element={page(<FoodPage />)} />
    <Route path="restaurants" element={page(<RestaurantsPage />)} />
    <Route path="restaurant/:id" element={page(<RestaurantPage />)} />
  </>
);
