import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface TripData {
  id: string;
  title: string;
  location: string;
  dates: string;
  imageSource: any;
  isFavorite?: boolean;
}

interface Props {
  data: TripData;
  onPress?: () => void;
}

export function TripCard({ data, onPress }: Props) {
  return (
    <Pressable onPress={onPress}>
      <ImageBackground 
        source={data.imageSource} 
        style={styles.card}
        imageStyle={styles.image}
      >
        <View style={styles.heartContainer}>
          <Ionicons 
            name={data.isFavorite ? "heart" : "heart-outline"} 
            size={22} 
            color={data.isFavorite ? "#E74C3C" : "rgba(255,255,255,0.9)"} 
          />
        </View>
        
        <View style={styles.infoOverlay}>
          <Text style={styles.title}>{data.title}</Text>
          <View style={styles.row}>
            <Ionicons name="location" size={12} color="#8A8A8A" />
            <Text style={styles.rowText}>{data.location}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="calendar" size={12} color="#8A8A8A" />
            <Text style={styles.rowText}>{data.dates}</Text>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 240,
    marginRight: 16,
    justifyContent: 'space-between',
    // shadow for the card
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  image: {
    borderRadius: 24,
  },
  heartContainer: {
    alignItems: 'flex-end',
    padding: 16,
  },
  infoOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    margin: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowText: {
    fontSize: 11,
    color: '#8A8A8A',
    marginLeft: 4,
    fontWeight: '500',
  }
});
