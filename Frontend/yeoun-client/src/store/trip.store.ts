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

export type LocationSyncStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';

interface TripState {
  isTripActive: boolean;
  currentTripId: string | null;
  currentTrip: CurrentTrip | null;
  reviewTrip: CurrentTrip | null;
  activeTrip: TripDetail | null;
  routeRefreshKey: number;
  locationSyncStatus: LocationSyncStatus;
  locationSyncMessage: string | null;
  locationSyncUpdatedAt: string | null;
  startTrip: (trip: CurrentTrip) => void;
  updateCurrentTrip: (trip: CurrentTrip) => void;
  setReviewTrip: (trip: CurrentTrip) => void;
  clearReviewTrip: () => void;
  setActiveTrip: (trip: TripDetail) => void;
  bumpRouteRefreshKey: () => void;
  setLocationSyncState: (status: LocationSyncStatus, message?: string | null) => void;
  resetLocationSyncState: () => void;
  endTrip: () => void;
  clearTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  currentTrip: null,
  reviewTrip: null,
  activeTrip: null,
  routeRefreshKey: 0,
  locationSyncStatus: 'idle',
  locationSyncMessage: null,
  locationSyncUpdatedAt: null,
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
  setReviewTrip: (trip) =>
    set({
      reviewTrip: trip,
    }),
  clearReviewTrip: () =>
    set({
      reviewTrip: null,
    }),
  setActiveTrip: (trip) =>
    set({
      activeTrip: trip,
    }),
  bumpRouteRefreshKey: () =>
    set((state) => ({
      routeRefreshKey: state.routeRefreshKey + 1,
    })),
  setLocationSyncState: (status, message = null) =>
    set({
      locationSyncStatus: status,
      locationSyncMessage: message,
      locationSyncUpdatedAt: new Date().toISOString(),
    }),
  resetLocationSyncState: () =>
    set({
      locationSyncStatus: 'idle',
      locationSyncMessage: null,
      locationSyncUpdatedAt: null,
    }),
  endTrip: () =>
    set((state) => ({
      isTripActive: false,
      currentTripId: state.currentTrip?.tripId ?? null,
      activeTrip: null,
      locationSyncStatus: 'idle',
      locationSyncMessage: null,
      locationSyncUpdatedAt: null,
    })),
  clearTrip: () =>
    set({
      isTripActive: false,
      currentTripId: null,
      currentTrip: null,
      activeTrip: null,
      locationSyncStatus: 'idle',
      locationSyncMessage: null,
      locationSyncUpdatedAt: null,
    }),
}));

export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectCurrentTrip = (s: TripState) => s.currentTrip;
export const selectReviewTrip = (s: TripState) => s.reviewTrip;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
export const selectRouteRefreshKey = (s: TripState) => s.routeRefreshKey;
export const selectLocationSyncStatus = (s: TripState) => s.locationSyncStatus;
export const selectLocationSyncMessage = (s: TripState) => s.locationSyncMessage;
export const selectLocationSyncUpdatedAt = (s: TripState) => s.locationSyncUpdatedAt;
