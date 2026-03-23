import Mapbox from '@rnmapbox/maps';
import React from 'react';
import { View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface MarkerProps {
  id: string;
  coordinate: [number, number];
  isSelected?: boolean;
  onPress?: () => void;
}

export function PhotoMarker({ id, coordinate, isSelected, onPress }: MarkerProps) {
  return (
    <Mapbox.PointAnnotation id={id} coordinate={coordinate} onSelected={onPress}>
      <View 
        className={`w-7 h-7 rounded-full items-center justify-center bg-[#3787FF] border-2 border-white shadow-md`}
        style={isSelected ? { transform: [{ scale: 1.25 }] } : {}}
      >
        <MaterialIcons name="image" size={14} color="white" />
      </View>
    </Mapbox.PointAnnotation>
  );
}

export function PaymentMarker({ id, coordinate, isSelected, onPress }: MarkerProps) {
  return (
    <Mapbox.PointAnnotation id={id} coordinate={coordinate} onSelected={onPress}>
      <View 
        className={`w-7 h-7 rounded-full items-center justify-center bg-[#F0B132] border-2 border-white shadow-md`}
        style={isSelected ? { transform: [{ scale: 1.25 }] } : {}}
      >
        <MaterialIcons name="payment" size={14} color="white" />
      </View>
    </Mapbox.PointAnnotation>
  );
}

export function LocationMarker({ id, coordinate, isSelected, onPress }: MarkerProps) {
  return (
    <Mapbox.PointAnnotation id={id} coordinate={coordinate} onSelected={onPress}>
      <View 
        className={`w-7 h-7 rounded-full items-center justify-center bg-[#F35B4F] border-2 border-white shadow-md`}
        style={isSelected ? { transform: [{ scale: 1.25 }] } : {}}
      >
        <MaterialIcons name="place" size={14} color="white" />
      </View>
    </Mapbox.PointAnnotation>
  );
}
