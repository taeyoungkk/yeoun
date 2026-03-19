import axios from 'axios';
import apiClient from './client';

export interface TripStartResponse {
  success: boolean;
  code: string;
  message: string;
  data: {
    tripId: string;
    status: string;
    startedAt: string;
  };
  timestamp: string;
}

export interface LocationLog {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
}

export interface TripLocationResponse {
  success: boolean;
  code: string;
  message: string;
  data: any;
  timestamp: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

/**
 * Starts a trip by its ID.
 * POST /api/v1/trips/{tripId}/start
 */
export const startTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post(`/trips/${tripId}/start`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      console.log('startTripApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: '여행 시작 처리 완료 (MOCK)',
        data: {
          tripId,
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Start Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || '여행 시작 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Ends a trip by its ID.
 * POST /api/v1/trips/{tripId}/end
 */
export const endTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post(`/trips/${tripId}/end`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      console.log('endTripApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: '여행 종료 처리 완료 (MOCK)',
        data: {
          tripId,
          status: 'COMPLETED',
          startedAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('End Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || '여행 종료 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Uploads a batch of location logs for a trip.
 * POST /api/v1/trips/{tripId}/locations
 */
export const uploadLocationsApi = async (tripId: string, locations: LocationLog[]): Promise<TripLocationResponse> => {
  try {
    const response = await apiClient.post(`/trips/${tripId}/locations`, {
      locations,
    });
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      console.log('uploadLocationsApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: '위치 로그 업로드 완료 (MOCK)',
        data: {
          tripId,
          uploadedCount: locations.length,
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Upload Locations API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || '위치 정보 업로드 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};
