import axios from 'axios';

import apiClient from './client';

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

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

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
    startAt: item.startAt ?? null,
    endAt: item.endAt ?? null,
    hidden: Boolean(item.hidden),
    photoCount: toNumber(item.photoCount),
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

export const getTripTimelineDaysApi = async (tripId: string): Promise<ApiResponse<{ timelineDays: TimelineDaySummary[] }>> => {
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
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { timelineDays: [] },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const getTimelineDayDetailApi = async (timelineDayId: string): Promise<ApiResponse<TimelineDayDetail>> => {
  try {
    const response = await apiClient.get<ApiResponse<any>>(`/timeline-days/${timelineDayId}`);
    return {
      ...response.data,
      data: mapTimelineDayDetail(response.data.data),
    };
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          timelineDayId,
          tripId: 'mock-trip',
          dayDate: new Date().toISOString().slice(0, 10),
          summaryText: '',
          distanceM: 0,
          photoCount: 0,
          eventCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          events: [],
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
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
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          eventId,
          createdBy: 'SYSTEM',
          eventType: 'PLACE_VISIT',
          title: 'Mock Event',
          placeName: 'Mock Place',
          startAt: new Date().toISOString(),
          endAt: new Date().toISOString(),
          hidden: false,
          photoCount: 0,
          tripId: 'mock-trip',
          timelineDayId: 'mock-day',
          centerLatitude: 37.5665,
          centerLongitude: 126.9780,
          radiusM: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          photos: [],
          myMemo: null,
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
