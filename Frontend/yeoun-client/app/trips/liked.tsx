import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTripStore } from '@/src/store';
import { TripCard, TripData } from '@/src/components/profile/TripCard';

export default function LikedTripsScreen() {
  const router = useRouter();
  const { pastTrips, likedTripIds, toggleFavorite } = useTripStore();
  
  // Map and filter liked trips
  const likedTripsData: TripData[] = pastTrips
    .filter(trip => likedTripIds.includes(trip.tripId))
    .map(trip => ({
      id: trip.tripId,
      title: trip.title,
      location: "대한민국",
      dates: `${trip.startDate} ~ ${trip.endDate.split('.').slice(-1)}`,
      imageSource: trip.tripId === 'mock-1' ? require('@/assets/images/trip_placeholder_1.png') : 
                  (trip.tripId === 'mock-2' ? require('@/assets/images/trip_placeholder_2.png') : 
                   require('@/assets/images/trip_placeholder_3.png')),
      isFavorite: true
    }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </Pressable>
        <Text style={styles.headerTitle}>좋아한 여행</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <FlatList
        data={likedTripsData}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <TripCard
            data={item}
            style={styles.gridCard}
            onPressHeart={() => toggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>좋아한 여행이 없습니다.</Text>
          </View>
        }
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: '48%', // Roughly half minus some gap
    aspectRatio: 170 / 240, // Maintain original aspect ratio
    height: undefined, // Let aspectRatio handle it
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#8A8A8A',
  }
});
