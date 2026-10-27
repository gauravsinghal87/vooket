import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/repositories/vendor';
import { useNotificationSound } from '@/hooks/useNotificationSound';

/**
 * Listens for genuinely new orders that arrive for the authenticated vendor.
 *
 * The room's data flow is React Query polling (Realtime/Echo is wired only on
 * the customer side; the dashboards consume the same vendor order stream
 * through the existing `/vendor/orders` endpoint). This watcher reuses that
 * existing, backend-scoped endpoint — a food vendor only ever sees food
 * orders, a grocery vendor only grocery — and sits in the authenticated shell
 * so a new order chimes no matter which page the vendor is on.
 *
 * It renders nothing; it only plays the alert sound.
 */
export function OrderSoundWatcher({ identity }: { identity: string }) {
  const { data } = useQuery({
    queryKey: ['vendor-order-sound-feed'],
    queryFn: () => ordersApi.list({ per_page: 30 }),
    refetchInterval: 8000,
  });

  useNotificationSound(data?.data, 'new_order', identity);

  return null;
}