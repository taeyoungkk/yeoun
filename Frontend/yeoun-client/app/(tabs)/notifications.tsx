import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptFriendRequestApi, declineFriendRequestApi } from '@/src/api/friend';
import { acceptTripInviteByIdApi, declineTripInviteByIdApi } from '@/src/api/invite';
import { Notification, useNotificationStore } from '@/src/store/notification.store';
import { useUIStore } from '@/src/store/ui.store';

const isFriendRequestNotification = (type: string) => type.includes('FRIEND_REQUEST');
const isTripInviteNotification = (type: string) => type.includes('TRIP_INVITE');

const getNotificationIcon = (type: string) => {
  if (isTripInviteNotification(type)) {
    return { name: 'flight-takeoff' as const, color: '#2E7D5A' };
  }

  if (isFriendRequestNotification(type)) {
    return { name: 'person-add' as const, color: '#2563EB' };
  }

  return { name: 'notifications' as const, color: '#6B7280' };
};

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
    const friendshipId = notification.data?.friendshipId ?? notification.data?.resourceId;
    if (!friendshipId) {
      showToast('친구 요청 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response =
        action === 'accept'
          ? await acceptFriendRequestApi(friendshipId)
          : await declineFriendRequestApi(friendshipId);

      if (response.success) {
        await markAsRead(notification.id);
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

  const handleTripInvite = async (notification: Notification, action: 'accept' | 'decline') => {
    const tripInviteId = notification.data?.tripInviteId ?? notification.data?.resourceId;
    if (!tripInviteId) {
      showToast('여행 초대 정보를 찾을 수 없습니다.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response =
        action === 'accept'
          ? await acceptTripInviteByIdApi(tripInviteId)
          : await declineTripInviteByIdApi(tripInviteId);

      if (response.success) {
        await markAsRead(notification.id);
        removeNotification(notification.id);
        showToast(action === 'accept' ? '여행 초대를 수락했습니다.' : '여행 초대를 거절했습니다.', action === 'accept' ? 'success' : 'info');

        if (action === 'accept' && response.data.tripId) {
          router.push('/(tabs)');
        }
      }
    } catch (error) {
      console.error('[Notifications] Failed to handle trip invite.', error);
      showToast('여행 초대 처리에 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryAction = async (notification: Notification) => {
    if (isFriendRequestNotification(notification.type)) {
      await handleFriendRequest(notification, 'accept');
      return;
    }

    if (isTripInviteNotification(notification.type)) {
      await handleTripInvite(notification, 'accept');
      return;
    }

    await markAsRead(notification.id);
  };

  const handleSecondaryAction = async (notification: Notification) => {
    if (isFriendRequestNotification(notification.type)) {
      await handleFriendRequest(notification, 'decline');
      return;
    }

    if (isTripInviteNotification(notification.type)) {
      await handleTripInvite(notification, 'decline');
      return;
    }

    await markAsRead(notification.id);
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
            <TouchableOpacity onPress={() => void markAllAsRead()}>
              <Text className="text-sm text-[#315B45] font-semibold">모두 읽음</Text>
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
          notifications.map((item) => {
            const icon = getNotificationIcon(item.type);
            const hasDecisionAction = isFriendRequestNotification(item.type) || isTripInviteNotification(item.type);

            return (
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
                    <MaterialIcons name={icon.name} size={22} color={icon.color} />
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
                      <TouchableOpacity className="px-4 py-2 rounded-xl bg-gray-100" onPress={() => void markAsRead(item.id)}>
                        <Text className="text-sm font-semibold text-gray-600">읽음</Text>
                      </TouchableOpacity>
                    ) : null}

                    {hasDecisionAction ? (
                      <>
                        <TouchableOpacity
                          className="px-4 py-2 rounded-xl bg-gray-100"
                          onPress={() => void handleSecondaryAction(item)}
                        >
                          <Text className="text-sm font-semibold text-gray-600">거절</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="px-6 py-2 rounded-xl bg-blue-500"
                          onPress={() => void handlePrimaryAction(item)}
                        >
                          <Text className="text-sm font-bold text-white">수락</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
