import { Route } from 'react-router-dom';
import { GroceryPage } from '@/modules/grocery/pages/grocery';
import { StoresPage } from '@/modules/grocery/pages/stores';
import { StorePage } from '@/modules/grocery/pages/store-detail';
import { ProductPage } from '@/modules/grocery/pages/product-detail';

/**
 * Grocery owns store discovery, the store catalogue and product detail.
 * `/product/:id` is shared at the URL level but the screen is the Grocery
 * catalogue's product surface (Food products deep-link here with
 * `?service=food`), so it stays under Grocery ownership.
 */
export const groceryRoutes = (
  <>
    <Route path="grocery" element={<GroceryPage />} />
    <Route path="stores" element={<StoresPage />} />
    <Route path="store/:id" element={<StorePage />} />
    <Route path="product/:id" element={<ProductPage />} />
  </>
);
