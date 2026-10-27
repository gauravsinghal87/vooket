import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ServiceType } from '@/types/models';
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
   * Whether the shared delivery-location selector (rendered once by
   * `AppHeader`) is open. Kept in the store so any screen — including the Food
   * "we're not serving your location yet" empty state — can open the same
   * sheet instead of mounting its own copy. Transient, so it is never persisted.
   */
  locationSelectorOpen: boolean;
  setService: (service: ServiceType) => void;
  setLocation: (location: Location) => void;
  setVegMode: (vegMode: boolean) => void;
  openLocationSelector: () => void;
  closeLocationSelector: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      service: 'food',
      location: null,
      vegMode: false,
      locationSelectorOpen: false,
      setService: (service) => set({ service }),
      setLocation: (location) => set({ location }),
      setVegMode: (vegMode) => set({ vegMode }),
      openLocationSelector: () => set({ locationSelectorOpen: true }),
      closeLocationSelector: () => set({ locationSelectorOpen: false }),
    }),
    {
      name: 'sb-app',
      partialize: (state) => ({ service: state.service, location: state.location, vegMode: state.vegMode }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);