import React from 'react';
import { View } from 'react-native';
import { useTripStore } from '@/src/store/trip.store';
import { CurrentLocationMap } from '@/src/components/map/CurrentLocationMap';
import { ActiveTripMap } from '@/src/components/map/ActiveTripMap';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function ExploreScreen() {
  // 전역 스토어에서 여행 활성화 여부를 가져옵니다.
  const isTripActive = useTripStore((state) => state.isTripActive);

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]" edges={['top']}>
      <StatusBar style="dark" />
      <View className="flex-1">
        {/* 여행 중이라면 ActiveTripMap, 아니라면 CurrentLocationMap을 보여줍니다. */}
        {isTripActive ? <ActiveTripMap /> : <CurrentLocationMap />}
      </View>
    </SafeAreaView>
  );
}
