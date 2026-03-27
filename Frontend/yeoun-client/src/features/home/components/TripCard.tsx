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
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <View 
                className="flex-row bg-white rounded-[32px] overflow-hidden"
                style={{
                  height: 120,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 10,
                  elevation: 5,
                  marginBottom: 8,
                }}
            >
                <Image
                    source={imageUrl || require('@/assets/images/base.png')}
                    style={{
                        width: 120,
                        height: '100%',
                    }}
                    contentFit="cover"
                />

                <View className="flex-1 justify-center px-6 py-3 ml-1" style={{ flexShrink: 1 }}>
                    <View className="flex-row justify-between items-start">
                        <Text className="flex-1 text-black text-lg font-pretendard-bold" numberOfLines={1}>{title}</Text>
                        <Pressable onPress={onPressHeart} className="ml-2">
                           <Ionicons 
                             name={isFavorite ? "heart" : "heart-outline"} 
                             size={24} 
                             color={isFavorite ? "#E74C3C" : "#828F9C"} 
                           />
                        </Pressable>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                        <Ionicons name="location" size={16} color="#828F9C" />
                        <Text className="text-[#828F9C] text-sm font-pretendard-medium" numberOfLines={1}>{location}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                        <Ionicons name="calendar-outline" size={16} color="#828F9C" />
                        <Text className="text-[#828F9C] text-sm font-pretendard-medium">{date}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};
