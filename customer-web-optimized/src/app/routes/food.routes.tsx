import { Route } from 'react-router-dom';
import { FoodPage } from '@/modules/food/pages/food';
import { RestaurantsPage } from '@/modules/food/pages/restaurants';
import { RestaurantPage } from '@/modules/food/pages/restaurant-detail';

/**
 * Food owns every route under its discovery flow. The router only composes
 * these declarations; no Food screen is imported anywhere else in the app.
 */
export const foodRoutes = (
  <>
    <Route path="food" element={<FoodPage />} />
    <Route path="restaurants" element={<RestaurantsPage />} />
    <Route path="restaurant/:id" element={<RestaurantPage />} />
  </>
);
