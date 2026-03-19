import { IconSymbol } from '@/src/components/ui/icon-symbol';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TripCardProps {
    title: string;
    location: string;
    date: string;
    imageUrl?: any;
    isFavorite?: boolean;
    onPressHeart?: () => void;
}

export const TripCard = ({ title, location, date, imageUrl, isFavorite, onPressHeart }: TripCardProps) => {
    return (
        <View className="w-full flex-row bg-[#DAE5DB] rounded-[32px] p-4 gap-4 items-center">
            <View className="relative">
                <Image
                    source={imageUrl || require('@/assets/images/base.png')}
                    className="w-[115px] h-[134px] rounded-[24px]"
                    contentFit="cover"
                />
                <Pressable 
                    onPress={onPressHeart}
                    className="absolute top-2 right-2 bg-white/60 rounded-full p-1.5"
                >
                    <Ionicons 
                        name={isFavorite ? "heart" : "heart-outline"} 
                        size={18} 
                        color={isFavorite ? "#E74C3C" : "#828F9C"} 
                    />
                </Pressable>
            </View>
            <View className="flex-1 justify-center gap-2">
                <Text className="text-black text-sm font-pretendard-bold">{title}</Text>
                <View className="flex-row items-center gap-1">
                    <IconSymbol name="location.fill" size={10} color="#828F9C" />
                    <Text className="text-[#828F9C] text-[10px] font-pretendard-medium">{location}</Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <IconSymbol name="calendar" size={10} color="#828F9C" />
                    <Text className="text-[#828F9C] text-[10px] font-pretendard-medium">{date}</Text>
                </View>
            </View>
        </View>
    );
};
