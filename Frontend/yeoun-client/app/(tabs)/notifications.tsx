import { MaterialIcons } from '@expo/vector-icons';
import axios from 'axios';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { acceptFriendRequestApi, declineFriendRequestApi } from '@/src/api/friend';
import { acceptTripInviteByIdApi, declineTripInviteByIdApi } from '@/src/api/invite';
import { getTripDetailApi } from '@/src/api/trip';
import { Notification, useNotificationStore } from '@/src/store/notification.store';
import { useTripStore } from '@/src/store/trip.store';
import { useUIStore } from '@/src/store/ui.store';

const isFriendRequestNotification = (type: string) => type.includes('FRIEND_REQUEST');
const isTripInviteNotification = (type: string) => type.includes('TRIP_INVITE');

const getApiErrorCode = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  return error.response?.data?.code ?? null;
};

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
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);
  const notifications = useNotificationStore((state) => state.notifications);
  const archivedNotifications = useNotificationStore((state) => state.archivedNotifications);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const archiveNotification = useNotificationStore((state) => state.archiveNotification);
  const fetchTrips = useTripStore((state) => state.fetchTrips);
  const syncAcceptedTrip = useTripStore((state) => state.syncAcceptedTrip);
  const showToast = useUIStore((state) => state.showToast);
  const setLoading = useUIStore((state) => state.setLoading);

  const visibleNotifications = useMemo(
    () => (activeTab === 'active' ? notifications : archivedNotifications),
    [activeTab, archivedNotifications, notifications],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();

      return () => {
        const currentNotifications = useNotificationStore.getState().notifications;
        void Promise.all(
          currentNotifications
            .filter((notification) => !notification.isRead)
            .map((notification) => markAsRead(notification.id)),
        );
      };
    }, [fetchNotifications, markAsRead]),
  );

  const openNoticeModal = (title: string, message: string) => {
    setNoticeModal({ title, message });
  };

  const moveNotificationToHistory = async (notification: Notification) => {
    await markAsRead(notification.id);
    archiveNotification(notification, 'unavailable');
  };

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
        archiveNotification(notification, action);
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
        if (action === 'accept' && response.data.tripId) {
          const tripDetailResponse = await getTripDetailApi(response.data.tripId);
          if (tripDetailResponse.success) {
            syncAcceptedTrip(tripDetailResponse.data);
          }
          await fetchTrips(true);
        }

        await markAsRead(notification.id);
        archiveNotification(notification, action);
        showToast(action === 'accept' ? '여행 초대를 수락했습니다.' : '여행 초대를 거절했습니다.', action === 'accept' ? 'success' : 'info');

        if (action === 'accept' && response.data.tripId) {
          router.push('/(tabs)');
        }
      }
    } catch (error) {
      const errorCode = getApiErrorCode(error);

      if (errorCode === 'TRIP_NOT_FOUND') {
        await moveNotificationToHistory(notification);
        openNoticeModal('여행을 확인할 수 없어요', '이 여행은 이미 삭제되어 더 이상 참여할 수 없습니다.');
        return;
      }

      if (errorCode === 'TRIP_INVITE_ACCEPT_NOT_ALLOWED') {
        const tripId = notification.data?.tripId;

        if (tripId) {
          await fetchTrips(true);
          const tripDetailResponse = await getTripDetailApi(tripId);

          if (tripDetailResponse.success && tripDetailResponse.data.status === 'ENDED') {
            await moveNotificationToHistory(notification);
            openNoticeModal('여행이 종료되었어요', '이 여행은 이미 종료되었습니다. 지난 여행에서 기록을 확인해 주세요.');
            return;
          }
        }

        await moveNotificationToHistory(notification);
        openNoticeModal(
          action === 'accept' ? '수락할 수 없는 초대예요' : '거절할 수 없는 초대예요',
          '이 초대는 더 이상 유효하지 않거나 이미 처리되었습니다.',
        );
        return;
      }

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
      <View className="px-6 pt-4 pb-3 flex-row justify-between items-center">
        <View className="flex-row items-end gap-6">
          <Text className="text-2xl font-bold text-gray-900">알림함</Text>
          <View className="flex-row items-center gap-3 pb-0.5">
            <TouchableOpacity onPress={() => setActiveTab('active')}>
              <Text className={`text-base font-semibold ${activeTab === 'active' ? 'text-[#244934]' : 'text-[#9AA39D]'}`}>
                알림
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveTab('history')}>
              <Text className={`text-sm ${activeTab === 'history' ? 'text-[#5F6B65] font-semibold' : 'text-[#AEB5B1]'}`}>
                과거알림
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.push('/notifications-mock' as any)}>
            <Text className="text-sm text-[#5F6B65]">목업 화면</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {visibleNotifications.length === 0 ? (
          <View className="flex-1 items-center justify-center pt-20">
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="notifications-none" size={32} color="#D1D5DB" />
            </View>
            <Text className="text-lg text-gray-400 font-medium text-center">
              {activeTab === 'active' ? '새로운 알림이 없습니다.' : '보관된 알림이 없습니다.'}
            </Text>
          </View>
        ) : (
          visibleNotifications.map((item) => {
            const icon = getNotificationIcon(item.type);
            const hasDecisionAction =
              activeTab === 'active' && (isFriendRequestNotification(item.type) || isTripInviteNotification(item.type));
            const decisionLabel =
              item.decisionStatus === 'accept' ? '수락됨' : item.decisionStatus === 'decline' ? '거절됨' : item.decisionStatus === 'unavailable' ? '처리불가' : null;

            return (
              <View
                key={item.id}
                className="mb-4 p-4 rounded-3xl bg-white"
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
                    </View>
                    <Text className="text-sm text-gray-600 mt-1 leading-5">{item.message}</Text>
                  </View>
                </View>

                <View className="flex-row justify-between items-center mt-2">
                  <Text className="text-xs text-gray-400">
                    {new Date(item.decisionStatus ? item.decidedAt ?? item.timestamp : item.timestamp).toLocaleString([], {
                      month: 'numeric',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>

                  <View className="flex-row gap-2 items-center">
                    {decisionLabel ? (
                      <View
                        className="px-3 py-2 rounded-xl"
                        style={{ backgroundColor: item.decisionStatus === 'accept' ? '#E3F0E7' : item.decisionStatus === 'decline' ? '#ECEFF1' : '#F4EEE7' }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: item.decisionStatus === 'accept' ? '#315B45' : item.decisionStatus === 'decline' ? '#6B7280' : '#9A6B2F' }}
                        >
                          {decisionLabel}
                        </Text>
                      </View>
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

      <Modal visible={Boolean(noticeModal)} transparent animationType="fade" onRequestClose={() => setNoticeModal(null)}>
        <Pressable style={styles.noticeBackdrop} onPress={() => setNoticeModal(null)}>
          <Pressable style={styles.noticeCard} onPress={() => undefined}>
            <View style={styles.noticeIconWrap}>
              <MaterialIcons name="info-outline" size={26} color="#315B45" />
            </View>
            <Text style={styles.noticeTitle}>{noticeModal?.title}</Text>
            <Text style={styles.noticeBody}>{noticeModal?.message}</Text>
            <TouchableOpacity style={styles.noticeButton} onPress={() => setNoticeModal(null)} activeOpacity={0.88}>
              <Text style={styles.noticeButtonText}>확인</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  noticeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(12, 18, 14, 0.42)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  noticeCard: {
    borderRadius: 30,
    backgroundColor: '#FCFEFB',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  noticeIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E7F1EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  noticeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#182119',
    textAlign: 'center',
  },
  noticeBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: '#5C6A61',
    textAlign: 'center',
  },
  noticeButton: {
    width: '100%',
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: '#2F5A44',
    paddingVertical: 14,
    alignItems: 'center',
  },
  noticeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
