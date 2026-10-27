import { create } from 'zustand';
import type { MapPoint, PickMode } from '@/components/rides/RideMap';
import type { VehicleType } from '@/types/models';

type Updater<T> = T | ((prev: T) => T);

interface RidesDraftState {
  pickup: MapPoint | null;
  drop: MapPoint | null;
  selectedVehicle: VehicleType | null;
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
