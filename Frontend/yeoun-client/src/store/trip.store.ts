import { create } from 'zustand';

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
  startTrip: (trip: CurrentTrip) => void;
  endTrip: () => void;
  clearTrip: () => void;
}

export const useTripStore = create<TripState>((set) => ({
  isTripActive: false,
  currentTripId: null,
  currentTrip: null,
  startTrip: (trip) =>
    set({
      isTripActive: true,
      currentTripId: trip.tripId,
      currentTrip: trip,
    }),
  endTrip: () =>
    set((state) => ({
      isTripActive: false,
      currentTripId: state.currentTrip?.tripId ?? null,
    })),
  clearTrip: () =>
    set({
      isTripActive: false,
      currentTripId: null,
      currentTrip: null,
    }),
}));

export const selectIsTripActive = (s: TripState) => s.isTripActive;
export const selectCurrentTripId = (s: TripState) => s.currentTripId;
export const selectCurrentTrip = (s: TripState) => s.currentTrip;
