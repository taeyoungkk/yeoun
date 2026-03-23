import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface MarkerProps {
  id: string;
  coordinate: [number, number];
  isSelected?: boolean;
  onPress?: () => void;
  photoUrls?: string[];
}

export function PhotoMarker({ id, coordinate, isSelected, onPress, photoUrls = [] }: MarkerProps) {
  const hasPhotos = photoUrls.length > 0;
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.2 : 1) }],
  }));

  if (!hasPhotos) {
    return (
      <Mapbox.MarkerView id={id} coordinate={coordinate}>
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <Animated.View 
            className="w-8 h-8 rounded-full items-center justify-center bg-[#3787FF] border-2 border-white shadow-md"
            style={animatedStyle}
          >
            <MaterialIcons name="image" size={16} color="white" />
          </Animated.View>
        </TouchableOpacity>
      </Mapbox.MarkerView>
    );
  }

  // Render Stack
  const displayedPhotos = photoUrls.slice(0, 3).reverse(); // Max 3 for stack effect

  return (
    <Mapbox.MarkerView id={id} coordinate={coordinate}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Animated.View style={[animatedStyle, { width: 44, height: 44 }]}>
          {displayedPhotos.map((url, index) => {
            const rotation = (displayedPhotos.length - 1 - index) * 5; 
            const offset = (displayedPhotos.length - 1 - index) * 2;

            return (
              <View
                key={`${id}-photo-${index}`}
                className="absolute w-full h-full rounded-xl overflow-hidden border-2 border-white shadow-sm bg-gray-200"
                style={{
                  transform: [
                    { rotate: `${rotation}deg` },
                    { translateX: offset },
                    { translateY: -offset }
                  ],
                  zIndex: index,
                }}
              >
                <Image 
                  source={{ uri: url }} 
                  style={{ width: '100%', height: '100%' }} 
                  contentFit="cover"
                  transition={200}
                />
              </View>
            );
          })}
        </Animated.View>
      </TouchableOpacity>
    </Mapbox.MarkerView>
  );
}

export function PaymentMarker({ id, coordinate, isSelected, onPress }: MarkerProps) {
  return (
    <Mapbox.MarkerView id={id} coordinate={coordinate}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View 
          className="w-7 h-7 rounded-full items-center justify-center bg-[#F0B132] border-2 border-white shadow-md"
          style={isSelected ? { transform: [{ scale: 1.25 }] } : {}}
        >
          <MaterialIcons name="payment" size={14} color="white" />
        </View>
      </TouchableOpacity>
    </Mapbox.MarkerView>
  );
}

export function LocationMarker({ id, coordinate, isSelected, onPress }: MarkerProps) {
  return (
    <Mapbox.MarkerView id={id} coordinate={coordinate}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <View 
          className="w-7 h-7 rounded-full items-center justify-center bg-[#F35B4F] border-2 border-white shadow-md"
          style={isSelected ? { transform: [{ scale: 1.25 }] } : {}}
        >
          <MaterialIcons name="place" size={14} color="white" />
        </View>
      </TouchableOpacity>
    </Mapbox.MarkerView>
  );
}
