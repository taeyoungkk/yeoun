import { create } from 'zustand';
import { FriendRequestItem, getReceivedFriendRequestsApi } from '@/src/api/friend';

/** 알림 타입: 여행 초대, 영수증 인증 요청, 정산 요청 */
export type NotificationType = 'INVITATION' | 'RECEIPT_REMINDER' | 'PAYMENT_REQUEST';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  data?: {
    tripId?: string;
    tripName?: string;
    inviter?: string;
    amount?: number;
    shopName?: string;
    currency?: string;
    inviteToken?: string;
  };
}

interface NotificationState {
  notifications: Notification[];
  friendRequests: FriendRequestItem[];
  unreadCount: number;
  hasUnread: boolean;
  
  /** 액션: 알림 목록 설정, 읽음 처리, 삭제, 전체 읽음 처리 */
  setNotifications: (notifications: Notification[]) => void;
  markAsRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearUnreadCount: () => void;

  fetchFriendRequests: () => Promise<void>;
  removeFriendRequest: (friendshipId: string) => void;
}

/** 초기 데모를 위한 목업 데이터 */
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'INVITATION',
    title: '여행 초대',
    message: '김세현님이 \'제주도 푸른밤\' 여행에 초대했습니다.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30분 전
    isRead: false,
    data: {
      tripId: 'trip-123',
      tripName: '제주도 푸른밤',
      inviter: '김세현',
      inviteToken: 'mock-token- 제주',
    },
  },
  {
    id: '2',
    type: 'RECEIPT_REMINDER',
    title: '영수증 인증 요청',
    message: '\'스타벅스 제주애월점\' 결제 내역이 있습니다. 영수증 사진을 찍어주세요!',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2시간 전
    isRead: false,
    data: {
      shopName: '스타벅스 제주애월점',
      amount: 15600,
    },
  },
  {
    id: '3',
    type: 'PAYMENT_REQUEST',
    title: '정산 요청',
    message: '\'유동훈\'님이 \'흑돼지 저녁 식사\' 비용 정산을 요청했습니다.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5시간 전
    isRead: false,
    data: {
      amount: 25000,
      inviter: '유동훈',
      shopName: '흑돼지 저녁 식사',
    },
  },
];

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: MOCK_NOTIFICATIONS,
  friendRequests: [],
  unreadCount: MOCK_NOTIFICATIONS.length,
  hasUnread: MOCK_NOTIFICATIONS.length > 0,

  setNotifications: (notifications) => 
    set((state) => ({ 
      notifications, 
      unreadCount: notifications.filter(n => !n.isRead).length + state.friendRequests.length,
      hasUnread: notifications.some(n => !n.isRead) || state.friendRequests.length > 0
    })),

  markAsRead: (id) =>
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.isRead).length + state.friendRequests.length,
        hasUnread: updated.some(n => !n.isRead) || state.friendRequests.length > 0
      };
    }),

  removeNotification: (id) =>
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.isRead).length + state.friendRequests.length,
        hasUnread: updated.some(n => !n.isRead) || state.friendRequests.length > 0
      };
    }),
    
  clearUnreadCount: () => 
    set((state) => ({ 
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: state.friendRequests.length, 
      hasUnread: state.friendRequests.length > 0 
    })),

  fetchFriendRequests: async () => {
    try {
      const res = await getReceivedFriendRequestsApi();
      if (res.success) {
        set((state) => {
          const newRequests = res.data.items || [];
          return {
            friendRequests: newRequests,
            unreadCount: state.notifications.filter(n => !n.isRead).length + newRequests.length,
            hasUnread: state.notifications.some(n => !n.isRead) || newRequests.length > 0
          };
        });
      }
    } catch (e) {
      console.error('Failed to fetch friend requests', e);
    }
  },

  removeFriendRequest: (friendshipId) =>
    set((state) => {
      const updated = state.friendRequests.filter(r => r.friendshipId !== friendshipId);
      return {
        friendRequests: updated,
        unreadCount: state.notifications.filter(n => !n.isRead).length + updated.length,
        hasUnread: state.notifications.some(n => !n.isRead) || updated.length > 0
      };
    }),
}));

export const selectUnreadCount = (s: NotificationState) => s.unreadCount;
export const selectHasUnread = (s: NotificationState) => s.hasUnread;
