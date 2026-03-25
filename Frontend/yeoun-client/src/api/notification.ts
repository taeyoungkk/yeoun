import axios from 'axios';

import apiClient from './client';

interface ApiErrorShape {
  code?: string;
  message?: string;
}

export interface NotificationApiResponse<T> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  timestamp?: string;
  error?: ApiErrorShape;
}

export interface NotificationItemResponse {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
  actorUserId?: string | null;
  tripId?: string | null;
  resourceId?: string | null;
}

export interface NotificationListData {
  notifications: NotificationItemResponse[];
}

export interface NotificationReadData {
  notificationId: string;
  read: boolean;
}

export interface NotificationUnreadCountData {
  unreadCount: number;
}

export interface NotificationReadAllData {
  updatedCount: number;
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

export const getNotificationsApi = async (): Promise<NotificationApiResponse<NotificationListData>> => {
  try {
    const response = await apiClient.get<NotificationApiResponse<NotificationListData>>('/notifications');
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Notifications fetched (MOCK)',
        data: { notifications: [] },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch notifications.'),
      data: { notifications: [] },
      timestamp: new Date().toISOString(),
    };
  }
};

export const getNotificationUnreadCountApi = async (): Promise<NotificationApiResponse<NotificationUnreadCountData>> => {
  try {
    const response = await apiClient.get<NotificationApiResponse<NotificationUnreadCountData>>('/notifications/unread-count');
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Unread count fetched (MOCK)',
        data: { unreadCount: 0 },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to fetch unread notification count.'),
      data: { unreadCount: 0 },
      timestamp: new Date().toISOString(),
    };
  }
};

export const markNotificationAsReadApi = async (
  notificationId: string,
): Promise<NotificationApiResponse<NotificationReadData>> => {
  try {
    const response = await apiClient.patch<NotificationApiResponse<NotificationReadData>>(
      `/notifications/${notificationId}/read`,
    );
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Notification marked as read (MOCK)',
        data: {
          notificationId,
          read: true,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to mark notification as read.'),
      data: {
        notificationId,
        read: false,
      },
      timestamp: new Date().toISOString(),
    };
  }
};

export const markAllNotificationsAsReadApi = async (): Promise<NotificationApiResponse<NotificationReadAllData>> => {
  try {
    const response = await apiClient.patch<NotificationApiResponse<NotificationReadAllData>>('/notifications/read-all');
    return response.data;
  } catch (error: any) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Notifications marked as read (MOCK)',
        data: { updatedCount: 0 },
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: false,
      code: getErrorCode(error),
      message: getErrorMessage(error, 'Failed to mark all notifications as read.'),
      data: { updatedCount: 0 },
      timestamp: new Date().toISOString(),
    };
  }
};
