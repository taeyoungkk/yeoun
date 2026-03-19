import React, { useEffect, useState } from 'react';
import { Text, View, ActivityIndicator } from 'react-native';
import { TripCard } from './TripCard';
import { CurrentTripCard } from './CurrentTripCard';
import { useTripStore } from '@/src/store/trip.store';
import { useRouter } from 'expo-router';
import { getTripsApi, TripListItem } from '@/src/api/trip';

interface PastTravelSectionProps {
    isTripActive?: boolean;
}

// Mock data for fallback when API fails or returns no items AND mocks are enabled
const MOCK_PAST_TRIPS: TripListItem[] = [
    {
        tripId: 'mock-1',
        title: '일본 여행',
        startDate: '2024.02.03',
        endDate: '2024.02.06',
        status: 'COMPLETED',
        memberCount: 2
    },
    {
        tripId: 'mock-2',
        title: '제주도 가족 여행',
        startDate: '2023.12.15',
        endDate: '2023.12.18',
        status: 'COMPLETED',
        memberCount: 4
    }
];

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

export const PastTravelSection = ({ isTripActive = false }: PastTravelSectionProps) => {
    const activeTrip = useTripStore((state) => state.activeTrip);
    const currentTrip = useTripStore((state) => state.currentTrip);
    const { pastTrips, setPastTrips, likedTripIds, toggleFavorite } = useTripStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(pastTrips.length === 0);

    const currentTripCard = React.useMemo(() => {
        if (activeTrip) {
            return {
                title: activeTrip.title,
                location: `${activeTrip.country}, ${activeTrip.region}`,
                date: `${activeTrip.startDate} ~ ${activeTrip.endDate}`,
                participants: activeTrip.participants,
                imageUrl: activeTrip.imageUrl,
                region: activeTrip.region,
            };
        }
        if (currentTrip) {
            return {
                title: currentTrip.title || "기록 중인 여행", 
                location: currentTrip.location || "위치 알 수 없음",
                date: currentTrip.date || "날짜 알 수 없음",
                participants: currentTrip.participants || 1,
                imageUrl: currentTrip.imageUrl || null,
                region: currentTrip.region || "지역 알 수 없음",
            };
        }
        return null;
    }, [activeTrip, currentTrip]);

    useEffect(() => {
        const fetchPastTrips = async () => {
            try {
                const response = await getTripsApi();
                if (response.success && response.data.items.length > 0) {
                    setPastTrips(response.data.items);
                } else if (API_MOCKS_ENABLED && pastTrips.length === 0) {
                    // Fallback to mock data ONLY if mocks are enabled and we don't have data yet
                    setPastTrips(MOCK_PAST_TRIPS);
                }
            } catch (error) {
                console.error('Failed to fetch past trips:', error);
                if (API_MOCKS_ENABLED && pastTrips.length === 0) {
                    setPastTrips(MOCK_PAST_TRIPS);
                }
            } finally {
                setIsLoading(false);
            }
        };

        if (pastTrips.length === 0) {
            fetchPastTrips();
        } else {
            setIsLoading(false);
        }
    }, [activeTrip?.tripId, currentTrip?.tripId, pastTrips.length, setPastTrips]);

    const displayTrips = pastTrips
        .filter((item: TripListItem) => item.tripId !== activeTrip?.tripId && item.tripId !== currentTrip?.tripId)
        .slice(0, 3);

    const handlePressCurrentTrip = () => {
        router.push('/trip/recording');
    };

    return (
        <View className="w-full min-h-[600px] bg-[#EBF3EA] rounded-t-[200px] pt-20 px-6 items-center overflow-visible">
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

            {currentTripCard && (
                <View className="w-full mb-10">
                    <CurrentTripCard
                        title={currentTripCard.title}
                        location={currentTripCard.location}
                        date={currentTripCard.date}
                        participants={currentTripCard.participants}
                        imageUrl={currentTripCard.imageUrl}
                        onPress={handlePressCurrentTrip}
                    />
                </View>
            )}

            <View className="w-full mb-20">
                {isTripActive && (
                    <Text className="text-black text-xl font-pretendard-bold mb-4">과거 여행</Text>
                )}
                
                {isLoading ? (
                    <ActivityIndicator size="large" color="#DE7254" />
                ) : displayTrips.length > 0 ? (
                    <View className="gap-6">
                        {displayTrips.map((trip) => (
                            <TripCard
                                key={trip.tripId}
                                title={trip.title}
                                location="대한민국"
                                date={`${trip.startDate} ~ ${trip.endDate}`}
                                photos={trip.tripId === 'mock-1' ? 
                                    [require('@/assets/images/trip_placeholder_1.png'), require('@/assets/images/trip_placeholder_2.png'), require('@/assets/images/trip_placeholder_3.png'), require('@/assets/images/base.png')] : 
                                    [require('@/assets/images/trip_placeholder_2.png'), require('@/assets/images/trip_placeholder_3.png'), require('@/assets/images/trip_placeholder_1.png')]}
                                onPress={() => router.push({ pathname: '/trip/report', params: { tripId: trip.tripId } })}
                            />
                        ))}
                    </View>
                ) : !isTripActive && (
                    <Text className="text-[#828F9C] text-center mt-4 font-pretendard-medium">
                        아직 여행이 없습니다.
                    </Text>
                )}
            </View>
        </View>
    );
};
