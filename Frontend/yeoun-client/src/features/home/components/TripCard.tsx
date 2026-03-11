import { IconSymbol } from '@/src/components/ui/icon-symbol';
import { Image } from 'expo-image';
import React from 'react';
import { Text, View } from 'react-native';

interface TripCardProps {
    title: string;
    location: string;
    date: string;
    imageUrl?: any;
}

export const TripCard = ({ title, location, date, imageUrl }: TripCardProps) => {
    return (
        <View className="flex-row bg-[#DAE5DB] rounded-[32px] p-4 gap-4 items-center">
            <Image
                source={imageUrl || require('@/assets/images/base.png')}
                className="w-[115px] h-[134px] rounded-[24px]"
                contentFit="cover"
            />
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
