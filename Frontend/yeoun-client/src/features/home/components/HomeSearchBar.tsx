import { IconSymbol } from '@/src/components/ui/icon-symbol';
import { useTripStore } from '@/src/store/trip.store';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';

const TravelWaveIcon = () => {
    const bars = useRef([
        new Animated.Value(0.55),
        new Animated.Value(1),
        new Animated.Value(0.7),
    ]).current;

    useEffect(() => {
        const animations = bars.map((bar, index) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(index * 140),
                    Animated.timing(bar, {
                        toValue: 1,
                        duration: 380,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(bar, {
                        toValue: 0.45,
                        duration: 380,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
            ),
        );

        animations.forEach((animation) => animation.start());

        return () => {
            animations.forEach((animation) => animation.stop());
        };
    }, [bars]);

    return (
        <View className="flex-row items-end justify-center gap-[3px]">
            {bars.map((bar, index) => (
                <Animated.View
                    key={`travel-wave-${index}`}
                    style={{
                        width: 5,
                        height: 5,
                        borderRadius: 999,
                        backgroundColor: '#FFFFFF',
                        transform: [{ scale: bar }],
                        opacity: bar.interpolate({
                            inputRange: [0.45, 1],
                            outputRange: [0.72, 1],
                        }),
                    }}
                />
            ))}
        </View>
    );
};

export const HomeSearchBar = () => {
    const router = useRouter();
    const isTripActive = useTripStore((state) => state.isTripActive);
    const currentTripId = useTripStore((state) => state.currentTripId);
    const currentTrip = useTripStore((state) => state.currentTrip);
    const activeTrip = useTripStore((state) => state.activeTrip);

    const handlePress = () => {
        if (isTripActive) {
            const tripId = currentTripId ?? activeTrip?.tripId ?? currentTrip?.tripId;
            if (tripId) {
                router.push({
                    pathname: '/trip/recording',
                    params: { tripId },
                });
                return;
            }

            router.push('/trip/recording');
        } else {
            router.push('/trip/start?mode=create');
        }
    };

    return (
        <View className="flex-row items-center bg-white rounded-[32px] px-6 py-4 shadow-sm mx-4 mt-6">
            <TouchableOpacity
                className="flex-row items-center flex-1 gap-2"
                onPress={handlePress}
                activeOpacity={0.8}
            >
                <IconSymbol name="plus" size={16} color="#DE7254" />
                <Text className="text-[#828F9C] text-base font-pretendard-medium">
                    {isTripActive ? '현재 여행 기록 보기' : '여행 시작하기'}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                className="bg-[#DE7254] w-10 h-10 rounded-full items-center justify-center"
                onPress={handlePress}
                activeOpacity={0.85}
            >
                {isTripActive ? (
                    <TravelWaveIcon />
                ) : (
                    <IconSymbol name="play.fill" size={18} color="#FFFFFF" />
                )}
            </TouchableOpacity>
        </View>
    );
};
