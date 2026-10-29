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
  /**
   * What the shared selector should show when it opens. `default` is the normal
   * picker list; `food-cart` is the cart's "Choose address" button asking
   * straight for the add-address screen, and for the saved address to become
   * the cart's delivery address. Transient like `locationSelectorOpen`, so it
   * is never persisted and always starts back at `default`.
   */
  locationSelectorContext: 'default' | 'food-cart';
  setService: (service: ServiceType) => void;
  setLocation: (location: Location, addressId?: number | null) => void;
  setVegMode: (vegMode: boolean) => void;
  openLocationSelector: (context?: 'default' | 'food-cart') => void;
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
      locationSelectorContext: 'default',
      setService: (service) => set({ service }),
      setLocation: (location, addressId = null) => set({ location, locationAddressId: addressId }),
      setVegMode: (vegMode) => set({ vegMode }),
      openLocationSelector: (context = 'default') =>
        set({ locationSelectorOpen: true, locationSelectorContext: context }),
      closeLocationSelector: () =>
        set({ locationSelectorOpen: false, locationSelectorContext: 'default' }),
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