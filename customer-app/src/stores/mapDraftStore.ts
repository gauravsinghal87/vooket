import { create } from 'zustand';

type GeoPoint = { latitude: number; longitude: number } | null;

interface MapDraftState {
  point: GeoPoint;
  address: string | null;
  setPoint: (point: GeoPoint, address: string | null) => void;
}

/** Temporary cross-screen location chosen in the map picker before an address is saved. */
export const useMapDraftStore = create<MapDraftState>((set) => ({
  point: null,
  address: null,
  setPoint: (point, address) => set({ point, address }),
}));