import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  decisionStatus?: 'accept' | 'decline' | 'unavailable';
  decidedAt?: string;
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
  archivedNotifications: Notification[];
  unreadCount: number;
  hasUnread: boolean;
  setNotifications: (notifications: Notification[]) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => void;
  archiveNotification: (notification: Notification, action: 'accept' | 'decline' | 'unavailable') => void;
}

const countUnread = (notifications: Notification[]) =>
  notifications.filter((notification) => !notification.isRead).length;

const mergeArchivedNotifications = (
  currentArchived: Notification[],
  nextArchived: Notification[],
) => {
  const archivedById = new Map<string, Notification>();

  [...nextArchived, ...currentArchived].forEach((notification) => {
    const existing = archivedById.get(notification.id);
    if (!existing) {
      archivedById.set(notification.id, notification);
      return;
    }

    archivedById.set(notification.id, {
      ...notification,
      decisionStatus: existing.decisionStatus ?? notification.decisionStatus,
      decidedAt: existing.decidedAt ?? notification.decidedAt,
    });
  });

  return Array.from(archivedById.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
};

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

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      archivedNotifications: [],
      unreadCount: 0,
      hasUnread: false,

      setNotifications: (notifications) => {
        const currentArchived = get().archivedNotifications;
        const archivedIds = new Set(currentArchived.map((notification) => notification.id));
        const nextArchived = notifications
          .filter((notification) => notification.isRead && !archivedIds.has(notification.id))
          .map((notification) => ({ ...notification, isRead: true }));
        const visibleNotifications = notifications.filter(
          (notification) => !notification.isRead && !archivedIds.has(notification.id),
        );
        const unreadCount = countUnread(visibleNotifications);
        set({
          notifications: visibleNotifications,
          archivedNotifications: mergeArchivedNotifications(currentArchived, nextArchived),
          unreadCount,
          hasUnread: unreadCount > 0,
        });
      },

      fetchNotifications: async () => {
        try {
          const response = await getNotificationsApi();
          const notifications = response.success ? response.data.notifications.map(mapNotificationItem) : [];
          get().setNotifications(notifications);
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

      archiveNotification: (notification, action) =>
        set((state) => {
          const archivedNotification: Notification = {
            ...notification,
            isRead: true,
            decisionStatus: action,
            decidedAt: new Date().toISOString(),
          };
          const notifications = state.notifications.filter((item) => item.id !== notification.id);
          const archivedNotifications = [
            archivedNotification,
            ...state.archivedNotifications.filter((item) => item.id !== notification.id),
          ];
          const unreadCount = countUnread(notifications);

          return {
            notifications,
            archivedNotifications,
            unreadCount,
            hasUnread: unreadCount > 0,
          };
        }),
    }),
    {
      name: 'notification-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        archivedNotifications: state.archivedNotifications,
      }),
    },
  ),
);

export const selectUnreadCount = (s: NotificationState) => s.unreadCount;
export const selectHasUnread = (s: NotificationState) => s.hasUnread;
