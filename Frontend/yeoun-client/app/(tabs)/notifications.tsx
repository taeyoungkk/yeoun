import React, { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptFriendRequestApi, declineFriendRequestApi } from '@/src/api/friend';
import { Notification, useNotificationStore } from '@/src/store/notification.store';
import { useUIStore } from '@/src/store/ui.store';
import { ReceiptOcrButton } from '@/src/features/payment/components/ReceiptOcrButton';

export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const removeNotification = useNotificationStore((state) => state.removeNotification);
  const showToast = useUIStore((state) => state.showToast);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const handleFriendRequest = async (notification: Notification, action: 'accept' | 'decline') => {
    const friendshipId = notification.data?.friendshipId;
    if (!friendshipId) {
      return;
    }

    try {
      setLoading(true);
      const response = action === 'accept'
        ? await acceptFriendRequestApi(friendshipId)
        : await declineFriendRequestApi(friendshipId);

      if (response.success) {
        removeNotification(notification.id);
        showToast(action === 'accept' ? '친구 요청을 수락했습니다.' : '친구 요청을 거절했습니다.', action === 'accept' ? 'success' : 'info');
      }
    } catch (error) {
      console.error('[Notifications] Failed to handle friend request.', error);
      showToast('친구 요청 처리에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFriendAction = async (friendshipId: string, action: 'accept' | 'decline') => {
    try {
      setLoading(true);
      if (action === 'accept') {
        const res = await acceptFriendRequestApi(friendshipId);
        if (res.success) {
          showToast('친구 요청을 수락했습니다!', 'success');
          removeFriendRequest(friendshipId);
        }
      } else {
        const res = await declineFriendRequestApi(friendshipId);
        if (res.success) {
          showToast('친구 요청을 거절했습니다.', 'info');
          removeFriendRequest(friendshipId);
        }
      }
    } catch (error) {
      showToast('처리에 실패했습니다. 다시 시도해주세요.', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case 'INVITATION':
        return <MaterialIcons name="person-add" size={24} color="#3B82F6" />;
      case 'RECEIPT_REMINDER':
        return <MaterialIcons name="receipt-long" size={24} color="#10B981" />;
      case 'PAYMENT_REQUEST':
        return <MaterialIcons name="account-balance-wallet" size={24} color="#F59E0B" />;
      default:
        return <MaterialIcons name="notifications" size={24} color="#6B7280" />;
    }
  };

  const handleAction = (notification: Notification) => {
    switch (notification.type) {
      case 'INVITATION':
        if (notification.data?.inviteToken) {
          handleInviteAction(notification.id, notification.data.inviteToken, 'accept');
        }
        break;
      case 'RECEIPT_REMINDER':
        // 영수증 스캔 화면으로 이동
        router.push('/receipt-ocr');
        break;
      case 'PAYMENT_REQUEST':
        // 포인트/결제 화면으로 이동
        router.push('/cards' as any);
        break;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]">
      <View className="px-6 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-gray-900">알림</Text>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push('/notifications-mock' as any)}>
            <Text className="text-sm text-[#5F6B65]">목업 화면</Text>
          </TouchableOpacity>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text className="text-sm text-[#315B45] font-semibold">알림 모두 확인</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {notifications.length === 0 ? (
          <View className="flex-1 items-center justify-center pt-20">
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="notifications-none" size={32} color="#D1D5DB" />
            </View>
            <Text className="text-lg text-gray-400 font-medium text-center">새로운 알림이 없습니다.</Text>
          </View>
        ) : (
          notifications.map((item) => (
            <View
              key={item.id}
              className={`mb-4 p-4 rounded-3xl border border-gray-100 ${item.isRead ? 'bg-white' : 'bg-blue-50/40'}`}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-start mb-3">
                <View className="w-10 h-10 rounded-2xl bg-gray-50 items-center justify-center mr-3">
                  <MaterialIcons name="person-add" size={22} color="#2563EB" />
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-base font-bold text-gray-900">{item.title}</Text>
                    {!item.isRead ? <View className="w-2 h-2 rounded-full bg-[#2563EB]" /> : null}
                  </View>
                  <Text className="text-sm text-gray-600 mt-1 leading-5">{item.message}</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-xs text-gray-400">
                  {new Date(item.timestamp).toLocaleString([], {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>

                <View className="flex-row gap-2">
                  {!item.isRead ? (
                    <TouchableOpacity className="px-4 py-2 rounded-xl bg-gray-100" onPress={() => markAsRead(item.id)}>
                      <Text className="text-sm font-semibold text-gray-600">확인</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    className="px-4 py-2 rounded-xl bg-gray-100"
                    onPress={() => void handleFriendRequest(item, 'decline')}
                  >
                    <Text className="text-sm font-semibold text-gray-600">거절</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="px-6 py-2 rounded-xl bg-blue-500"
                    onPress={() => void handleFriendRequest(item, 'accept')}
                  >
                    <Text className="text-sm font-bold text-white">수락</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* OCR FAB */}
      <View className="absolute bottom-6 right-6 z-50">
        <ReceiptOcrButton />
      </View>
    </SafeAreaView>
  );
}
