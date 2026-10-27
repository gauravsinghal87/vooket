import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/repositories/admin';
import { useNotificationSound } from '@/hooks/useNotificationSound';

/**
 * Listens for genuinely new customer orders that arrive on the admin order
 * stream.
 *
 * The room's data flow is React Query polling (Realtime/Echo is wired only on
 * the customer side; the admin panel consumes the same order stream through
 * the existing `/admin/orders` endpoint, which already mixes food, grocery and
 * ride orders). This watcher reuses that existing, existing-visibility
 * endpoint and sits in the authenticated shell so a new order chimes no
 * matter which page the administrator is on.
 *
 * It renders nothing; it only plays the alert sound.
 */
export function OrderSoundWatcher({ identity }: { identity: string }) {
  const { data } = useQuery({
    queryKey: ['admin-order-sound-feed'],
    queryFn: () => ordersApi.list({ per_page: 40 }),
    refetchInterval: 8000,
  });

  useNotificationSound(data?.data, 'notification', identity);

  return null;
}