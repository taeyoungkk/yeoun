import axios from 'axios';
import apiClient from './client';

interface ApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
}

export type FriendStatus =
  | 'NONE'
  | 'REQUESTED'
  | 'REQUESTED_BY_ME'
  | 'REQUESTED_TO_ME'
  | 'ACCEPTED';

export interface FriendSearchItem {
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  friendStatus: FriendStatus;
}

export interface FriendListItem {
  friendshipId: string;
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
}

export interface FriendRequestItem {
  friendshipId: string;
  userId: string;
  nickname: string;
  profileImageUrl: string | null;
  status: string;
}

export interface FriendRequestCreateData {
  friendshipId: string;
  friendUserId: string;
  status: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  return axios.isAxiosError(error) && !error.response;
};

const MOCK_FRIENDS: FriendListItem[] = [
  {
    friendshipId: 'mock-friendship-1',
    userId: 'mock-user-1',
    nickname: '민수',
    profileImageUrl: null,
  },
  {
    friendshipId: 'mock-friendship-2',
    userId: 'mock-user-2',
    nickname: '지우',
    profileImageUrl: null,
  },
];

const MOCK_RECEIVED_REQUESTS: FriendRequestItem[] = [
  {
    friendshipId: 'mock-received-1',
    userId: 'mock-user-3',
    nickname: '서연',
    profileImageUrl: null,
    status: 'REQUESTED',
  },
];

const MOCK_SENT_REQUESTS: FriendRequestItem[] = [
  {
    friendshipId: 'mock-sent-1',
    userId: 'mock-user-4',
    nickname: '도훈',
    profileImageUrl: null,
    status: 'REQUESTED',
  },
];

const MOCK_SEARCH_RESULTS: FriendSearchItem[] = [
  {
    userId: 'mock-search-1',
    nickname: '민서',
    profileImageUrl: null,
    friendStatus: 'NONE',
  },
  {
    userId: 'mock-search-2',
    nickname: '지후',
    profileImageUrl: null,
    friendStatus: 'REQUESTED_BY_ME',
  },
];

export const searchFriendsApi = async (keyword: string): Promise<ApiResponse<{ items: FriendSearchItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: FriendSearchItem[] }>>('/friends/search', {
      params: { keyword },
    });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      const normalizedKeyword = keyword.trim().toLowerCase();
      return {
        success: true,
        data: {
          items: MOCK_SEARCH_RESULTS.filter((item) => item.nickname.toLowerCase().includes(normalizedKeyword)),
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const sendFriendRequestApi = async (friendUserId: string): Promise<ApiResponse<FriendRequestCreateData>> => {
  try {
    const response = await apiClient.post<ApiResponse<FriendRequestCreateData>>('/friends/requests', {
      friendUserId,
    });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: {
          friendshipId: `mock-request-${Date.now()}`,
          friendUserId,
          status: 'REQUESTED',
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const getReceivedFriendRequestsApi = async (): Promise<ApiResponse<{ items: FriendRequestItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: FriendRequestItem[] }>>('/friends/requests/received');
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { items: MOCK_RECEIVED_REQUESTS },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const getSentFriendRequestsApi = async (): Promise<ApiResponse<{ items: FriendRequestItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: FriendRequestItem[] }>>('/friends/requests/sent');
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { items: MOCK_SENT_REQUESTS },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const acceptFriendRequestApi = async (friendshipId: string): Promise<ApiResponse<null>> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>(`/friends/requests/${friendshipId}/accept`);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const declineFriendRequestApi = async (friendshipId: string): Promise<ApiResponse<null>> => {
  try {
    const response = await apiClient.post<ApiResponse<null>>(`/friends/requests/${friendshipId}/decline`);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: null,
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const getFriendsApi = async (): Promise<ApiResponse<{ items: FriendListItem[] }>> => {
  try {
    const response = await apiClient.get<ApiResponse<{ items: FriendListItem[] }>>('/friends');
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        data: { items: MOCK_FRIENDS },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
