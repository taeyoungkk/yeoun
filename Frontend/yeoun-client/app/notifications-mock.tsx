import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_ITEMS = [
  {
    id: 'mock-trip',
    title: '여행 초대',
    message: '김태현님이 제주 봄바람 여행에 초대했습니다.',
    color: '#2E7D5A',
    icon: 'flight-takeoff' as const,
  },
  {
    id: 'mock-receipt',
    title: '영수증 인증 요청',
    message: '스타벅스 제주애월점 결제 내역의 영수증 등록이 필요합니다.',
    color: '#10B981',
    icon: 'receipt-long' as const,
  },
  {
    id: 'mock-payment',
    title: '정산 요청',
    message: '홍길동님이 공항 택시 비용 정산을 요청했습니다.',
    color: '#F59E0B',
    icon: 'account-balance-wallet' as const,
  },
];

export default function NotificationsMockScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]">
      <View className="px-6 pt-4 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-gray-900">목업 알림 화면</Text>
      </View>

      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {MOCK_ITEMS.map((item) => (
          <View
            key={item.id}
            className="mb-4 p-4 rounded-3xl border border-gray-100 bg-white"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.03,
              shadowRadius: 8,
              elevation: 2,
            }}
          >
            <View className="flex-row items-start">
              <View className="w-10 h-10 rounded-2xl bg-gray-50 items-center justify-center mr-3">
                <MaterialIcons name={item.icon} size={22} color={item.color} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{item.title}</Text>
                <Text className="text-sm text-gray-600 mt-1 leading-5">{item.message}</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
