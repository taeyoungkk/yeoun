import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TripRecordReadyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#EDF3EA]">
      <View className="flex-1 items-center justify-center px-7">
        <View className="w-[78px] h-[78px] rounded-[26px] bg-[#DDE8DA] items-center justify-center mb-5">
          <MaterialIcons name="explore" size={30} color="#3D5B49" />
        </View>

        <Text className="text-center font-[Pretendard-Bold] text-2xl leading-8 text-[#18211B]">
          여행 기록을 시작할 준비가 됐어요
        </Text>
        <Text className="mt-3 text-center font-[Pretendard-Regular] text-[15px] leading-6 text-[#6B766F]">
          이제 이 페이지를 실제 여행 기록 화면으로 바꾸면 됩니다. 현재는 다음 단계 연결을
          위한 자리입니다.
        </Text>

        <TouchableOpacity 
          className="mt-7 min-w-[180px] h-[52px] rounded-full bg-[#DCE6D9] items-center justify-center px-[22px]" 
          onPress={() => router.back()} 
          activeOpacity={0.88}
        >
          <Text className="font-[Pretendard-SemiBold] text-[15px] text-[#304136]">이전 화면으로</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
