import { create } from 'zustand';

export const FOOD_NOTE_MAX_LENGTH = 500;

/** Delivery instructions are stored per module and sent as `customer_note`. */
export const DELIVERY_NOTE_MAX_LENGTH = 500;

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
  /** "Leave at the door"-style delivery instructions, kept per module. */
  foodDeliveryNote: string;
  groceryDeliveryNote: string;
  setCount: (type: 'food' | 'grocery', count: number) => void;
  increment: (type: 'food' | 'grocery') => void;
  setRideActive: (active: boolean) => void;
  setFoodRestaurantNote: (note: string) => void;
  setFoodNoCutlery: (noCutlery: boolean) => void;
  setDeliveryNote: (type: 'food' | 'grocery', note: string) => void;
  clearDeliveryNote: (type: 'food' | 'grocery') => void;
  clearFoodInstructions: () => void;
}

export const useCartStore = create<CartStoreState>((set) => ({
  foodCount: 0,
  groceryCount: 0,
  rideActive: false,
  foodRestaurantNote: '',
  foodNoCutlery: false,
  foodDeliveryNote: '',
  groceryDeliveryNote: '',
  setCount: (type, count) =>
    set({ ...(type === 'food' ? { foodCount: count } : { groceryCount: count }) }),
  increment: (type) =>
    set((s) => ({ ...(type === 'food' ? { foodCount: s.foodCount + 1 } : { groceryCount: s.groceryCount + 1 }) })),
  setRideActive: (rideActive) => set({ rideActive }),
  setFoodRestaurantNote: (foodRestaurantNote) => set({ foodRestaurantNote }),
  setFoodNoCutlery: (foodNoCutlery) => set({ foodNoCutlery }),
  setDeliveryNote: (type, note) =>
    set(type === 'food' ? { foodDeliveryNote: note } : { groceryDeliveryNote: note }),
  clearDeliveryNote: (type) =>
    set(type === 'food' ? { foodDeliveryNote: '' } : { groceryDeliveryNote: '' }),
  clearFoodInstructions: () => set({ foodRestaurantNote: '', foodNoCutlery: false }),
}));