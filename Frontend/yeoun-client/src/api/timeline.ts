import axios from 'axios';

import apiClient from './client';
import { isMockTripId } from './trip';

export interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface TimelineDaySummary {
  timelineDayId: string;
  dayDate: string;
  summaryText: string;
  distanceM: number;
  photoCount: number;
  eventCount: number;
  updatedAt: string;
}

export interface EventPhoto {
  eventPhotoId: string;
  photoId: string;
  storageKey?: string;
  thumbnailKey: string;
  fileName?: string;
  takenAt: string;
  sortOrder: number;
  representative: boolean;
}

export interface EventMemo {
  eventMemoId: string;
  eventId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEventSummary {
  eventId: string;
  createdBy: string;
  eventType: 'PLACE_VISIT' | 'MOVE' | 'OTHER';
  title: string;
  placeName: string | null;
  placeProvider?: string | null;
  providerPlaceId?: string | null;
  startAt: string | null;
  endAt: string | null;
  hidden: boolean;
  photoCount: number;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  representativePhoto?: {
    eventPhotoId?: string;
    photoId?: string;
    thumbnailKey?: string | null;
    imageUrl?: string | null; // Keep for backward compatibility or mapping
  } | null;
}

export interface EventDetail extends TimelineEventSummary {
  tripId: string;
  timelineDayId: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusM: number;
  createdAt: string;
  updatedAt: string;
  photos: EventPhoto[];
  myMemo: EventMemo | null;
}

export interface TimelineDayDetail extends TimelineDaySummary {
  tripId: string;
  createdAt: string;
  events: TimelineEventSummary[];
}

export interface EventUpdateRequest {
  title?: string;
  placeName?: string | null;
  placeExternalId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusM?: number | null;
  hidden?: boolean;
}

export interface EventUpdateData {
  eventId: string;
  title: string;
  placeName: string | null;
  placeProvider?: string | null;
  providerPlaceId?: string | null;
  placeExternalId?: string | null;
  startAt: string | null;
  endAt: string | null;
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  radiusM?: number | null;
  hidden: boolean;
  updatedAt: string;
}

export interface EventMemoUpsertRequest {
  content: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ??
  error?.response?.data?.error?.message ??
  fallback;

const getErrorCode = (error: any, fallback = 'ERROR') =>
  error?.response?.data?.code ??
  error?.response?.data?.error?.code ??
  fallback;

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
};

const mapTimelineDaySummary = (item: any): TimelineDaySummary => ({
  timelineDayId: String(item.timelineDayId),
  dayDate: item.dayDate,
  summaryText: item.summaryText ?? '',
  distanceM: toNumber(item.distanceM),
  photoCount: toNumber(item.photoCount),
  eventCount: toNumber(item.eventCount),
  updatedAt: item.updatedAt,
});

const mapTimelineEventSummary = (item: any): TimelineEventSummary => {
  const representativePhoto = item.representativePhoto
    ? {
        ...item.representativePhoto,
        // Ensure imageUrl is populated from thumbnailKey if missing
        imageUrl: item.representativePhoto.imageUrl || item.representativePhoto.thumbnailKey || null,
      }
    : null;

  return {
    eventId: String(item.eventId),
    createdBy: String(item.createdBy),
    eventType: item.eventType,
    title: item.title ?? '',
    placeName: item.placeName ?? null,
    placeProvider: item.placeProvider ?? null,
    providerPlaceId: item.providerPlaceId ?? null,
    startAt: item.startAt ?? null,
    endAt: item.endAt ?? null,
    hidden: Boolean(item.hidden),
    photoCount: toNumber(item.photoCount),
    centerLatitude: item.centerLatitude == null ? null : toNumber(item.centerLatitude),
    centerLongitude: item.centerLongitude == null ? null : toNumber(item.centerLongitude),
    representativePhoto,
  };
};

const mapTimelineDayDetail = (item: any): TimelineDayDetail => ({
  timelineDayId: String(item.timelineDayId),
  tripId: String(item.tripId),
  dayDate: item.dayDate,
  summaryText: item.summaryText ?? '',
  distanceM: toNumber(item.distanceM),
  photoCount: toNumber(item.photoCount),
  eventCount: toNumber(item.eventCount),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  events: Array.isArray(item.events) ? item.events.map(mapTimelineEventSummary) : [],
});

const mapEventUpdate = (item: any): EventUpdateData => ({
  eventId: String(item.eventId),
  title: item.title ?? '',
  placeName: item.placeName ?? null,
  placeProvider: item.placeProvider ?? null,
  providerPlaceId: item.providerPlaceId ?? null,
  placeExternalId: item.placeExternalId ?? null,
  startAt: item.startAt ?? null,
  endAt: item.endAt ?? null,
  centerLatitude: item.centerLatitude == null ? null : toNumber(item.centerLatitude),
  centerLongitude: item.centerLongitude == null ? null : toNumber(item.centerLongitude),
  radiusM: item.radiusM == null ? null : toNumber(item.radiusM),
  hidden: Boolean(item.hidden),
  updatedAt: item.updatedAt,
});

export const getTripTimelineDaysApi = async (tripId: string): Promise<ApiResponse<{ timelineDays: TimelineDaySummary[] }>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: { timelineDays: [] },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await apiClient.get<ApiResponse<{ timelineDays: any[] }>>(`/trips/${tripId}/timeline-days`);
    return {
      ...response.data,
      data: {
        timelineDays: Array.isArray(response.data.data?.timelineDays)
          ? response.data.data.timelineDays.map(mapTimelineDaySummary)
          : [],
      },
    };
  } catch (error: any) {
    console.error('Get Trip Timeline Days API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trip timeline days.'),
      data: { timelineDays: [] },
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTimelineDayDetailApi = async (timelineDayId: string): Promise<ApiResponse<TimelineDayDetail>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/timeline-days/${timelineDayId}`);
    return {
      ...response.data,
      data: mapTimelineDayDetail(response.data.data),
    };
  } catch (error: any) {
    console.error('Get Timeline Day Detail API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch timeline day detail.'),
      data: {
        timelineDayId,
        tripId: '',
        dayDate: '',
        summaryText: '',
        distanceM: 0,
        photoCount: 0,
        eventCount: 0,
        createdAt: '',
        updatedAt: '',
        events: [],
      },
      timestamp: new Date().toISOString(),
    };
  }
};

export const getEventDetailApi = async (eventId: string): Promise<ApiResponse<EventDetail>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/events/${eventId}`);
    const data = response.data.data;
    
    return {
      ...response.data,
      data: {
        ...mapTimelineEventSummary(data),
        tripId: String(data.tripId),
        timelineDayId: String(data.timelineDayId),
        centerLatitude: toNumber(data.centerLatitude),
        centerLongitude: toNumber(data.centerLongitude),
        radiusM: toNumber(data.radiusM),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        photos: Array.isArray(data.photos) ? data.photos : [],
        myMemo: data.myMemo ?? null,
      },
    };
  } catch (error: any) {
    console.error('Get Event Detail API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch event detail.'),
      data: {
        eventId,
        createdBy: '',
        eventType: 'OTHER',
        title: '',
        placeName: null,
        startAt: null,
        endAt: null,
        hidden: false,
        photoCount: 0,
        tripId: '',
        timelineDayId: '',
        centerLatitude: 0,
        centerLongitude: 0,
        radiusM: 0,
        createdAt: '',
        updatedAt: '',
        photos: [],
        myMemo: null,
      },
      timestamp: new Date().toISOString(),
    };
  }
};

export const updateEventApi = async (
  eventId: string,
  request: EventUpdateRequest,
): Promise<ApiResponse<EventUpdateData>> => {
  try {
    const response = await apiClient.patch<ApiResponse<any>>(`/events/${eventId}`, request);
    return {
      ...response.data,
      data: mapEventUpdate(response.data.data),
    };
  } catch (error: any) {
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to update event.'),
      data: {} as EventUpdateData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const upsertEventMemoApi = async (
  eventId: string,
  request: EventMemoUpsertRequest,
): Promise<ApiResponse<EventMemo>> => {
  try {
    const response = await apiClient.put<ApiResponse<any>>(`/events/${eventId}/memo`, request);
    return {
      ...response.data,
      data: mapPhotoMemo(response.data.data),
    };
  } catch (error: any) {
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to save event memo.'),
      data: {} as EventMemo,
      timestamp: new Date().toISOString(),
    };
  }
};

const mapPhotoMemo = (item: any): EventMemo => ({
  eventMemoId: String(item.eventMemoId),
  eventId: String(item.eventId),
  userId: String(item.userId),
  content: item.content ?? '',
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});
