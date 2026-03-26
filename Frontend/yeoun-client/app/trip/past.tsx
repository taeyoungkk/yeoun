import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TripCard, TripData } from '@/src/components/profile/TripCard';
import { useFavoriteStore, useTripStore } from '@/src/store';

const toSortableDate = (value?: string) => new Date(value ?? '').getTime() || 0;

export default function PastTripsScreen() {
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const serverTrips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.fetchTrips);
  const setReviewTrip = useTripStore((state) => state.setReviewTrip);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPastTrips = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = serverTrips.length > 0 ? serverTrips : await loadTrips();
      const pastTrips = [...items]
        .filter((item) => item.status === 'ENDED')
        .sort((a, b) => {
          const endDiff = toSortableDate(b.endDate) - toSortableDate(a.endDate);
          if (endDiff !== 0) {
            return endDiff;
          }

          return toSortableDate(b.startDate) - toSortableDate(a.startDate);
        })
        .map((item) => ({
          id: item.tripId,
          title: item.title,
          location: item.region && item.country ? `${item.region}, ${item.country}` : item.region || item.country || '여행지 정보 없음',
          dates: `${item.startDate.replace(/-/g, '.')} ~ ${item.endDate.split('-').pop()}`,
          imageSource: require('@/assets/images/trip_placeholder_1.png'),
          isFavorite: favoriteIds.includes(item.tripId),
        }));

      setTrips(pastTrips);
    } catch (error) {
      console.error('Failed to fetch past trips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [favoriteIds, loadTrips, serverTrips]);

  useFocusEffect(
    useCallback(() => {
      void fetchPastTrips();
    }, [fetchPastTrips]),
  );

  const renderItem = ({ item }: { item: TripData }) => (
    <View className="w-[48%]">
      <TripCard
        data={item}
        onPress={() => {
          const selectedTrip = serverTrips.find((trip) => trip.tripId === item.id);
          if (selectedTrip) {
            setReviewTrip({
              tripId: selectedTrip.tripId,
              tripName: selectedTrip.title,
              startDate: selectedTrip.startDate,
              endDate: selectedTrip.endDate,
              memberCount: selectedTrip.memberCount,
              origin: '---',
              destination: selectedTrip.title,
            });
          }

          router.push({
            pathname: '/trip/report',
            params: { mode: 'review', id: item.id },
          });
        }}
        onPressHeart={() => toggleFavorite(item.id)}
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#F3F6EB]">
      <View className="flex-row items-center justify-between px-4 py-3 bg-[#F3F6EB]">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </Pressable>
        <Text className="text-lg font-bold text-[#1A1A1A]">지난 여행</Text>
        <View className="w-9" />
      </View>

      <FlatList
        data={trips}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View className="flex-1 items-center justify-center pt-24">
              <Text className="text-base text-[#8A8A8A] font-medium">지난 여행이 없습니다.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
