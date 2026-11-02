/**
 * Grocery module public API.
 *
 * Only the module entry point is imported by the app router. Internal folders
 * (components, hooks, store, utils) are private to the module.
 */
export { GroceryCartPage } from './pages/grocery-cart';
export { GroceryPage } from './pages/grocery';
export { ProductPage } from './pages/product-detail';
export { StorePage } from './pages/store-detail';
export { StoresPage } from './pages/stores';
export { groceryService } from './services';
