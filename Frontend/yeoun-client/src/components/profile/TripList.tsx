import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripCard, TripData } from './TripCard';

interface Props {
  title: string;
  trips: TripData[];
  onViewMore?: () => void;
}

export function TripList({ title, trips, onViewMore }: Props) {
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
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {trips.map(trip => (
          <TripCard key={trip.id} data={trip} onPress={() => console.log('Trip pressed:', trip.id)} />
        ))}
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
  }
});
