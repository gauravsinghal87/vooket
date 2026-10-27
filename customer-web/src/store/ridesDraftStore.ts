import { create } from 'zustand';
import type { MapPoint, PickMode } from '@/components/rides/RideMap';
import type { VehicleType } from '@/types/models';

type Updater<T> = T | ((prev: T) => T);

interface RidesDraftState {
  /**
   * The pickup/drop the user is building on the rides home screen. Kept in a
   * store (not local component state) so the dedicated destination selector can
   * read and edit the *same* locations instead of shadowing them, and so the
   * selection survives navigating to/from the selector.
   */
  pickup: MapPoint | null;
  drop: MapPoint | null;
  /**
   * The vehicle the user chose on the "Choose a ride" panel. Held here so the
   * pickup-confirmation step can publish the exact same ride the user reviewed.
   */
  selectedVehicle: VehicleType | null;
  /**
   * Set by the selector's "Select on map" action so the home screen re-enters
   * map-picking for the right field when it mounts again.
   */
  pendingMode: PickMode;
  setPickup: (value: Updater<MapPoint | null>) => void;
  setDrop: (value: Updater<MapPoint | null>) => void;
  setSelectedVehicle: (value: VehicleType | null) => void;
  setPendingMode: (mode: PickMode) => void;
  swap: () => void;
  reset: () => void;
}

export const useRidesDraftStore = create<RidesDraftState>((set) => ({
  pickup: null,
  drop: null,
  selectedVehicle: null,
  pendingMode: 'none',
  setPickup: (value) => set((s) => ({ pickup: typeof value === 'function' ? value(s.pickup) : value })),
  setDrop: (value) => set((s) => ({ drop: typeof value === 'function' ? value(s.drop) : value })),
  setSelectedVehicle: (selectedVehicle) => set({ selectedVehicle }),
  setPendingMode: (pendingMode) => set({ pendingMode }),
  swap: () => set((s) => ({ pickup: s.drop, drop: s.pickup })),
  reset: () => set({ pickup: null, drop: null, selectedVehicle: null, pendingMode: 'none' }),
}));
