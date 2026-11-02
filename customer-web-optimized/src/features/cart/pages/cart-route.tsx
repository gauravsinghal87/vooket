import { useSearchParams } from 'react-router-dom';
import { FoodCartPage } from '@/modules/food';
import { GroceryCartPage } from '@/modules/grocery';

/**
 * Cart route dispatcher.
 *
 * The URL contract is a single `/cart`, with the owning module carried in
 * `?type=food|grocery`. The dispatcher lives in the cart feature so neither
 * service module has to import the other; the route table composes it once.
 */
export function CartRoute() {
  const [params] = useSearchParams();
  return params.get('type') === 'grocery' ? <GroceryCartPage /> : <FoodCartPage />;
}
