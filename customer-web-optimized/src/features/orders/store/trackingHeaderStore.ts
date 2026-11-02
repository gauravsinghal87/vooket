import { create } from 'zustand';

/**
 * Service surface the shared app header adopts while an order is being viewed
 * (`customer-web` `/order/:id`).
 *
 * Deliberately not persisted, unlike {@link useAppStore}: this mirrors
 * transient, page-local UI state rather than a user preference. The order page
 * sets it while it is mounted so the global header and the tracking hero
 * beneath it paint one continuous background — in both the collapsed and the
 * expanded map state; it resets to `null` on unmount, so every other route
 * keeps the normal dark header untouched.
 */
export type TrackingHeaderTheme = 'food' | 'grocery';

interface TrackingHeaderState {
  theme: TrackingHeaderTheme | null;
  setTheme: (theme: TrackingHeaderTheme | null) => void;
}

export const useTrackingHeaderStore = create<TrackingHeaderState>((set) => ({
  theme: null,
  setTheme: (theme) => set({ theme }),
}));
