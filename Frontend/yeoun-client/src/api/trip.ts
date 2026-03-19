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

export interface TripDetail {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  region: string;
  country: string;
  participants: number;
  imageUrl?: string;
  status: string;
}

export interface TripDetailResponse {
  success: boolean;
  code: string;
  message: string;
  data: TripDetail;
  timestamp: string;
}

export interface TripListItem {
  tripId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  memberCount: number;
}

export interface TripListResponse {
  success: boolean;
  code: string;
  message: string;
  data: {
    items: TripListItem[];
  };
  timestamp: string;
}

export interface CreateTripRequest {
  title: string;
  startDate: string;
  endDate: string;
  region: string;
  country: string;
  participants: number;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

export const createTripApi = async (data: CreateTripRequest): Promise<TripDetailResponse> => {
  try {
    const response = await apiClient.post('/trips', data);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip created (MOCK)',
        data: {
          tripId: `mock-trip-${Date.now()}`,
          ...data,
          status: 'DRAFT',
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Create Trip API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || '여행 생성 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};

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
        message: '여행 시작 처리 성공 (MOCK)',
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
        message: '여행 종료 처리 성공 (MOCK)',
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

export const uploadLocationsApi = async (
  tripId: string,
  locations: LocationLog[],
): Promise<TripLocationResponse> => {
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
        message: '위치 업로드 성공 (MOCK)',
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
      message: error.response?.data?.message || '위치 업로드 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripDetailApi = async (tripId: string): Promise<TripDetailResponse> => {
  try {
    const response = await apiClient.get(`/trips/${tripId}`);
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Trip details fetched (MOCK)',
        data: {
          tripId: tripId || 'mock-trip-id',
          title: 'mock 여행 제목',
          startDate: '2024.02.03',
          endDate: '2024.02.06',
          region: '제주',
          country: '대한민국',
          participants: 2,
          status: 'ONGOING',
        },
        timestamp: new Date().toISOString(),
      };
    }

    console.error('Get Trip Detail API Error:', error);
    return {
      success: false,
      code: 'ERROR',
      message: error.response?.data?.message || '여행 상세 조회 중 오류가 발생했습니다.',
      data: {} as any,
      timestamp: new Date().toISOString(),
    };
  }
};

export const getTripsApi = async (): Promise<TripListResponse> => {
  try {
    const response = await apiClient.get('/trips');
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
              title: '제주도 여행',
              startDate: '2024.02.03',
              endDate: '2024.02.06',
              status: 'COMPLETED',
              memberCount: 2,
            },
            {
              tripId: 'mock-2',
              title: '강릉 우정 여행',
              startDate: '2023.12.15',
              endDate: '2023.12.18',
              status: 'COMPLETED',
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
      message: error.response?.data?.message || '여행 목록 조회 중 오류가 발생했습니다.',
      data: { items: [] },
      timestamp: new Date().toISOString(),
    };
  }
};
