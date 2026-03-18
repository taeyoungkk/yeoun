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

/**
 * Starts a trip by its ID.
 * POST /api/v1/trips/{tripId}/start
 */
export const startTripApi = async (tripId: string): Promise<TripStartResponse> => {
  try {
    const response = await apiClient.post(`/trips/${tripId}/start`);
    return response.data;
  } catch (error: any) {
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
