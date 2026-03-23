import axios from 'axios';
import apiClient from './client';

interface ApiErrorShape {
  code?: string;
  message?: string;
}

export interface CommonApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
  error?: ApiErrorShape;
}

export interface TripStartData {
  tripId: string;
  status: string;
  startedAt: string;
}

export type TripStartResponse = CommonApiResponse<TripStartData>;

export interface TripLeaveData {
  tripId: string;
  left: boolean;
  leftAt: string;
}

export type TripLeaveResponse = CommonApiResponse<TripLeaveData>;

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
  region?: string;
  country?: string;
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
}

export interface TripCreateData {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  visibility?: string;
  createdAt?: string;
  ownerUserId?: string;
}

export type TripCreateResponse = CommonApiResponse<TripCreateData>;

export interface UpdateTripRequest {
  title: string;
  startDate: string;
  endDate: string;
  visibility?: 'PRIVATE' | 'PARTIAL_PUBLIC' | 'PUBLIC';
}

export interface UpdateTripData {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  visibility?: string;
  updatedAt?: string;
}

export type UpdateTripResponse = CommonApiResponse<UpdateTripData>;

export interface TripMemberItem {
  tripInviteId?: string;
  tripMemberId?: string;
  userId: string;
  nickname: string;
  profileImageUrl?: string | null;
  inviteStatus?: string;
  joinedAt?: string | null;
}

export type TripMembersResponse = CommonApiResponse<{ items: TripMemberItem[] }>;

export interface TripInviteUsersRequest {
  inviteeUserIds: string[];
}

export interface TripInviteUsersData {
  tripInviteId?: string;
  tripId: string;
  targetUserId?: string;
  inviteeUserIds?: string[];
  inviteType?: string;
  status?: string;
  expiresAt?: string | null;
}

export type TripInviteUsersResponse = CommonApiResponse<TripInviteUsersData>;

export interface CreateTripInviteLinkRequest {
  expiresAt?: string;
}

export interface CreateTripInviteLinkData {
  tripInviteId: string;
  inviteType: string;
  inviteToken: string;
  inviteUrl: string;
  expiresAt?: string | null;
}

export type CreateTripInviteLinkResponse = CommonApiResponse<CreateTripInviteLinkData>;

export interface TripRoutePoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface TripRouteData {
  date: string;
  distanceM: number;
  points: TripRoutePoint[];
}

export type TripRouteResponse = CommonApiResponse<TripRouteData>;

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const formatApiDate = (value: string) => value.replace(/\./g, '-').slice(0, 10);

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ??
  error?.response?.data?.error?.message ??
  fallback;

