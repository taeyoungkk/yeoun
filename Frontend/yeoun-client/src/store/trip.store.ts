import { create } from 'zustand';
import { TripDetail, TripListItem } from '../api/trip';

export interface CurrentTrip {
  tripId: string;
  title?: string;
  location?: string;
  date?: string;
  participants?: number;
  imageUrl?: string | null;
  region?: string;
}

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;
  currentTrip: CurrentTrip | null;
  activeTrip: TripDetail | null;
  pastTrips: TripListItem[];
  likedTripIds: string[];

  // ─── Actions ────────────────────────────────────────────────────────────────
  startTrip: (trip: CurrentTrip) => void;
  updateCurrentTrip: (trip: CurrentTrip) => void;
  setActiveTrip: (trip: TripDetail) => void;
  endTrip: () => void;
  setPastTrips: (trips: TripListItem[]) => void;
  toggleFavorite: (tripId: string) => void;
  clearTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  currentTrip: null,
  activeTrip: null,
  pastTrips: [],
  likedTripIds: [],

  startTrip: (trip) =>
    set({
      isTripActive: true,
      currentTripId: trip.tripId,
      currentTrip: trip,
    }),
  updateCurrentTrip: (trip) =>
    set((state) => ({
      isTripActive: state.isTripActive,
      currentTripId: trip.tripId,
      currentTrip: trip,
    })),
  setActiveTrip: (trip) =>
    set({
      activeTrip: trip,
    }),
  endTrip: () =>
    set((state) => ({
      isTripActive: false,
      currentTripId: state.currentTrip?.tripId ?? null,
      activeTrip: null,
    })),
  setPastTrips: (trips) =>
    set({ pastTrips: trips }),
  toggleFavorite: (tripId) =>
    set((state) => ({
      likedTripIds: state.likedTripIds.includes(tripId)
        ? state.likedTripIds.filter((id) => id !== tripId)
        : [...state.likedTripIds, tripId],
    })),
  clearTrip: () =>
    set({
      isTripActive: false,
      currentTripId: null,
      currentTrip: null,
      activeTrip: null,
    }),
}));

export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
