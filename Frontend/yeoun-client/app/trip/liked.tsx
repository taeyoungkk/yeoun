import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, SafeAreaView } from 'react-native';
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
    <View style={styles.cardWrapper}>
        <TripCard 
            data={item} 
            onPress={() => console.log('Trip pressed:', item.id)}
            onPressHeart={() => toggleFavorite(item.id)}
        />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>좋아하는 여행</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={favoriteTrips}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3F6EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  placeholder: {
    width: 36, // To balance the back button width
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardWrapper: {
    width: '48%', // Approx half with spacing
  }
});
