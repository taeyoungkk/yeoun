import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface UIState {
  /** Global full-screen loading overlay */
  isLoading: boolean;
  /** Queue of toast notifications */
  toasts: Toast[];

  // ─── Actions ────────────────────────────────────────────────────────────────
  setLoading: (loading: boolean) => void;
  showToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  toasts: [],

  setLoading: (loading) =>
    set({ isLoading: loading }),

  showToast: (message, type = 'info') =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: Date.now().toString(), message, type },
      ],
    })),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () =>
    set({ toasts: [] }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectIsLoading = (s: UIState) => s.isLoading;
export const selectToasts = (s: UIState) => s.toasts;
