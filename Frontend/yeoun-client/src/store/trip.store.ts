import { create } from 'zustand';

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;

  // ─── Actions ────────────────────────────────────────────────────────────────
  startTrip: (tripId: string) => void;
  endTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,

  startTrip: (tripId) =>
    set({ isTripActive: true, currentTripId: tripId }),

  endTrip: () =>
    set({ isTripActive: false, currentTripId: null }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
