import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'default';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  dismissToast: (id: number) => void;
  clearToasts: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (message, type = 'default', duration = 3000) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, message, type, duration }] });
    if (duration > 0) {
      setTimeout(() => get().dismissToast(id), duration);
    }
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  clearToasts: () => set({ toasts: [] }),
}));

export function toast(message: string, type: ToastType = 'default', duration?: number) {
  useToastStore.getState().showToast(message, type, duration);
}