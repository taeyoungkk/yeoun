import React from 'react';
import { Text, View } from 'react-native';
import { TripCard } from './TripCard';

export const PastTravelSection = () => {
    return (
        <View className="flex-1 bg-[#EBF3EA] rounded-t-[200px] pt-20 px-6 items-center">
            <View className="items-center gap-4 mb-8">
                <Text className="text-black text-xl font-pretendard-bold text-center">지난 여행</Text>
                <Text className="text-[#101018] text-base font-pretendard-medium text-center px-4">
                    지나온 여행의 순간을 다시 돌아보세요{'\n'}
                    남겨둔 기록을 한눈에 확인할 수 있어요
                </Text>
            </View>

            <View className="w-full">
                <TripCard
                    title="일본 여행"
                    location="일본, 후쿠오카"
                    date="2024.02.03 ~ 02.06"
                />
            </View>
        </View>
    );
};
