/**
 * Grocery module public surface.
 *
 * Expo Router files under `app/` should import Grocery screens from here so the
 * route layer never reaches into module internals. Grocery owns store
 * discovery, the store catalogue, product detail and the Grocery tokens.
 */
export { default as GroceryHomeScreen } from './pages/grocery-home';
export { default as StoresScreen } from './pages/stores';
export { default as StoreDetailScreen } from './pages/store-detail';
export { default as ProductDetailScreen } from './pages/product-detail';
export { useActiveGroceryStore } from './hooks/useActiveGroceryStore';
export { useGroceryCategories } from './hooks/useGroceryCategories';
export { useStoreCatalogue, productsOfStore } from './hooks/useStoreCatalogue';
export { groceryTheme } from './styles/theme';
