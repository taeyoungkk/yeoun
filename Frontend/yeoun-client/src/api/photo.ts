import axios from 'axios';

import apiClient from './client';
import { isMockTripId } from './trip';

export interface PhotoApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export interface TripPhotoListItem {
  photoId: string;
  thumbnailUrl: string;
  takenAt: string | null;
  isExcluded: boolean;
}

export interface TripPhotoListData {
  items: TripPhotoListItem[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface PhotoMemo {
  photoMemoId: string;
  photoId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoDetail {
  photoId: string;
  ownerUserId: string;
  tripId: string;
  originalUrl: string;
  thumbnailUrl: string;
  fileName: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  takenAt: string | null;
  takenTimezone: string | null;
  exifLatitude: number | null;
  exifLongitude: number | null;
  isExcluded: boolean;
  myMemo: {
    content: string;
    updatedAt: string;
  } | null;
}

export interface PhotoUpdateRequest {
  isExcluded: boolean;
}

export interface PhotoUpdateData {
  photoId: string;
  isExcluded: boolean;
  updatedAt: string;
}

export interface PhotoMemoUpsertRequest {
  content: string;
}

export interface PhotoSyncItemRequest {
  clientPhotoUuid: string;
  takenAt?: string | null;
  takenTimezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PhotoSyncRequest {
  items: PhotoSyncItemRequest[];
}

export interface PhotoSyncItemResponse {
  clientPhotoUuid: string;
  photoId: string;
  storageKey?: string | null;
  thumbnailKey?: string | null;
  takenAt?: string | null;
}

export interface PhotoSyncData {
  tripId: string;
  syncedCount: number;
  items: PhotoSyncItemResponse[];
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

const toNullableNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const mapTripPhotoListItem = (item: any): TripPhotoListItem => ({
  photoId: String(item.photoId),
  thumbnailUrl: item.thumbnailUrl ?? '',
  takenAt: item.takenAt ?? null,
  isExcluded: Boolean(item.isExcluded),
});

const mapPhotoMemo = (item: any): PhotoMemo => ({
  photoMemoId: String(item.photoMemoId),
  photoId: String(item.photoId),
  userId: String(item.userId),
  content: item.content ?? '',
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const mapPhotoDetail = (item: any): PhotoDetail => ({
  photoId: String(item.photoId),
  ownerUserId: String(item.ownerUserId),
  tripId: String(item.tripId),
  originalUrl: item.originalUrl ?? '',
  thumbnailUrl: item.thumbnailUrl ?? '',
  fileName: item.fileName ?? '',
  mimeType: item.mimeType ?? '',
  width: toNullableNumber(item.width),
  height: toNullableNumber(item.height),
  takenAt: item.takenAt ?? null,
  takenTimezone: item.takenTimezone ?? null,
  exifLatitude: toNullableNumber(item.exifLatitude),
  exifLongitude: toNullableNumber(item.exifLongitude),
  isExcluded: Boolean(item.isExcluded),
  myMemo: item.myMemo
    ? {
        content: item.myMemo.content ?? '',
        updatedAt: item.myMemo.updatedAt,
      }
    : null,
});

const mapPhotoUpdate = (item: any): PhotoUpdateData => ({
  photoId: String(item.photoId),
  isExcluded: Boolean(item.isExcluded),
  updatedAt: item.updatedAt,
});

export const getTripPhotosApi = async (
  tripId: string,
  params?: { cursor?: string; limit?: number },
): Promise<PhotoApiResponse<TripPhotoListData>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: {
        items: [],
        nextCursor: null,
        hasNext: false,
      },
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await apiClient.get<PhotoApiResponse<any>>(`/trips/${tripId}/photos`, {
      params: {
        cursor: params?.cursor,
        limit: params?.limit,
      },
    });

    return {
      ...response.data,
      data: {
        items: Array.isArray(response.data.data?.items)
          ? response.data.data.items.map(mapTripPhotoListItem)
          : [],
        nextCursor: response.data.data?.nextCursor ?? null,
        hasNext: Boolean(response.data.data?.hasNext),
      },
    };
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          items: [],
          nextCursor: null,
          hasNext: false,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trip Photos API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch trip photos.'),
      data: {
        items: [],
        nextCursor: null,
        hasNext: false,
      },
      timestamp: new Date().toISOString(),
    };
  }
};

export const getPhotoDetailApi = async (photoId: string): Promise<PhotoApiResponse<PhotoDetail>> => {
  try {
    const response = await apiClient.get<PhotoApiResponse<any>>(`/photos/${photoId}`);
    return {
      ...response.data,
      data: mapPhotoDetail(response.data.data),
    };
  } catch (error: any) {
    console.error('Get Photo Detail API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch photo detail.'),
      data: {} as PhotoDetail,
      timestamp: new Date().toISOString(),
    };
  }
};

export const updatePhotoApi = async (
  photoId: string,
  request: PhotoUpdateRequest,
): Promise<PhotoApiResponse<PhotoUpdateData>> => {
  try {
    const response = await apiClient.patch<PhotoApiResponse<any>>(`/photos/${photoId}`, request);
    return {
      ...response.data,
      data: mapPhotoUpdate(response.data.data),
    };
  } catch (error: any) {
    console.error('Update Photo API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to update photo.'),
      data: {} as PhotoUpdateData,
      timestamp: new Date().toISOString(),
    };
  }
};

export const upsertPhotoMemoApi = async (
  photoId: string,
  request: PhotoMemoUpsertRequest,
): Promise<PhotoApiResponse<PhotoMemo>> => {
  try {
    const response = await apiClient.put<PhotoApiResponse<any>>(`/photos/${photoId}/memo`, request);
    return {
      ...response.data,
      data: mapPhotoMemo(response.data.data),
    };
  } catch (error: any) {
    console.error('Upsert Photo Memo API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to save photo memo.'),
      data: {} as PhotoMemo,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getPhotoMemoApi = async (photoId: string): Promise<PhotoApiResponse<PhotoMemo>> => {
  try {
    const response = await apiClient.get<PhotoApiResponse<any>>(`/photos/${photoId}/memo`);
    return {
      ...response.data,
      data: mapPhotoMemo(response.data.data),
    };
  } catch (error: any) {
    console.error('Get Photo Memo API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch photo memo.'),
      data: {} as PhotoMemo,
      timestamp: new Date().toISOString(),
    };
  }
};

export const deletePhotoMemoApi = async (photoId: string): Promise<PhotoApiResponse<null>> => {
  try {
    const response = await apiClient.delete<PhotoApiResponse<null>>(`/photos/${photoId}/memo`);
    return {
      ...response.data,
      data: null,
    };
  } catch (error: any) {
    console.error('Delete Photo Memo API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to delete photo memo.'),
      data: null,
      timestamp: new Date().toISOString(),
    };
  }
};

export const syncTripPhotosApi = async (
  tripId: string,
  metadata: PhotoSyncRequest,
  files: Array<{ uri: string; name: string; type: string }>,
): Promise<PhotoApiResponse<PhotoSyncData>> => {
  if (isMockTripId(tripId)) {
    return {
      success: true,
      data: {
        tripId,
        syncedCount: files.length,
        items: metadata.items.map((item, index) => ({
          clientPhotoUuid: item.clientPhotoUuid,
          photoId: `mock-photo-${index + 1}`,
          storageKey: null,
          thumbnailKey: null,
          takenAt: item.takenAt ?? null,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }

  const formData = new FormData();
  formData.append('metadata', JSON.stringify(metadata));
  files.forEach((file, index) => {
    formData.append('files', {
      uri: file.uri,
      name: file.name || `photo-${index + 1}.jpg`,
      type: file.type || 'image/jpeg',
    } as any);
  });

  try {
    const response = await apiClient.post<PhotoApiResponse<PhotoSyncData>>(
      `/trips/${tripId}/photos/sync`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  } catch (error: any) {
    console.error('Sync Trip Photos API Error:', error);
    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to sync trip photos.'),
      data: {
        tripId,
        syncedCount: 0,
        items: [],
      },
      timestamp: new Date().toISOString(),
    };
  }
};
