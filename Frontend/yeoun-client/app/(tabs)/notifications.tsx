import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNotificationStore, Notification } from '@/src/store/notification.store';
import { acceptTripInviteApi, declineTripInviteApi } from '@/src/api/invite';
import { acceptFriendRequestApi, declineFriendRequestApi } from '@/src/api/friend';
import { useUIStore } from '@/src/store/ui.store';
import { ReceiptOcrButton } from '@/src/features/payment/components/ReceiptOcrButton';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, friendRequests, removeNotification, clearUnreadCount, fetchFriendRequests, removeFriendRequest } = useNotificationStore();
  const showToast = useUIStore((state) => state.showToast);
  const setLoading = useUIStore((state) => state.setLoading);

  useEffect(() => {
    // 알림 화면에 진입하면 받은 친구 요청을 불러오고 읽지 않은 알림 배지를 초기화합니다
    fetchFriendRequests();
    clearUnreadCount();
  }, [clearUnreadCount, fetchFriendRequests]);

  const handleInviteAction = async (id: string, token: string, action: 'accept' | 'decline') => {
    try {
      setLoading(true);
      if (action === 'accept') {
        const res = await acceptTripInviteApi(token);
        if (res.success) {
          showToast('여행 초대를 수락했습니다!', 'success');
          // 수락 후 해당 여행 상세 페이지로 이동하거나 알림 삭제
          removeNotification(id);
          router.push(`/explore` as any); // 또는 특정 여행 페이지
        }
      } else {
        const res = await declineTripInviteApi(token);
        if (res.success) {
          showToast('여행 초대를 거절했습니다.', 'info');
          removeNotification(id);
        }
      }
    } catch (error) {
      showToast('처리에 실패했습니다. 다시 시도해주세요.', 'error');
      console.error(error);
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#EBF3EA' }}>
      <View className="px-6 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-2xl font-bold text-gray-900">알림</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={() => notifications.forEach(n => removeNotification(n.id))}>
            <Text className="text-sm text-gray-400">모두 지우기</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView 
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {notifications.length === 0 && friendRequests.length === 0 ? (
          <View className="flex-1 items-center justify-center pt-20">
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
              <MaterialIcons name="notifications-none" size={32} color="#D1D5DB" />
            </View>
          <Text className="text-lg text-gray-400 font-medium text-center">
            새로운 알림이 없습니다.
          </Text>
        </View>
      ) : (
        <>
          {/* 받은 친구 요청 목록 렌더링 */}
          {friendRequests.map((req) => (
            <View 
              key={req.friendshipId} 
              className="mb-4 p-4 rounded-3xl border border-gray-100 bg-blue-50/30"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-start mb-3">
                <View className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center mr-3 overflow-hidden border border-gray-200">
                  {req.profileImageUrl ? (
                    <Image source={{ uri: req.profileImageUrl }} className="w-full h-full" contentFit="cover" />
                  ) : (
                    <MaterialIcons name="person" size={24} color="#3B82F6" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">새로운 친구 요청</Text>
                  <Text className="text-sm text-gray-600 mt-1 leading-5">
                    '<Text className="font-bold">{req.nickname}</Text>'님이 친구 요청을 보냈습니다.
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-end items-center mt-1 gap-2">
                <TouchableOpacity 
                  className="px-4 py-2 rounded-xl bg-gray-100"
                  onPress={() => handleFriendAction(req.friendshipId, 'decline')}
                >
                  <Text className="text-sm font-semibold text-gray-600">거절</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  className="px-6 py-2 rounded-xl bg-blue-500"
                  onPress={() => handleFriendAction(req.friendshipId, 'accept')}
                >
                  <Text className="text-sm font-bold text-white">수락</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {/* 일반 알림 내역 렌더링 */}
          {notifications.map((item) => (
            <View 
              key={item.id} 
              className={`mb-4 p-4 rounded-3xl border border-gray-100 bg-white ${!item.isRead ? 'bg-blue-50/30' : ''}`}
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
                  {renderNotificationIcon(item.type)}
                </View>
                <View className="flex-1">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-base font-bold text-gray-900">{item.title}</Text>
                    <TouchableOpacity onPress={() => removeNotification(item.id)}>
                      <MaterialIcons name="close" size={18} color="#D1D5DB" />
                    </TouchableOpacity>
                  </View>
                  <Text className="text-sm text-gray-600 mt-1 leading-5">
                    {item.message}
                  </Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center mt-2">
                <Text className="text-xs text-gray-400">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                
                <View className="flex-row gap-2">
                  {item.type === 'INVITATION' && (
                    <TouchableOpacity 
                      className="px-4 py-2 rounded-xl bg-gray-100"
                      onPress={() => item.data?.inviteToken && handleInviteAction(item.id, item.data.inviteToken, 'decline')}
                    >
                      <Text className="text-sm font-semibold text-gray-600">거절</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity 
                    className={`px-6 py-2 rounded-xl ${
                      item.type === 'INVITATION' ? 'bg-blue-500' : 
                      item.type === 'RECEIPT_REMINDER' ? 'bg-emerald-500' : 'bg-orange-400'
                    }`}
                    onPress={() => handleAction(item)}
                  >
                    <Text className="text-sm font-bold text-white">
                      {item.type === 'INVITATION' ? '수락' : 
                       item.type === 'RECEIPT_REMINDER' ? '사진 촬영' : '지금 정산'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </>
      )}
      </ScrollView>

      {/* OCR FAB */}
      <View className="absolute bottom-6 right-6 z-50">
        <ReceiptOcrButton />
      </View>
    </SafeAreaView>
  );
}
