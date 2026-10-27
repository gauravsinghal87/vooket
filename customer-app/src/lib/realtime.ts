import { useEffect, useRef, useState } from 'react';
import { repositories } from '@/api/repositories';
import type { Order, OrderTracking, Ride } from '@/types/models';

/**
 * Realtime architecture (native port).
 *
 * Mirrors the web app: UI subscribes through a `ChannelProvider`. No provider
 * is registered today (backend realtime channel not wired), so the hooks fall
 * back to repository polling every POLL_INTERVAL_MS. Swap in a
 * Pusher/Ably/Laravel Echo provider later with setChannelProvider() without
 * touching components.
 */
export interface ChannelProvider {
  subscribe(channel: string, handler: (data: unknown) => void): () => void;
}

let channelProvider: ChannelProvider | null = null;

export function setChannelProvider(provider: ChannelProvider): void {
  channelProvider = provider;
}

export function getChannelProvider(): ChannelProvider | null {
  return channelProvider;
}

export const POLL_INTERVAL_MS = 5000;

function useRealtime<T>(
  targetId: number | undefined,
  channelName: string,
  pollFn: (id: number) => Promise<T>,
  deps: unknown[]
): { data: T | null; isPolling: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const handlerRef = useRef<(d: T) => void>((d) => setData(d));

  useEffect(() => {
    handlerRef.current = (d) => setData(d);
  }, []);

  useEffect(() => {
    if (targetId === undefined) return;

    let active = true;
    const provider = getChannelProvider();
    let unsubscribeFromChannel: (() => void) | null = null;

    if (provider) {
      unsubscribeFromChannel = provider.subscribe(channelName, (raw) => {
        if (active) handlerRef.current(raw as T);
      });
    }

    const refresh = async () => {
      if (!active) return;
      setIsPolling(true);
      try {
        const fresh = await pollFn(targetId);
        if (active) handlerRef.current(fresh);
      } catch {
        // keep last known state on transient errors
      } finally {
        if (active) setIsPolling(false);
      }
    };

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
      unsubscribeFromChannel?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, ...deps]);

  return { data, isPolling };
}

export function useRealtimeOrder(orderId: number | undefined): { data: Order | null; isPolling: boolean } {
  return useRealtime<Order>(orderId, `order.${orderId}`, (id) => repositories.orders.getOrder(id), []);
}

export function useRealtimeRide(rideId: number | undefined): { data: Ride | null; isPolling: boolean } {
  return useRealtime<Ride>(rideId, `ride.${rideId}`, (id) => repositories.rides.getRide(id), []);
}

export function useRealtimeTracking(
  orderId: number | undefined
): { data: OrderTracking | null; isPolling: boolean } {
  return useRealtime<OrderTracking>(
    orderId,
    `private-orders.${orderId}`,
    (id) => repositories.orders.getOrderTracking(id),
    []
  );
}