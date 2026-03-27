import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { TripListItem } from '@/src/api/trip';
import { getTripImage, getTripPlaceholder } from '@/src/utils/image-utils';
import { useTripStore, useFavoriteStore } from '@/src/store';

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
    title: '제주 여행',
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

const toSortableDate = (value?: string) => new Date(value ?? '').getTime() || 0;

export const PastTravelSection = ({ isTripActive = false }: PastTravelSectionProps) => {
  const router = useRouter();
  const activeTrip = useTripStore((state) => state.activeTrip);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const trips = useTripStore((state) => state.trips);
  const fetchTrips = useTripStore((state) => state.fetchTrips);
  const setReviewTrip = useTripStore((state) => state.setReviewTrip);
  const { favoriteIds, toggleFavorite } = useFavoriteStore();

  const [isLoading, setIsLoading] = useState(true);
  const currentDisplayedTripId = isTripActive ? activeTrip?.tripId ?? currentTrip?.tripId ?? null : null;

  const handleOpenCurrentTrip = () => {
    if (!currentDisplayedTripId) {
      router.push('/trip/recording');
      return;
    }

    router.push({
      pathname: '/trip/recording',
      params: { tripId: currentDisplayedTripId },
    });
  };

  const currentTripListItem = useMemo(
    () => trips.find((item) => item.tripId === currentDisplayedTripId) ?? null,
    [currentDisplayedTripId, trips],
  );

  const currentTripCard = useMemo(() => {
    if (activeTrip) {
      const locationParts = [activeTrip.country, activeTrip.region].filter(Boolean);
      const participantCandidates = [
        currentTrip?.tripId === activeTrip.tripId ? currentTrip.memberCount : undefined,
        currentTripListItem?.memberCount,
        activeTrip.memberCount,
        activeTrip.participants,
      ].filter((value): value is number => typeof value === 'number' && value > 0);

      return {
        title: activeTrip.title,
        location: locationParts.length > 0 ? locationParts.join(', ') : activeTrip.title,
        date: `${activeTrip.startDate} ~ ${activeTrip.endDate}`,
        participants: participantCandidates.length > 0 ? Math.max(...participantCandidates) : 0,
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
  }, [activeTrip, currentTrip, currentTripListItem]);

  useEffect(() => {
    const loadPastTrips = async () => {
      setIsLoading(true);

      try {
        await fetchTrips();
      } catch (error) {
        console.error('Failed to fetch past trips:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPastTrips();
  }, [currentDisplayedTripId, fetchTrips]);

  const pastTrips = useMemo(() => {
    if (trips.length > 0) {
      return [...trips]
        .filter((item) => item.status === 'ENDED')
        .filter((item) => item.tripId !== currentDisplayedTripId)
        .sort((a, b) => {
          const endDiff = toSortableDate(b.endDate) - toSortableDate(a.endDate);
          if (endDiff !== 0) {
            return endDiff;
          }

          return toSortableDate(b.startDate) - toSortableDate(a.startDate);
        })
        .slice(0, 3);
    }

    return API_MOCKS_ENABLED ? MOCK_PAST_TRIPS : [];
  }, [currentDisplayedTripId, trips]);

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
              <Text className="text-base text-[#DE7254] font-pretendard-semibold">기록 중</Text>
              <View className="w-2 h-2 rounded-full bg-[#DE7254]" />
            </View>
          ) : null}
        </View>

        <Text className="text-[#101018] text-base font-pretendard-medium text-center px-4">
          {isTripActive
            ? `${currentTripCard?.region || '여행지'}에서의 여행을 즐기세요`
            : '지나온 여행의 시간을 다시 돌아보세요.\n아껴둔 기록들을 천천히 확인할 수 있어요.'}
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
            showHeart={false}
            isFavorite={!!currentDisplayedTripId && favoriteIds.includes(currentDisplayedTripId)}
            onPressHeart={() => currentDisplayedTripId && toggleFavorite(currentDisplayedTripId)}
            onPress={handleOpenCurrentTrip}
          />
        </View>
      ) : null}

      {!isTripActive ? (
        <View className="w-full mb-20">
          {isLoading ? (
            <ActivityIndicator size="large" color="#DE7254" />
          ) : pastTrips.length > 0 ? (
            <>
              <ScrollView
                showsVerticalScrollIndicator={false}
                className="w-full max-h-[460px]"
                contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 4 }}
              >
                {pastTrips.map((trip, index) => (
                  <View key={trip.tripId} style={{ marginBottom: index === pastTrips.length - 1 ? 0 : 16 }}>
                    <TripCard
                      title={trip.title}
                      location="여행지 정보"
                      date={`${trip.startDate} ~ ${trip.endDate}`}
                      imageUrl={getTripImage(trip.tripId, trip.imageUrl)}
                      showHeart={false}
                      isFavorite={favoriteIds.includes(trip.tripId)}
                      onPressHeart={() => toggleFavorite(trip.tripId)}
                      onPress={() => handleTripPress(trip)}
                    />
                  </View>
                ))}
              </ScrollView>

              <Pressable onPress={() => router.push('/trip/past')} className="items-center mt-5" hitSlop={10}>
                <Text className="text-sm text-[#6D7A68] font-pretendard-semibold">더보기</Text>
              </Pressable>
            </>
          ) : (
            <Text className="text-[#828F9C] text-center mt-4 font-pretendard-medium">
              아직 지난 여행 기록이 없어요.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
};
