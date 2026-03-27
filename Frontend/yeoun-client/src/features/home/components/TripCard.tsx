import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/src/components/ui/icon-symbol';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View, TouchableOpacity, Pressable } from 'react-native';

interface TripCardProps {
    title: string;
    location: string;
    date: string;
    imageUrl?: any;
    isFavorite?: boolean;
    onPressHeart?: () => void;
    onPress?: () => void;
}

export const TripCard = ({ title, location, date, imageUrl, isFavorite, onPressHeart, onPress }: TripCardProps) => {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <View className="flex-row bg-[#DAE5DB] rounded-[32px] p-4 gap-4 items-center">
                <Image
                    source={imageUrl || require('@/assets/images/base.png')}
                    className="w-[115px] h-[134px] rounded-[24px]"
                    contentFit="cover"
                />
                <View className="flex-1 justify-center gap-2">
                    <View className="flex-row justify-between items-start">
                        <Text className="flex-1 text-black text-sm font-pretendard-bold" numberOfLines={1}>{title}</Text>
                        <Pressable onPress={onPressHeart} className="ml-2">
                           <Ionicons 
                             name={isFavorite ? "heart" : "heart-outline"} 
                             size={20} 
                             color={isFavorite ? "#E74C3C" : "#828F9C"} 
                           />
                        </Pressable>
                    </View>
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
        </TouchableOpacity>
    );
};
