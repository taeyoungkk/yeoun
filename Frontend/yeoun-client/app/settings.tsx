import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { globalUserState, updateUser, subscribeUser } from '@/src/store/userStore';

const IosSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => {
  const [animValue] = useState(new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22]
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#5B68F6']
  });

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onValueChange(!value)}>
      <Animated.View
        style={{
          width: 51,
          height: 31,
          borderRadius: 16,
          backgroundColor,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: 27,
            height: 27,
            borderRadius: 13.5,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 2.5,
            elevation: 2,
            transform: [{ translateX }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState({ ...globalUserState });

  useEffect(() => {
    const unsubscribe = subscribeUser(() => {
      setSettings({ ...globalUserState });
    });
    return unsubscribe;
  }, []);

  const toggleSetting = (key: keyof typeof globalUserState, value: boolean) => {
    updateUser({ [key]: value });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F3F6EB]" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* 헤더 */}
      <View className="px-5 py-6 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-[#1A1A1A]">설정</Text>
      </View>

      <View className="px-5 mt-2">
        
        {/* 알림 */}
        <Text className="text-xl font-bold text-[#1A1A1A] mb-4">알림</Text>
        <View className="bg-white rounded-3xl p-5 mb-8">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-medium text-[#1A1A1A]">영수증 알림 받기</Text>
            <IosSwitch
              value={settings.receiptNotif}
              onValueChange={(val) => toggleSetting('receiptNotif', val)}
            />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-medium text-[#1A1A1A]">끝 알림 받기</Text>
            <IosSwitch
              value={settings.endNotif}
              onValueChange={(val) => toggleSetting('endNotif', val)}
            />
          </View>
        </View>

        {/* 권한 */}
        <Text className="text-xl font-bold text-[#1A1A1A] mb-4">권한</Text>
        <View className="bg-white rounded-[32px] p-5">
          <View className="flex-row justify-between items-center mb-6 px-1">
            <Text className="text-lg font-medium text-[#1A1A1A]">사진 권한</Text>
            <IosSwitch
              value={settings.photoPerm}
              onValueChange={(val) => toggleSetting('photoPerm', val)}
            />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center px-1">
            <Text className="text-lg font-medium text-[#1A1A1A]">위치 권한</Text>
            <IosSwitch
              value={settings.locationPerm}
              onValueChange={(val) => toggleSetting('locationPerm', val)}
            />
          </View>
        </View>

      </View>
    </SafeAreaView>
  );
}
