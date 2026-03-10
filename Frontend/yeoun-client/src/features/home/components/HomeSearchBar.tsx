import { IconSymbol } from '@/src/components/ui/icon-symbol';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export const HomeSearchBar = () => {
    const router = useRouter();

    const handlePress = () => {
        router.push('/trip/start');
    };

    return (
        <View className="flex-row items-center bg-white rounded-[32px] px-6 py-4 shadow-sm mx-4 mt-6">
            <TouchableOpacity
                className="flex-row items-center flex-1 gap-2"
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <IconSymbol name="plus" size={16} color="#DE7254" />
                <Text className="text-[#828F9C] text-base font-pretendard-medium">여행 시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity
                className="bg-[#DE7254] w-10 h-10 rounded-full items-center justify-center"
                onPress={handlePress}
                activeOpacity={0.85}
            >
                <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
            </TouchableOpacity>
        </View>
    );
};
