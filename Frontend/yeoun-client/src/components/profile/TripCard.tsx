import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMainDestination } from '@/src/hooks/useMainDestination';

export interface TripData {
  id: string;
  title: string;
  location: string;
  dates: string;
  imageSource: any;
  isFavorite?: boolean;
  showMoreOverlay?: boolean;
  moreCount?: number;
}

interface Props {
  data: TripData;
  onPress?: () => void;
  onPressHeart?: () => void;
}

export function TripCard({ data, onPress, onPressHeart }: Props) {
  const analyzedLocation = useMainDestination(data.id, data.location);
  const location = data.id.startsWith('mock-') ? data.location : analyzedLocation;
  const imageSource =
    typeof data.imageSource === 'string' ? { uri: data.imageSource } : data.imageSource;

  return (
    <Pressable onPress={onPress}>
      <ImageBackground
        source={imageSource}
        style={styles.card}
        imageStyle={styles.image}
      >
        <View style={styles.heartContainer}>
          <Pressable onPress={onPressHeart}>
            <Ionicons 
              name={data.isFavorite ? "heart" : "heart-outline"} 
              size={22} 
              color={data.isFavorite ? "#E74C3C" : "rgba(255,255,255,0.9)"} 
            />
          </Pressable>
        </View>
        
        <View style={styles.infoOverlay}>
          <Text style={styles.title} numberOfLines={1}>{data.title}</Text>
          <View style={styles.row}>
            <Ionicons name="location" size={12} color="#8A8A8A" />
            <Text style={styles.rowText} numberOfLines={1}>{location}</Text>
          </View>
          <View style={styles.row}>
            <Ionicons name="calendar" size={12} color="#8A8A8A" />
            <Text style={styles.rowText}>{data.dates}</Text>
          </View>
        </View>

        {data.showMoreOverlay && (
          <View style={styles.moreOverlay}>
            {data.moreCount && data.moreCount > 0 ? (
              <Text style={styles.moreText}>+{data.moreCount}</Text>
            ) : (
              <Ionicons name="add" size={48} color="white" />
            )}
          </View>
        )}
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
    fontFamily: 'Pretendard-Bold',
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
    fontFamily: 'Pretendard-Medium',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: 'white',
    fontSize: 32,
    fontFamily: 'Pretendard-Bold',
  }
});
