import { create } from 'zustand';
import { TripDetail } from '../api/trip';

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;
  activeTrip: TripDetail | null;

  // ─── Actions ────────────────────────────────────────────────────────────────
  startTrip: (tripId: string) => void;
  setActiveTrip: (trip: TripDetail) => void;
  endTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  activeTrip: null,

  startTrip: (tripId) =>
    set({ isTripActive: true, currentTripId: tripId }),

  setActiveTrip: (trip) =>
    set({ activeTrip: trip }),

  endTrip: () =>
    set({ isTripActive: false, currentTripId: null, activeTrip: null }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
