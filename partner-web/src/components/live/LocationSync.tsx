import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { driverApi } from '@/repositories/driver';
import { partnerApi } from '@/repositories/partner';
import { getCurrentPosition } from '@/lib/geo';

const SYNC_INTERVAL_MS = 45000;

export function useLocationSync() {
  const role = useAuthStore((s) => s.role);
  const isOnline = useAuthStore((s) => s.profile?.is_online ?? false);
  const isBusy = useAuthStore((s) => s.profile?.is_busy ?? false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!role || !isOnline || isBusy) return;

    const api = role === 'delivery_partner' ? partnerApi : driverApi;

    const sync = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const coords = await getCurrentPosition();
        await api.updateLocation(coords.latitude, coords.longitude);
      } catch {
        // Location is best-effort while online; skip silently on this tick.
      } finally {
        inFlight.current = false;
      }
    };

    // Reflect the partner's position as soon as they open the app or go
    // online, so they are eligible for nearby dispatch offers immediately
    // instead of waiting an entire sync interval.
    if (!inFlight.current) {
      void sync();
    }

    const id = window.setInterval(sync, SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [role, isOnline, isBusy]);
}

export function LocationSync() {
  useLocationSync();
  return null;
}