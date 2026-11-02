/**
 * Food module public surface.
 *
 * Expo Router files under `app/` should import Food screens from here so the
 * route layer never reaches into module internals. Food owns restaurant
 * discovery, the restaurant menu and the Food design tokens.
 */
export { default as FoodHomeScreen } from './pages/food-home';
export { default as RestaurantsScreen } from './pages/restaurants';
export { default as RestaurantDetailScreen } from './pages/restaurant-detail';
export { foodTheme } from './styles/theme';
