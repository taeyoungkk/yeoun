import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { getTripDetailApi, getTripsApi, TripDetail, TripListItem } from '../api/trip';

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
  trips: TripListItem[];
  isTripsLoading: boolean;
  tripsFetchedAt: number | null;
  routeRefreshKey: number;
  locationSyncStatus: LocationSyncStatus;
  locationSyncMessage: string | null;
  locationSyncUpdatedAt: string | null;
  startTrip: (trip: CurrentTrip) => void;
  updateCurrentTrip: (trip: CurrentTrip) => void;
  setReviewTrip: (trip: CurrentTrip) => void;
  clearReviewTrip: () => void;
  setActiveTrip: (trip: TripDetail) => void;
  syncAcceptedTrip: (trip: TripDetail) => void;
  fetchTrips: (force?: boolean) => Promise<TripListItem[]>;
  restoreActiveTripFromServer: () => Promise<TripDetail | null>;
  bumpRouteRefreshKey: () => void;
  setLocationSyncState: (status: LocationSyncStatus, message?: string | null) => void;
  resetLocationSyncState: () => void;
  endTrip: () => void;
  clearTrip: () => void;
  removeTrip: (tripId: string) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      isTripActive: false,
      currentTripId: null,
      currentTrip: null,
      reviewTrip: null,
      activeTrip: null,
      trips: [],
      isTripsLoading: false,
      tripsFetchedAt: null,
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
      syncAcceptedTrip: (trip) =>
        set((state) => {
          const nextCurrentTrip: CurrentTrip = {
            tripId: trip.tripId,
            tripName: trip.title,
            startDate: trip.startDate,
            endDate: trip.endDate,
            memberCount: trip.memberCount ?? trip.participants ?? state.currentTrip?.memberCount ?? 0,
            origin: trip.country ?? state.currentTrip?.origin ?? '',
            destination: trip.region ?? trip.title,
          };

          if (trip.status === 'ACTIVE') {
            return {
              isTripActive: true,
              currentTripId: trip.tripId,
              currentTrip: nextCurrentTrip,
              activeTrip: trip,
            };
          }

          return {
            currentTripId: state.currentTripId === trip.tripId ? trip.tripId : state.currentTripId,
            currentTrip: state.currentTrip?.tripId === trip.tripId ? nextCurrentTrip : state.currentTrip,
            activeTrip: trip,
          };
        }),
      fetchTrips: async (force = false) => {
        const { trips, isTripsLoading, tripsFetchedAt } = get();
        const now = Date.now();

        if (!force && trips.length > 0 && tripsFetchedAt && now - tripsFetchedAt < 60_000) {
          return trips;
        }

        if (isTripsLoading) {
          return trips;
        }

        set({ isTripsLoading: true });

        try {
          const response = await getTripsApi();

          if (!response.success) {
            return get().trips;
          }

          set({
            trips: response.data.items,
            tripsFetchedAt: Date.now(),
          });

          return response.data.items;
        } finally {
          set({ isTripsLoading: false });
        }
      },
      restoreActiveTripFromServer: async () => {
        const persistedTripId = get().currentTripId;
        if (!persistedTripId) {
          return null;
        }

        const detailResponse = await getTripDetailApi(persistedTripId);
        if (detailResponse.success) {
          if (detailResponse.data.status === 'ACTIVE') {
            get().syncAcceptedTrip(detailResponse.data);
            void get().fetchTrips(true);
            return detailResponse.data;
          }

          if (get().currentTripId === detailResponse.data.tripId || get().isTripActive) {
            get().clearTrip();
          }
          void get().fetchTrips(true);
          return detailResponse.data;
        }

        const trips = await get().fetchTrips(true);
        const activeTripListItem = trips.find((trip) => trip.tripId === persistedTripId && trip.status === 'ACTIVE');

        if (!activeTripListItem) {
          return null;
        }

        const activeDetailResponse = await getTripDetailApi(activeTripListItem.tripId);
        if (!activeDetailResponse.success) {
          return null;
        }

        if (activeDetailResponse.data.status !== 'ACTIVE') {
          if (get().currentTripId === activeDetailResponse.data.tripId || get().isTripActive) {
            get().clearTrip();
          }
          return activeDetailResponse.data;
        }

        get().syncAcceptedTrip(activeDetailResponse.data);
        return activeDetailResponse.data;
      },
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
      removeTrip: (tripId) =>
        set((state) => ({
          trips: state.trips.filter((t) => t.tripId !== tripId),
          tripsFetchedAt: 0, // Force fresh fetch on next call
        })),
    }),
    {
      name: 'trip-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isTripActive: state.isTripActive,
        currentTripId: state.currentTripId,
        currentTrip: state.currentTrip,
        activeTrip: state.activeTrip,
      }),
    },
  ),
);

export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectCurrentTrip = (s: TripState) => s.currentTrip;
export const selectReviewTrip = (s: TripState) => s.reviewTrip;
export const selectActiveTrip = (s: TripState) => s.activeTrip;
export const selectTrips = (s: TripState) => s.trips;
export const selectRouteRefreshKey = (s: TripState) => s.routeRefreshKey;
export const selectLocationSyncStatus = (s: TripState) => s.locationSyncStatus;
export const selectLocationSyncMessage = (s: TripState) => s.locationSyncMessage;
export const selectLocationSyncUpdatedAt = (s: TripState) => s.locationSyncUpdatedAt;
