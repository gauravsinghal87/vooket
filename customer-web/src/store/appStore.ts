import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServiceType } from '@/types/api';
import type { Location } from '@/types/catalog';

interface AppState {
  service: ServiceType;
  location: Location | null;
  /**
   * Food "Veg Mode": a persistent preference that narrows the Food restaurant
   * directory to pure-veg kitchens (`is_veg`). It is a real filter — the Food
   * home applies it to the recommendations and the restaurant feed — kept in the
   * app store so it survives navigation and app restarts, exactly like Zomato's
   * Veg Mode. Other services never read it.
   */
  vegMode: boolean;
  /**
   * Whether the shared delivery-location selector (rendered once in the app
   * shell) is open. Kept in the store so any screen — including the Food
   * "we're not serving your location yet" empty state — can open the same
   * selector instead of each page mounting its own copy.
   */
  locationSelectorOpen: boolean;
  locationSelectorContext: 'default' | 'food-cart' | 'grocery-cart';
  locationSelectorCartType?: 'food' | 'grocery';
  setService: (service: ServiceType) => void;
  setLocation: (location: Location) => void;
  setVegMode: (vegMode: boolean) => void;
  openLocationSelector: (context?: 'default' | 'food-cart' | 'grocery-cart', cartType?: 'food' | 'grocery') => void;
  closeLocationSelector: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      service: 'food',
      location: null,
      vegMode: false,
      locationSelectorOpen: false,
      locationSelectorContext: 'default',
      locationSelectorCartType: undefined,
      setService: (service) => set({ service }),
      setLocation: (location) => set({ location }),
      setVegMode: (vegMode) => set({ vegMode }),
      openLocationSelector: (context = 'default', cartType) =>
        set({ locationSelectorOpen: true, locationSelectorContext: context, locationSelectorCartType: cartType }),
      closeLocationSelector: () => set({ locationSelectorOpen: false, locationSelectorContext: 'default', locationSelectorCartType: undefined }),
    }),
    {
      name: 'sb-app',
      partialize: (state) => ({ service: state.service, location: state.location, vegMode: state.vegMode }),
    }
  )
);
