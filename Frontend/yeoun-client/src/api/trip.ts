import axios from 'axios';
import apiClient from './client';

interface CommonApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export interface TripStartData {
  tripId: string;
  status: string;
  startedAt: string;
}

export type TripStartResponse = CommonApiResponse<TripStartData>;

export interface LocationLog {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  accuracyM?: number;
  recordedAt: string;
  clientLogUuid?: string;
  speedMps?: number;
  heading?: number;
  source?: 'GPS' | 'NETWORK' | 'PASSIVE';
}

export interface TripLocationUploadData {
  acceptedCount: number;
  duplicatedCount: number;
}

export type TripLocationResponse = CommonApiResponse<TripLocationUploadData>;

export interface TripDetail {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  memberCount: number;
  visibility?: string;
  ownerUserId?: string;
  reportStatus?: string;
  startedAt?: string | null;
  actualEndedAt?: string | null;
  createdAt?: string;
  region?: string;
  country?: string;
  participants?: number;
  imageUrl?: string;
}

export type TripDetailResponse = CommonApiResponse<TripDetail>;

export interface TripListItem {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  memberCount: number;
}

export interface TripListData {
  items: TripListItem[];
}

export type TripListResponse = CommonApiResponse<TripListData>;

export interface CreateTripRequest {
  title: string;
  startDate: string;
  endDate: string;
  visibility?: 'PRIVATE' | 'PARTIAL_PUBLIC' | 'PUBLIC';
  region?: string;
  country?: string;
  participants?: number;
}

export interface TripCreateData {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  visibility?: string;
  createdAt?: string;
}

export type TripCreateResponse = CommonApiResponse<TripCreateData>;

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const formatApiDate = (value: string) => value.replace(/\./g, '-').slice(0, 10);

const mapTripDetail = (trip: any): TripDetail => ({
  tripId: String(trip.tripId),
  title: trip.title,
  startDate: trip.startDate,
  endDate: trip.endDate,
  status: trip.status,
  memberCount: Number(trip.memberCount ?? trip.participants ?? 0),
  visibility: trip.visibility,
  ownerUserId: trip.ownerUserId,
  reportStatus: trip.reportStatus,
  startedAt: trip.startedAt ?? null,
  actualEndedAt: trip.actualEndedAt ?? null,
  createdAt: trip.createdAt,
  region: trip.region,
  country: trip.country,
  participants: Number(trip.participants ?? trip.memberCount ?? 0),
  imageUrl: trip.imageUrl,
});

const toLocationUploadItem = (location: LocationLog, index: number) => ({
  clientLogUuid: location.clientLogUuid ?? `log-${Date.now()}-${index}`,
  recordedAt: location.recordedAt,
  latitude: location.latitude,
  longitude: location.longitude,
  accuracyM: location.accuracyM ?? location.accuracy ?? 10,
  speedMps: location.speedMps,
  heading: location.heading,
  source: location.source ?? 'GPS',
});

export const createTripApi = async (data: CreateTripRequest): Promise<TripCreateResponse> => {
  const payload = {
    title: data.title,
    startDate: formatApiDate(data.startDate),
    endDate: formatApiDate(data.endDate),
    visibility: data.visibility ?? 'PRIVATE',
  };

  try {
    const response = await apiClient.post<TripCreateResponse>('/trips', payload);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip created (MOCK)',
        data: {
          tripId: `mock-trip-${Date.now()}`,
          title: data.title,
          startDate: payload.startDate,
          endDate: payload.endDate,
          status: 'DRAFT',
          visibility: payload.visibility,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Create Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to create trip.',
      data: {} as TripCreateData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const startTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post<TripStartResponse>(`/trips/${tripId}/start`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip started (MOCK)',
        data: {
          tripId,
          status: 'ACTIVE',
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Start Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to start trip.',
      data: {} as TripStartData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const endTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post<CommonApiResponse<{ tripId: string; status: string; actualEndedAt: string }>>(
      `/trips/${tripId}/end`
    );

    return {
      ...response.data,
      data: {
        tripId: response.data.data.tripId,
        status: response.data.data.status,
        startedAt: response.data.data.actualEndedAt,
      },
    };
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip ended (MOCK)',
        data: {
          tripId,
          status: 'ENDED',
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('End Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to end trip.',
      data: {} as TripStartData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const uploadLocationsApi = async (
  tripId: string,
  locations: LocationLog[],
): Promise<TripLocationResponse> => {
  try {
    const response = await apiClient.post<TripLocationResponse>(`/trips/${tripId}/location-logs:batch`, {
      logs: locations.map(toLocationUploadItem),
    });
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Location logs uploaded (MOCK)',
        data: {
          acceptedCount: locations.length,
          duplicatedCount: 0,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Upload Locations API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to upload location logs.',
      data: {} as TripLocationUploadData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripDetailApi = async (tripId: string): Promise<TripDetailResponse> => {
  try {
    const response = await apiClient.get<TripDetailResponse>(`/trips/${tripId}`);
    return {
      ...response.data,
      data: mapTripDetail(response.data.data),
    };
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip details fetched (MOCK)',
        data: {
          tripId: tripId || 'mock-trip-id',
          title: 'mock trip',
          startDate: '2024-02-03',
          endDate: '2024-02-06',
          status: 'ACTIVE',
          memberCount: 2,
          region: 'Jeju',
          country: 'Korea',
          participants: 2,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trip Detail API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to fetch trip details.',
      data: {} as TripDetail,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripsApi = async (): Promise<TripListResponse> => {
  try {
    const response = await apiClient.get<TripListResponse>('/trips');
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trips fetched (MOCK)',
        data: {
          items: [
            {
              tripId: 'mock-1',
              title: 'mock past trip',
              startDate: '2024-02-03',
              endDate: '2024-02-06',
              status: 'ENDED',
              memberCount: 2,
            },
            {
              tripId: 'mock-2',
              title: 'mock winter trip',
              startDate: '2023-12-15',
              endDate: '2023-12-18',
              status: 'ENDED',
              memberCount: 4,
            },
          ],
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trips API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || 'Failed to fetch trips.',
      data: { items: [] },
      timestamp: new Date().toISOString(),
    };
  }
};
