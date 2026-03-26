import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '@/src/store';

export function ReceiptOcrButton() {
  const router = useRouter();
  const currentTripId = useTripStore((state) => state.currentTripId);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const activeTrip = useTripStore((state) => state.activeTrip);

  const handlePress = () => {
    const tripId = currentTripId ?? currentTrip?.tripId ?? activeTrip?.tripId ?? '';

    router.push({
      pathname: '/receipt-ocr',
      params: tripId ? { tripId } : {},
    } as never);
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.8}
      className="bg-[#244934] flex-row items-center justify-center py-3 px-5 rounded-full shadow-sm"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
      }}
    >
      <Ionicons name="camera" size={20} color="white" />
      <Text className="text-white font-bold text-base ml-2" style={{ fontFamily: 'Pretendard-Bold' }}>
        영수증 스캔
      </Text>
    </TouchableOpacity>
  );
}
