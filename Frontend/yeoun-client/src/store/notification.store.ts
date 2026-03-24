import { create } from 'zustand';

import {
  getNotificationsApi,
  markAllNotificationsAsReadApi,
  markNotificationAsReadApi,
  NotificationItemResponse,
} from '@/src/api/notification';

export type NotificationType = string;

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  data?: {
    friendshipId?: string;
    userId?: string;
    profileImageUrl?: string | null;
    tripInviteId?: string;
    tripId?: string;
    tripName?: string;
    inviter?: string;
    inviteToken?: string;
    resourceId?: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  hasUnread: boolean;
  setNotifications: (notifications: Notification[]) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => void;
}

const countUnread = (notifications: Notification[]) =>
  notifications.filter((notification) => !notification.isRead).length;

const isFriendRequestType = (type: string) => type.includes('FRIEND_REQUEST');
const isTripInviteType = (type: string) => type.includes('TRIP_INVITE');

const mapNotificationItem = (item: NotificationItemResponse): Notification => {
  const resourceId = item.resourceId ?? undefined;

  return {
    id: item.notificationId,
    type: item.type,
    title: item.title,
    message: item.body,
    timestamp: item.createdAt,
    isRead: item.isRead,
    data: {
      friendshipId: isFriendRequestType(item.type) ? resourceId : undefined,
      userId: item.actorUserId ?? undefined,
      tripInviteId: isTripInviteType(item.type) ? resourceId : undefined,
      tripId: item.tripId ?? undefined,
      resourceId,
    },
  };
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  hasUnread: false,

  setNotifications: (notifications) => {
    const unreadCount = countUnread(notifications);
    set({
      notifications,
      unreadCount,
      hasUnread: unreadCount > 0,
    });
  },

  fetchNotifications: async () => {
    try {
      const response = await getNotificationsApi();
      const notifications = response.success ? response.data.notifications.map(mapNotificationItem) : [];
      const unreadCount = countUnread(notifications);

      set({
        notifications,
        unreadCount,
        hasUnread: unreadCount > 0,
      });
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  },

  markAsRead: async (id) => {
    const target = get().notifications.find((notification) => notification.id === id);
    if (!target || target.isRead) {
      return;
    }

    try {
      const response = await markNotificationAsReadApi(id);
      if (!response.success) {
        return;
      }
    } catch (error) {
      console.error('Failed to mark notification as read', error);
      return;
    }

    set((state) => {
      const notifications = state.notifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification,
      );
      const unreadCount = countUnread(notifications);
      return {
        notifications,
        unreadCount,
        hasUnread: unreadCount > 0,
      };
    });
  },

  markAllAsRead: async () => {
    if (get().unreadCount === 0) {
      return;
    }

    try {
      const response = await markAllNotificationsAsReadApi();
      if (!response.success) {
        return;
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
      return;
    }

    set((state) => ({
      notifications: state.notifications.map((notification) => ({ ...notification, isRead: true })),
      unreadCount: 0,
      hasUnread: false,
    }));
  },

  removeNotification: (id) =>
    set((state) => {
      const notifications = state.notifications.filter((notification) => notification.id !== id);
      const unreadCount = countUnread(notifications);
      return {
        notifications,
        unreadCount,
        hasUnread: unreadCount > 0,
      };
    }),
}));

export const selectUnreadCount = (s: NotificationState) => s.unreadCount;
export const selectHasUnread = (s: NotificationState) => s.hasUnread;
