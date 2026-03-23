import { create } from 'zustand';

import { TripDetail } from '../api/trip';

export interface CurrentTrip {
  tripId: string;
  tripName: string;
  startDate: string;
  endDate: string;
  memberCount: number;
  origin: string;
  destination: string;
}

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;
  currentTrip: CurrentTrip | null;
  activeTrip: TripDetail | null;
  routeRefreshKey: number;
  startTrip: (trip: CurrentTrip) => void;
  updateCurrentTrip: (trip: CurrentTrip) => void;
  setActiveTrip: (trip: TripDetail) => void;
  bumpRouteRefreshKey: () => void;
  endTrip: () => void;
  clearTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  currentTrip: null,
  activeTrip: null,
  routeRefreshKey: 0,
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
  bumpRouteRefreshKey: () =>
    set((state) => ({
      routeRefreshKey: state.routeRefreshKey + 1,
    })),
  endTrip: () =>
    set((state) => ({
      isTripActive: false,
      currentTripId: state.currentTrip?.tripId ?? null,
      activeTrip: null,
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
export const selectCurrentTrip = (s: TripState) => s.currentTrip;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
export const selectRouteRefreshKey = (s: TripState) => s.routeRefreshKey;
