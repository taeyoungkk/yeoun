import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TripListItem } from '@/src/api/trip';
import { TripCard } from '@/src/features/home/components/TripCard';
import { useTripStore } from '@/src/store';

const toSortableDate = (value?: string) => new Date(value ?? '').getTime() || 0;

const formatRange = (start?: string, end?: string) => {
  if (!start || !end) {
    return '';
  }

  const normalize = (value: string) => value.replace(/-/g, '.').slice(0, 10);
  return `${normalize(start)} ~ ${normalize(end)}`;
};

const getTripLocation = (trip: TripListItem) => {
  const locationParts = [trip.region, trip.country].filter(Boolean);
  return locationParts.length > 0 ? locationParts.join(', ') : '';
};

export default function PastTripsScreen() {
  const loadTrips = useTripStore((state) => state.fetchTrips);
  const setReviewTrip = useTripStore((state) => state.setReviewTrip);
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPastTrips = useCallback(async () => {
    setIsLoading(true);

    try {
      const items = await loadTrips(true);
      const pastTrips = [...items]
        .filter((item) => item.status === 'ENDED')
        .sort((a, b) => {
          const endDiff = toSortableDate(b.endDate) - toSortableDate(a.endDate);
          if (endDiff !== 0) {
            return endDiff;
          }

          return toSortableDate(b.startDate) - toSortableDate(a.startDate);
        });

      setTrips(pastTrips);
    } catch (error) {
      console.error('Failed to fetch past trips:', error);
      setTrips([]);
    } finally {
      setIsLoading(false);
    }
  }, [loadTrips]);

  useFocusEffect(
    useCallback(() => {
      void fetchPastTrips();
    }, [fetchPastTrips]),
  );

  const handleTripPress = (trip: TripListItem) => {
    setReviewTrip({
      tripId: trip.tripId,
      tripName: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      memberCount: trip.memberCount,
      origin: trip.country || '---',
      destination: trip.region || trip.title,
    });

    router.push('/trip/report?mode=review');
  };

  const renderItem = ({ item }: { item: TripListItem }) => (
    <View style={{ marginBottom: 16 }}>
      <TripCard
        title={item.title}
        location={getTripLocation(item)}
        date={formatRange(item.startDate, item.endDate)}
        onPress={() => handleTripPress(item)}
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

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#DE7254" />
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderItem}
          keyExtractor={(item) => item.tripId}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center pt-24">
              <Text className="text-base text-[#8A8A8A] font-medium">지난 여행이 없습니다.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
