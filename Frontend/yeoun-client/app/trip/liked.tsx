import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripCard, TripData } from '@/src/components/profile/TripCard';
import { useFavoriteStore, useTripStore } from '@/src/store';

export default function LikedTripsScreen() {
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const serverTrips = useTripStore((state) => state.trips);
  
  const favoriteTrips: TripData[] = serverTrips
    .filter(trip => favoriteIds.includes(trip.tripId))
    .map(trip => ({
      id: trip.tripId,
      title: trip.title,
      location: trip.region && trip.country ? `${trip.region}, ${trip.country}` : trip.region || trip.country || '대한민국',
      dates: `${trip.startDate.replace(/-/g, '.')} ~ ${trip.endDate.split('-').pop()}`,
      imageSource: require('@/assets/images/trip_placeholder_1.png'),
      isFavorite: true,
    }));

  const renderItem = ({ item }: { item: TripData }) => (
    <View className="w-[48%]">
        <TripCard 
            data={item} 
            onPress={() => {
              router.push({
                pathname: '/trip/report',
                params: { id: item.id },
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
        <Text className="text-lg font-bold text-[#1A1A1A]">좋아하는 여행</Text>
        <View className="w-9" />
      </View>

      <FlatList
        data={favoriteTrips}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 16 }}
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