const getErrorCode = (error: any, fallback = 'ERROR') =>
  error?.response?.data?.code ??
  error?.response?.data?.error?.code ??
  fallback;

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
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to create trip.'),
      data: {} as TripCreateData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const updateTripApi = async (
  tripId: string,
  data: UpdateTripRequest,
): Promise<UpdateTripResponse> => {
  const payload = {
    title: data.title,
    startDate: formatApiDate(data.startDate),
    endDate: formatApiDate(data.endDate),
    visibility: data.visibility ?? 'PRIVATE',
  };

  try {
    const response = await apiClient.patch<UpdateTripResponse>(`/trips/${tripId}`, payload);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip updated (MOCK)',
        data: {
          tripId,
          title: payload.title,
          startDate: payload.startDate,
          endDate: payload.endDate,
          visibility: payload.visibility,
          updatedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Update Trip API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to update trip.'),
      data: {} as UpdateTripData,
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
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to start trip.'),
      data: {} as TripStartData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const endTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post<CommonApiResponse<{ tripId: string; status: string; actualEndedAt: string }>>(
      `/trips/${tripId}/end`,
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
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to end trip.'),
      data: {} as TripStartData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const leaveTripApi = async (tripId: string): Promise<TripLeaveResponse> => {
  try {
    const response = await apiClient.post<TripLeaveResponse>(`/trips/${tripId}/leave`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip left (MOCK)',
        data: {
          tripId,
          left: true,
          leftAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Leave Trip API Error:', error);
    const normalizedCode = error?.response?.status === 409 ? 'CONFLICT' : getErrorCode(error);
    return {
      success: false,
      code: normalizedCode,
      message: getErrorMessage(error, 'Failed to leave trip.'),
      data: {} as TripLeaveData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const uploadLocationsApi = async (
  tripId: string,
  locations: LocationLog[],
): Promise<TripLocationResponse> => {
  const endpoint = `/trips/${tripId}/location-logs/:batch`;
  const payload = {
    logs: locations.map(toLocationUploadItem),
  };

  try {
    const response = await apiClient.post<TripLocationResponse>(endpoint, payload);
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

    const baseURL = error?.config?.baseURL ?? apiClient.defaults.baseURL ?? 'unknown';
    const requestUrl = error?.config?.url ?? endpoint;
    const requestMethod = error?.config?.method?.toUpperCase?.() ?? 'POST';
    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const errorCode = error?.code;
    const isTimeout = errorCode === 'ECONNABORTED' || String(error?.message ?? '').toLowerCase().includes('timeout');
    const hasResponse = Boolean(error?.response);
    const hasRequest = Boolean(error?.request);

    if (isTimeout) {
      console.error('[LocationUpload] Request timed out.', {
        tripId,
        logsCount: locations.length,
        method: requestMethod,
        baseURL,
        requestUrl,
        errorCode,
        message: error?.message,
      });
    } else if (!hasResponse && hasRequest) {
      console.error('[LocationUpload] Network error: request sent but no response received.', {
        tripId,
        logsCount: locations.length,
        method: requestMethod,
        baseURL,
        requestUrl,
        errorCode,
        message: error?.message,
      });
    } else if (hasResponse) {
      console.error('[LocationUpload] HTTP error response received.', {
        tripId,
        logsCount: locations.length,
        method: requestMethod,
        baseURL,
        requestUrl,
        status,
        errorCode,
        message: error?.message,
        responseData,
      });
    } else {
      console.error('[LocationUpload] Request setup error.', {
        tripId,
        logsCount: locations.length,
        method: requestMethod,
        baseURL,
        requestUrl,
        errorCode,
        message: error?.message,
      });
    }

    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to upload location logs.'),
      data: {} as TripLocationUploadData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripRouteByDayApi = async (tripId: string, dayDate: string): Promise<TripRouteResponse> => {
  try {
    const response = await apiClient.get<TripRouteResponse>(`/trips/${tripId}/days/${dayDate}/route`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip route fetched (MOCK)',
        data: {
          date: dayDate,
          distanceM: 0,
          points: [],
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trip Route API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trip route.'),
      data: {
        date: dayDate,
        distanceM: 0,
        points: [],
      },
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripMembersApi = async (tripId: string): Promise<TripMembersResponse> => {
  try {
    const response = await apiClient.get<TripMembersResponse>(`/trips/${tripId}/members`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip members fetched (MOCK)',
        data: { items: [] },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trip Members API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trip members.'),
      data: { items: [] },
      timestamp: new Date().toISOString(),
    };
  }
};

export const inviteUsersToTripApi = async (
  tripId: string,
  request: TripInviteUsersRequest,
): Promise<TripInviteUsersResponse> => {
  try {
    const response = await apiClient.post<TripInviteUsersResponse>(`/trips/${tripId}/invites/users`, request);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip invite sent (MOCK)',
        data: {
          tripInviteId: `mock-invite-${Date.now()}`,
          tripId,
          targetUserId: request.inviteeUserIds[0],
          inviteeUserIds: request.inviteeUserIds,
          inviteType: 'USER',
          status: 'SENT',
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Invite Users API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to invite user.'),
      data: {} as TripInviteUsersData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const createTripInviteLinkApi = async (
  tripId: string,
  request?: CreateTripInviteLinkRequest,
): Promise<CreateTripInviteLinkResponse> => {
  try {
    const response = await apiClient.post<CreateTripInviteLinkResponse>(`/trips/${tripId}/invites/link`, request ?? {});
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip invite link created (MOCK)',
        data: {
          tripInviteId: `mock-link-${Date.now()}`,
          inviteType: 'LINK',
          inviteToken: `mock-token-${Date.now()}`,
          inviteUrl: `https://triplog.app/invites/mock-token-${Date.now()}`,
          expiresAt: request?.expiresAt,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Create Trip Invite Link API Error:', error);
    const normalizedCode = error?.response?.status === 409 ? 'CONFLICT' : getErrorCode(error);
    return {
      success: false,
      code: normalizedCode,
      message: getErrorMessage(error, 'Failed to create invite link.'),
      data: {} as CreateTripInviteLinkData,
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
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trip details.'),
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
              region: 'Jeju',
              country: 'Korea',
            },
            {
              tripId: 'mock-2',
              title: 'mock winter trip',
              startDate: '2023-12-15',
              endDate: '2023-12-18',
              status: 'ENDED',
              memberCount: 4,
              region: 'Seoul',
              country: 'Korea',
            },
          ],
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trips API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trips.'),
      data: { items: [] },
      timestamp: new Date().toISOString(),
    };
  }
};
