import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripDetail, TripListItem } from '@/src/api/trip';
import { getTripImage, getTripPlaceholder } from '@/src/utils/image-utils';
import { TripCard } from '@/src/features/home/components/TripCard';
import { useFavoriteStore, useTripStore } from '@/src/store';

export default function LikedTripsScreen() {
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const serverTrips = useTripStore((state) => state.trips);
  
  const favoriteTrips = serverTrips
    .filter(trip => favoriteIds.includes(trip.tripId));

  const formatRange = (start?: string, end?: string) => {
    if (!start || !end) return '';
    const normalize = (value: string) => value.replace(/-/g, '.').slice(0, 10);
    return `${normalize(start)} ~ ${normalize(end)}`;
  };

  const getTripLocation = (trip: any) => {
    const locationParts = [trip.region, trip.country].filter(Boolean);
    return locationParts.length > 0 ? locationParts.join(', ') : '대한민국';
  };

  const handleTripPress = (trip: any) => {
    router.push({
      pathname: '/trip/report',
      params: { id: trip.tripId, mode: 'review' },
    });
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <View style={{ marginBottom: 16 }}>
        <TripCard 
            title={item.title}
            location={getTripLocation(item)}
            date={formatRange(item.startDate, item.endDate)}
            imageUrl={getTripImage(item.tripId, item.imageUrl)}
            isFavorite={true}
            onPressHeart={() => toggleFavorite(item.tripId)}
            onPress={() => handleTripPress(item)}
        />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]">
      <View className="flex-row items-center justify-between px-4 py-3 bg-[#EBF3EA]">
        <Pressable onPress={() => router.back()} className="p-1">
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </Pressable>
        <Text className="text-lg font-bold text-[#1A1A1A]">좋아하는 여행</Text>
        <View className="w-9" />
      </View>

      <FlatList
        data={favoriteTrips}
        renderItem={renderItem}
        keyExtractor={(item) => item.tripId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-24">
            <Text className="text-base text-[#8A8A8A] font-medium">좋아하는 여행이 없습니다.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
