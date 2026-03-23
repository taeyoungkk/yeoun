import { create } from 'zustand';

interface NotificationState {
  unreadCount: number;
  hasUnread: boolean;
  
  // Actions
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  clearUnreadCount: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  hasUnread: false,

  setUnreadCount: (count) => 
    set({ unreadCount: count, hasUnread: count > 0 }),
    
  incrementUnreadCount: () => 
    set((state) => ({ 
      unreadCount: state.unreadCount + 1, 
      hasUnread: true 
    })),
    
  clearUnreadCount: () => 
    set({ unreadCount: 0, hasUnread: false }),
}));

export const selectUnreadCount = (s: NotificationState) => s.unreadCount;
export const selectHasUnread = (s: NotificationState) => s.hasUnread;
