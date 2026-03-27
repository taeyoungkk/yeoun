import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';

import { IconSymbol } from '@/src/components/ui/icon-symbol';

import { getTripImage } from '@/src/utils/image-utils';

interface CurrentTripCardProps {
  tripId: string;
  title: string;
  location: string;
  date: string;
  participants: number;
  imageUrl?: any;
  isFavorite?: boolean;
  showHeart?: boolean;
  onPressHeart?: () => void;
  onPress?: () => void;
}

export const CurrentTripCard = ({
  tripId,
  title,
  location,
  date,
  participants,
  imageUrl,
  isFavorite,
  showHeart = true,
  onPressHeart,
  onPress,
}: CurrentTripCardProps) => {
  return (
    <View className="w-full">
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        className="w-full h-[240px] rounded-[48px] overflow-hidden bg-white shadow-lg"
        style={{ elevation: 5 }}
      >
        <Image
          source={imageUrl || require('@/assets/images/trip_placeholder_1.png')}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
        />

        {showHeart && (
          <Pressable 
            onPress={onPressHeart} 
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/20 items-center justify-center"
          >
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={24} 
              color={isFavorite ? "#E74C3C" : "white"} 
            />
          </Pressable>
        )}

        <View className="absolute bottom-4 left-4 right-4 bg-white/85 rounded-[32px] p-5 gap-1.5">
          <Text className="text-xl font-pretendard-bold text-[#101018]">{title}</Text>

          <View className="flex-row items-center gap-1.5">
            <IconSymbol name="location.fill" size={12} color="#828F9C" />
            <Text className="text-[13px] text-[#828F9C] font-pretendard-medium">{location}</Text>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <IconSymbol name="calendar" size={12} color="#828F9C" />
              <Text className="text-[13px] text-[#828F9C] font-pretendard-medium">{date}</Text>
            </View>

            <View className="w-[1px] h-3 bg-[#D1D9E0]" />

            <View className="flex-row items-center gap-1.5">
              <IconSymbol name="person.2.fill" size={12} color="#828F9C" />
              <Text className="text-[13px] text-[#828F9C] font-pretendard-medium">{participants}명</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};
