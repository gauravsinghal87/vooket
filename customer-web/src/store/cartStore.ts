import { create } from 'zustand';
import type { DeliverySlot } from '@/repositories/interfaces';

export const FOOD_NOTE_MAX_LENGTH = 500;

/** The grocery delivery timing chosen on the cart, carried into checkout. */
export type GroceryDeliveryMode = 'asap' | 'scheduled';

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
  /**
   * Grocery delivery timing lives here because it is chosen on the cart but
   * submitted by checkout: one source of truth, so the two screens can never
   * disagree about ASAP vs. a booked slot.
   */
  groceryDeliveryMode: GroceryDeliveryMode;
  groceryDeliverySlot: DeliverySlot | null;
  setGroceryDeliveryMode: (mode: GroceryDeliveryMode) => void;
  setGroceryDeliverySlot: (slot: DeliverySlot | null) => void;
  resetGroceryDelivery: () => void;
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
  groceryDeliveryMode: 'asap',
  groceryDeliverySlot: null,
  setGroceryDeliveryMode: (groceryDeliveryMode) =>
    // Dropping back to ASAP must not leave a stale slot behind: checkout only
    // submits `delivery_slot_id` in scheduled mode.
    set(groceryDeliveryMode === 'asap' ? { groceryDeliveryMode, groceryDeliverySlot: null } : { groceryDeliveryMode }),
  setGroceryDeliverySlot: (groceryDeliverySlot) => set({ groceryDeliverySlot }),
  resetGroceryDelivery: () => set({ groceryDeliveryMode: 'asap', groceryDeliverySlot: null }),
}));