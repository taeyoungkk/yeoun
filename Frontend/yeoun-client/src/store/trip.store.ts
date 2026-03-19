import { create } from 'zustand';
import { TripDetail, TripListItem } from '../api/trip';

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;
  activeTrip: TripDetail | null;
  pastTrips: TripListItem[];
  likedTripIds: string[];

  // ─── Actions ────────────────────────────────────────────────────────────────
  startTrip: (tripId: string) => void;
  setActiveTrip: (trip: TripDetail) => void;
  endTrip: () => void;
  setPastTrips: (trips: TripListItem[]) => void;
  toggleFavorite: (tripId: string) => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  activeTrip: null,
  pastTrips: [],
  likedTripIds: [],

  startTrip: (tripId) =>
    set({ isTripActive: true, currentTripId: tripId }),

  setActiveTrip: (trip) =>
    set({ activeTrip: trip }),

  endTrip: () =>
    set({ isTripActive: false, currentTripId: null, activeTrip: null }),

  setPastTrips: (trips) =>
    set({ pastTrips: trips }),

  toggleFavorite: (tripId) =>
    set((state) => ({
      likedTripIds: state.likedTripIds.includes(tripId)
        ? state.likedTripIds.filter((id) => id !== tripId)
        : [...state.likedTripIds, tripId],
    })),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
