import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripCard, TripData } from '@/src/components/profile/TripCard';
import { useFavoriteStore } from '@/src/store';
import { getTripsApi, TripListItem } from '@/src/api/trip';

export default function PastTripsScreen() {
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  const [trips, setTrips] = useState<TripData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getTripsApi();
      if (response.success) {
        const pastTrips = response.data.items
          .filter(item => item.status === 'ENDED')
          .map(item => ({
            id: item.tripId,
            title: item.title,
            location: (item.region && item.country) ? `${item.region}, ${item.country}` : (item.region || item.country || '대한민국'),
            dates: `${item.startDate.replace(/-/g, '.')} ~ ${item.endDate.split('-').pop()}`,
            imageSource: require('@/assets/images/trip_placeholder_1.png'), // Placeholder
            isFavorite: favoriteIds.includes(item.tripId)
          }));
        setTrips(pastTrips);
      }
    } catch (error) {
      console.error('Failed to fetch past trips:', error);
    } finally {
      setIsLoading(false);
    }
  }, [favoriteIds]);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
    }, [fetchTrips])
  );

  const renderItem = ({ item }: { item: TripData }) => (
    <View className="w-[48%]">
        <TripCard 
            data={item} 
            onPress={() => {
                router.push({
                    pathname: '/trip/report',
                    params: { id: item.id }
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
        <Text className="text-lg font-bold text-[#1A1A1A]">다녀온 여행</Text>
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
              <Text className="text-base text-[#8A8A8A] font-medium">다녀온 여행이 없습니다.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
