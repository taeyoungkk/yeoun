import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getTripsApi, TripListItem } from '@/src/api/trip';
import { useTripStore } from '@/src/store/trip.store';

import { CurrentTripCard } from './CurrentTripCard';
import { TripCard } from './TripCard';

interface PastTravelSectionProps {
  isTripActive?: boolean;
}

const MOCK_PAST_TRIPS: TripListItem[] = [
  {
    tripId: 'mock-1',
    title: '일본 여행',
    startDate: '2024.02.03',
    endDate: '2024.02.06',
    status: 'COMPLETED',
    memberCount: 2,
  },
  {
    tripId: 'mock-2',
    title: '제주 우정 여행',
    startDate: '2023.12.15',
    endDate: '2023.12.18',
    status: 'COMPLETED',
    memberCount: 4,
  },
];

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';

const formatRange = (start?: string, end?: string) => {
  if (!start || !end) {
    return '';
  }

  const normalize = (value: string) => value.replace(/-/g, '.').slice(0, 10);
  return `${normalize(start)} ~ ${normalize(end)}`;
};

export const PastTravelSection = ({ isTripActive = false }: PastTravelSectionProps) => {
  const router = useRouter();
  const activeTrip = useTripStore((state) => state.activeTrip);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const setReviewTrip = useTripStore((state) => state.setReviewTrip);

  const [pastTrips, setPastTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentTripCard = useMemo(() => {
    if (activeTrip) {
      const locationParts = [activeTrip.country, activeTrip.region].filter(Boolean);

      return {
        title: activeTrip.title,
        location: locationParts.length > 0 ? locationParts.join(', ') : activeTrip.title,
        date: `${activeTrip.startDate} ~ ${activeTrip.endDate}`,
        participants: activeTrip.memberCount || activeTrip.participants || 0,
        imageUrl: activeTrip.imageUrl,
        region: activeTrip.region || activeTrip.title,
      };
    }

    if (currentTrip) {
      return {
        title: currentTrip.tripName,
        location: `${currentTrip.origin}, ${currentTrip.destination}`,
        date: formatRange(currentTrip.startDate, currentTrip.endDate),
        participants: currentTrip.memberCount,
        imageUrl: undefined,
        region: currentTrip.destination || currentTrip.tripName,
      };
    }

    return null;
  }, [activeTrip, currentTrip]);

  useEffect(() => {
    const fetchPastTrips = async () => {
      try {
        const response = await getTripsApi();

        if (response.success && response.data.items.length > 0) {
          const currentId = activeTrip?.tripId ?? currentTrip?.tripId;
          setPastTrips(
            response.data.items
              .filter((item) => item.tripId !== currentId)
              .slice(0, 3),
          );
        } else if (API_MOCKS_ENABLED) {
          setPastTrips(MOCK_PAST_TRIPS);
        } else {
          setPastTrips([]);
        }
      } catch (error) {
        console.error('Failed to fetch past trips:', error);
        setPastTrips(API_MOCKS_ENABLED ? MOCK_PAST_TRIPS : []);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPastTrips();
  }, [activeTrip?.tripId, currentTrip?.tripId]);

  const handleTripPress = (trip: TripListItem) => {
    setReviewTrip({
      tripId: trip.tripId,
      tripName: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      memberCount: trip.memberCount,
      origin: '---',
      destination: trip.title,
    });
    router.push('/trip/report?mode=review');
  };

  return (
    <View className="w-full min-h-[600px] bg-[#EBF3EA] rounded-t-[200px] pt-20 px-6 items-center overflow-visible">
      <View className="items-center gap-4 mb-8">
        <View className="flex-row items-center gap-2">
          <Text className="text-black text-2xl font-pretendard-bold text-center">
            {isTripActive ? '지금 여행 중' : '지난 여행'}
          </Text>
          {isTripActive ? (
            <View className="flex-row items-center gap-1">
              <Text className="text-base text-[#DE7254] font-pretendard-semibold">기록중</Text>
              <View className="w-2 h-2 rounded-full bg-[#DE7254]" />
            </View>
          ) : null}
        </View>

        <Text className="text-[#101018] text-base font-pretendard-medium text-center px-4">
          {isTripActive
            ? `${currentTripCard?.region || '제주도'}에서의 여행을 즐기세요`
            : `지나온 여행의 순간을 다시 돌아보세요\n남겨둔 기록을 한눈에 확인할 수 있어요`}
        </Text>
      </View>

      {isTripActive && currentTripCard ? (
        <View className="w-full mb-10">
          <CurrentTripCard
            title={currentTripCard.title}
            location={currentTripCard.location}
            date={currentTripCard.date}
            participants={currentTripCard.participants}
            imageUrl={currentTripCard.imageUrl}
            onPress={() => router.push('/trip/recording')}
          />
        </View>
      ) : null}

      <View className="w-full mb-20">
        {isTripActive ? (
          <Text className="text-black text-xl font-pretendard-bold mb-4">지난 여행</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator size="large" color="#DE7254" />
        ) : pastTrips.length > 0 ? (
          <View className="gap-6">
            {pastTrips.map((trip) => (
              <TripCard
                key={trip.tripId}
                title={trip.title}
                location="대한민국"
                date={`${trip.startDate} ~ ${trip.endDate}`}
                imageUrl={trip.tripId.includes('mock') ? require('@/assets/images/trip_placeholder_2.png') : undefined}
                onPress={() => handleTripPress(trip)}
              />
            ))}
          </View>
        ) : !isTripActive ? (
          <Text className="text-[#828F9C] text-center mt-4 font-pretendard-medium">
            아직 지난 여행 기록이 없어요.
          </Text>
        ) : null}
      </View>
    </View>
  );
};
