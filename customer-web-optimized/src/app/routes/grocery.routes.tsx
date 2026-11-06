import { lazy, Suspense, type ReactNode } from 'react';
import { Route } from 'react-router-dom';
import { PageFallback } from '@/shared/components/ui/page-fallback';

/**
 * Grocery owns store discovery, the store catalogue and product detail.
 * `/product/:id` is shared at the URL level but the screen is the Grocery
 * catalogue's product surface (Food products deep-link here with
 * `?service=food`), so it stays under Grocery ownership.
 *
 * Each screen is a separate lazy chunk; the Grocery home is only downloaded
 * when the customer opens Grocery (or hovers/focuses its dock tab).
 */
const GroceryPage = lazy(() =>
  import('@/modules/grocery/pages/grocery').then((m) => ({ default: m.GroceryPage }))
);
const StoresPage = lazy(() =>
  import('@/modules/grocery/pages/stores').then((m) => ({ default: m.StoresPage }))
);
const StorePage = lazy(() =>
  import('@/modules/grocery/pages/store-detail').then((m) => ({ default: m.StorePage }))
);
const ProductPage = lazy(() =>
  import('@/modules/grocery/pages/product-detail').then((m) => ({ default: m.ProductPage }))
);

const page = (element: ReactNode) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

export const groceryRoutes = (
  <>
    <Route path="grocery" element={page(<GroceryPage />)} />
    <Route path="stores" element={page(<StoresPage />)} />
    <Route path="store/:id" element={page(<StorePage />)} />
    <Route path="product/:id" element={page(<ProductPage />)} />
  </>
);
