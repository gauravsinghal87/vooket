import { create } from 'zustand';

export const FOOD_NOTE_MAX_LENGTH = 500;

interface CartStoreState {
  foodCount: number;
  groceryCount: number;
  rideActive: boolean;
  /**
   * Food preparation instructions collected in the cart before checkout.
   * `noCutlery` maps to send_cutlery=false; leaving it unset keeps the
   * existing application default (send_cutlery=true).
   */
  foodRestaurantNote: string;
  foodNoCutlery: boolean;
  setCount: (type: 'food' | 'grocery', count: number) => void;
  increment: (type: 'food' | 'grocery') => void;
  setRideActive: (active: boolean) => void;
  setFoodRestaurantNote: (note: string) => void;
  setFoodNoCutlery: (noCutlery: boolean) => void;
  clearFoodInstructions: () => void;
}

export const useCartStore = create<CartStoreState>((set) => ({
  foodCount: 0,
  groceryCount: 0,
  rideActive: false,
  foodRestaurantNote: '',
  foodNoCutlery: false,
  setCount: (type, count) =>
    set({ ...(type === 'food' ? { foodCount: count } : { groceryCount: count }) }),
  increment: (type) =>
    set((s) => ({ ...(type === 'food' ? { foodCount: s.foodCount + 1 } : { groceryCount: s.groceryCount + 1 }) })),
  setRideActive: (rideActive) => set({ rideActive }),
  setFoodRestaurantNote: (foodRestaurantNote) => set({ foodRestaurantNote }),
  setFoodNoCutlery: (foodNoCutlery) => set({ foodNoCutlery }),
  clearFoodInstructions: () => set({ foodRestaurantNote: '', foodNoCutlery: false }),
}));