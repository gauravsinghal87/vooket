import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ServiceType } from '@/types/models';
import type { Location } from '@/types/catalog';

interface AppState {
  service: ServiceType;
  location: Location | null;
  /**
   * The saved address backing `location`, when the current location came from
   * one (null for GPS/search picks that are not saved addresses). The cart
   * reads this to stay in sync with the location chosen on the home header,
   * instead of keeping the address it happened to be seeded with.
   */
  locationAddressId: number | null;
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
  setLocation: (location: Location, addressId?: number | null) => void;
  setVegMode: (vegMode: boolean) => void;
  openLocationSelector: () => void;
  closeLocationSelector: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      service: 'food',
      location: null,
      locationAddressId: null,
      vegMode: false,
      locationSelectorOpen: false,
      setService: (service) => set({ service }),
      setLocation: (location, addressId = null) => set({ location, locationAddressId: addressId }),
      setVegMode: (vegMode) => set({ vegMode }),
      openLocationSelector: () => set({ locationSelectorOpen: true }),
      closeLocationSelector: () => set({ locationSelectorOpen: false }),
    }),
    {
      name: 'sb-app',
      partialize: (state) => ({
        service: state.service,
        location: state.location,
        locationAddressId: state.locationAddressId,
        vegMode: state.vegMode,
      }),
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);