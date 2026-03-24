import { create } from 'zustand';

import { FriendRequestItem, getReceivedFriendRequestsApi } from '@/src/api/friend';

export type NotificationType = 'FRIEND_REQUEST';

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
  };
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  hasUnread: boolean;
  setNotifications: (notifications: Notification[]) => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const countUnread = (notifications: Notification[]) =>
  notifications.filter((notification) => !notification.isRead).length;

const buildFriendNotifications = (items: FriendRequestItem[]): Notification[] =>
  items.map((item) => ({
    id: `friend-request:${item.friendshipId}`,
    type: 'FRIEND_REQUEST',
    title: '친구 초대',
    message: `${item.nickname}님이 친구 요청을 보냈습니다.`,
    timestamp: new Date().toISOString(),
    isRead: false,
    data: {
      friendshipId: item.friendshipId,
      userId: item.userId,
      profileImageUrl: item.profileImageUrl,
      inviter: item.nickname,
    },
  }));

const preserveReadState = (previous: Notification[], next: Notification[]) => {
  const readMap = new Map(previous.map((notification) => [notification.id, notification.isRead]));
  return next.map((notification) => ({
    ...notification,
    isRead: readMap.get(notification.id) ?? false,
  }));
};

export const useNotificationStore = create<NotificationState>((set) => ({
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
      const friendResponse = await getReceivedFriendRequestsApi();
      const nextNotifications = buildFriendNotifications(friendResponse.data.items ?? []).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      set((state) => {
        const notifications = preserveReadState(state.notifications, nextNotifications);
        const unreadCount = countUnread(notifications);
        return {
          notifications,
          unreadCount,
          hasUnread: unreadCount > 0,
        };
      });
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  },

  markAsRead: (id) =>
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
    }),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({ ...notification, isRead: true })),
      unreadCount: 0,
      hasUnread: false,
    })),

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
