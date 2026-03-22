import React from 'react';
import { View, Text, FlatList, Pressable, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TripCard, TripData } from '@/src/components/profile/TripCard';
import { useFavoriteStore } from '@/src/store';

// Mock data sources
const MOCK_FAVORITE_TRIPS: TripData[] = [
  {
    id: '1',
    title: '제주 여행',
    location: '제주, 대한민국',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
    isFavorite: true,
  },
  {
    id: '2',
    title: '서울 여행',
    location: '서울, 대한민국',
    dates: '2024.02.03 ~ 02.06',
    imageSource: require('@/assets/images/trip_placeholder_2.png'),
    isFavorite: true,
  },
];

const MOCK_PAST_TRIPS: TripData[] = [
  {
    id: '3',
    title: '부산 여행',
    location: '부산, 대한민국',
    dates: '2023.08.12 ~ 08.15',
    imageSource: require('@/assets/images/trip_placeholder_3.png'),
  },
  {
    id: '4',
    title: '강릉 여행',
    location: '강릉, 대한민국',
    dates: '2022.07.01 ~ 07.03',
    imageSource: require('@/assets/images/trip_placeholder_1.png'),
  },
];

export default function LikedTripsScreen() {
  const { favoriteIds, toggleFavorite } = useFavoriteStore();
  
  const allMockTrips = [...MOCK_FAVORITE_TRIPS, ...MOCK_PAST_TRIPS];
  const favoriteTrips = allMockTrips
    .filter(trip => favoriteIds.includes(trip.id))
    .map(trip => ({ ...trip, isFavorite: true }));

  const renderItem = ({ item }: { item: TripData }) => (
    <View className="w-[48%]">
        <TripCard 
            data={item} 
            onPress={() => console.log('Trip pressed:', item.id)}
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
      />
    </SafeAreaView>
  );
}
