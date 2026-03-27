import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTripPlaceholder } from '@/src/utils/image-utils';
import { TripCard, TripData } from './TripCard';

interface Props {
  title: string;
  trips: TripData[];
  onViewMore?: () => void;
  onToggleFavorite?: (id: string) => void;
}

export function TripList({ title, trips, onViewMore, onToggleFavorite }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onViewMore} style={styles.viewMoreBtn}>
          <Text style={styles.viewMoreText}>더보기</Text>
          <Ionicons name="arrow-forward" size={16} color="#D97A59" />
        </Pressable>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
      >
        {trips.slice(0, 3).map((trip, index) => {
          const isLastVisible = index === 2 && trips.length > 3;
          return (
            <TripCard 
              key={trip.id} 
              data={{
                ...trip,
                showMoreOverlay: isLastVisible,
                moreCount: isLastVisible ? trips.length - 3 : 0
              }} 
              onPress={() => {
                if (isLastVisible && onViewMore) {
                  onViewMore();
                } else {
                  console.log('Trip pressed:', trip.id);
                  // Optional: navigate to trip details here if available
                }
              }} 
              onPressHeart={() => onToggleFavorite?.(trip.id)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 15,
    color: '#D97A59',
    fontWeight: '600',
    marginRight: 4,
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 4, // Leaves 16 from last item's marginRight
    paddingBottom: 16, // Pushes scrollbar lower
  }
});
