import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export { LocationLog, TripDetail, TripListItem } from '../api/trip';
import { getTripDetailApi, getTripsApi, LocationLog, TripDetail, TripListItem } from '../api/trip';
import { useUserStore } from './user.store';

const isTerminalTripStatus = (status?: string | null) => status === 'ENDED' || status === 'DELETED';

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
  lastSyncedLogUuid: string | null;
  inFlightLogs: LocationLog[];
  currentAddress: string | null;
  locationStatus: 'LOADING' | 'SUCCESS' | 'DENIED' | 'GPS_OFF';
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
  setLastSyncedLogUuid: (uuid: string | null) => void;
  addInFlightLogs: (logs: LocationLog[]) => void;
  clearInFlightLogs: () => void;
  endTrip: () => void;
  clearTrip: () => void;
  removeTrip: (tripId: string) => void;
  setCurrentAddress: (address: string | null, status?: 'LOADING' | 'SUCCESS' | 'DENIED' | 'GPS_OFF') => void;
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
      lastSyncedLogUuid: null,
      inFlightLogs: [],
      currentAddress: null,
      locationStatus: 'LOADING',
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
            destination: trip.region ?? trip.country ?? '',
          };
          const hasDifferentActiveTrip =
            state.isTripActive && state.currentTripId !== null && state.currentTripId !== trip.tripId;

          if (trip.status === 'ACTIVE' && !hasDifferentActiveTrip) {
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
            activeTrip: state.activeTrip?.tripId === trip.tripId ? trip : state.activeTrip,
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
      setCurrentAddress: (address, status = 'SUCCESS') => {
        const current = get();
        if (current.currentAddress === address && current.locationStatus === status) {
          return;
        }
        set({ 
          currentAddress: address,
          locationStatus: status 
        });
      },
      restoreActiveTripFromServer: async () => {
        const persistedTripId = get().currentTripId;
        if (!persistedTripId) {
          return null;
        }

        const detailResponse = await getTripDetailApi(persistedTripId);
        
        // Handle 404 (Not Found) - Clear the stale state
        // The API returns success: false and code: 'NOT_FOUND' (from getErrorCode) for 404s
        if (!detailResponse.success && detailResponse.code === 'NOT_FOUND') {
          console.warn('[TripStore] Active trip not found on server (404). Cleaning up stale state.');
          get().clearTrip();
          return null;
        }

        if (detailResponse.success) {
          const tripData = detailResponse.data;
          const currentUserId = useUserStore.getState().profile?.userId;

          // Ownership check: If the trip belongs to someone else, don't restore it as ACTIVE
          if (tripData.ownerUserId && currentUserId && tripData.ownerUserId !== currentUserId) {
            console.warn('[TripStore] Active trip ownership mismatch. Cleaning up stale state.');
            get().clearTrip();
            void get().fetchTrips(true);
            return null;
          }

          if (isTerminalTripStatus(detailResponse.data.status) && get().currentTripId === detailResponse.data.tripId) {
            get().clearTrip();
          }
          void get().fetchTrips(true);
          return tripData;
        }

        // Fallback: Check trip list if detail fetch failed for reasons other than 404
        const trips = await get().fetchTrips(true);
        const activeTripListItem = trips.find((trip) => trip.tripId === persistedTripId && trip.status === 'ACTIVE');

        if (!activeTripListItem) {
          const matchingTripListItem = trips.find((trip) => trip.tripId === persistedTripId);
          if (matchingTripListItem && isTerminalTripStatus(matchingTripListItem.status) && get().currentTripId === persistedTripId) {
            get().clearTrip();
          }
          return null;
        }

        const activeDetailResponse = await getTripDetailApi(activeTripListItem.tripId);
        if (!activeDetailResponse.success) {
          return null;
        }

        if (activeDetailResponse.data.status !== 'ACTIVE') {
          if (isTerminalTripStatus(activeDetailResponse.data.status) && get().currentTripId === activeDetailResponse.data.tripId) {
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
      setLastSyncedLogUuid: (uuid) => set({ lastSyncedLogUuid: uuid }),
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
      addInFlightLogs: (logs) =>
        set((state) => ({
          inFlightLogs: [...state.inFlightLogs, ...logs],
        })),
      clearInFlightLogs: () =>
        set({
          inFlightLogs: [],
        }),
    }),
    {
      name: 'trip-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isTripActive: state.isTripActive,
        currentTripId: state.currentTripId,
        currentTrip: state.currentTrip,
        activeTrip: state.activeTrip,
        lastSyncedLogUuid: state.lastSyncedLogUuid,
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
