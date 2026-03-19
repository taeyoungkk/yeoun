import React from 'react';
import { Text, View } from 'react-native';
import { TripCard } from './TripCard';
import { CurrentTripCard } from './CurrentTripCard';
import { useTripStore } from '@/src/store/trip.store';
import { useRouter } from 'expo-router';

interface PastTravelSectionProps {
    isTripActive?: boolean;
}

export const PastTravelSection = ({ isTripActive = false }: PastTravelSectionProps) => {
    const activeTrip = useTripStore((state) => state.activeTrip);
    const router = useRouter();

    const handlePressCurrentTrip = () => {
        router.push('/trip/recording');
    };

    return (
        <View className="w-full min-h-[500px] bg-[#EBF3EA] rounded-t-[200px] pt-20 px-6 items-center">
            <View className="items-center gap-4 mb-8">
                <View className="flex-row items-center gap-2">
                    <Text className="text-black text-2xl font-pretendard-bold text-center">
                        {isTripActive ? "지금 여행 중" : "지난 여행"}
                    </Text>
                    {isTripActive && (
                        <View className="flex-row items-center gap-1">
                            <Text className="text-base text-[#DE7254] font-pretendard-semibold">기록중</Text>
                            <View className="w-2 h-2 rounded-full bg-[#DE7254]" />
                        </View>
                    )}
                </View>
                
                <Text className="text-[#101018] text-base font-pretendard-medium text-center px-4">
                    {isTripActive 
                        ? `${activeTrip?.region || '제주도'}에서의 여행을 즐기세요` 
                        : `지나온 여행의 순간을 다시 돌아보세요\n남겨둔 기록을 한눈에 확인할 수 있어요`
                    }
                </Text>
            </View>

            {activeTrip && (
                <View className="w-full mb-10">
                    <CurrentTripCard
                        title={activeTrip.title}
                        location={`${activeTrip.country}, ${activeTrip.region}`}
                        date={`${activeTrip.startDate} ~ ${activeTrip.endDate}`}
                        participants={activeTrip.participants}
                        imageUrl={activeTrip.imageUrl}
                        onPress={handlePressCurrentTrip}
                    />
                </View>
            )}

            <View className="w-full">
                <TripCard
                    title="일본 여행"
                    location="일본, 후쿠오카"
                    date="2024.02.03 ~ 02.06"
                    imageUrl={require('@/assets/images/trip_placeholder_2.png')}
                />
            </View>
        </View>
    );
};
