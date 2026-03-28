import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, Text, TouchableOpacity, View, Alert, Linking } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { useAuthStore, useUserStore } from '@/src/store';
import { logoutApi } from '@/src/api/auth';
import { withdrawAccount } from '@/src/api/user';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { locationService } from '@/src/services/locationService';

const IosSwitch = ({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => {
  const [animValue] = useState(new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [animValue, value]);

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E5E5', '#5B68F6'],
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
  const insets = useSafeAreaInsets();
  const settings = useUserStore((state) => state.settings);
  const updateSettings = useUserStore((state) => state.updateSettings);

  const openSystemSettings = () => {
    Alert.alert(
      '권한 필요',
      '앱 설정에서 직접 권한을 변경해야 합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '설정으로 이동', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const handleLocationPermission = async (val: boolean) => {
    if (val) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        openSystemSettings();
        return;
      }
    }
    updateSettings({ locationPerm: val });
    void locationService.onPermissionChange(val);
  };

  const handlePhotoPermission = async (val: boolean) => {
    if (val) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        openSystemSettings();
        return;
      }
    }
    updateSettings({ photoPerm: val });
  };

  const setRouteOnlyMode = (enabled: boolean) => {
    if (enabled) {
      updateSettings({
        showPhotoPins: false,
        showPaymentPins: false,
      });
      return;
    }

    updateSettings({
      showPhotoPins: true,
      showPaymentPins: settings.showPaymentPins,
    });
  };

  const isRouteOnlyMode = !settings.showPhotoPins && !settings.showPaymentPins;

  const handleLogout = async () => {
    try {
      const hasPlayServices = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }).catch(() => false);
      if (hasPlayServices) {
        if (await GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
      }
      await logoutApi();
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      useAuthStore.getState().clearTokens();
      useUserStore.getState().clearProfile();
    }
  };

  const handleWithdraw = async () => {
    try {
      const response = await withdrawAccount();
      if (response.success) {
        const hasPlayServices = await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false }).catch(() => false);
        if (hasPlayServices) {
          if (await GoogleSignin.hasPreviousSignIn()) {
            await GoogleSignin.revokeAccess();
            await GoogleSignin.signOut();
          }
        }
        useAuthStore.getState().clearTokens();
        useUserStore.getState().clearProfile();
      }
    } catch (error) {
      console.log('Withdrawal error:', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]" edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-5 py-6 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-[#1A1A1A]">설정</Text>
      </View>

      <ScrollView 
        className="flex-1" 
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-xl font-bold text-[#1A1A1A] mb-4">알림</Text>
        <View className="bg-white rounded-3xl p-5 mb-8">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-medium text-[#1A1A1A]">영수증 알림 받기</Text>
            <IosSwitch
              value={settings.receiptNotif}
              onValueChange={(val) => updateSettings({ receiptNotif: val })}
            />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-medium text-[#1A1A1A]">여행 종료 알림 받기</Text>
            <IosSwitch
              value={settings.endNotif}
              onValueChange={(val) => updateSettings({ endNotif: val })}
            />
          </View>
        </View>

        <Text className="text-xl font-bold text-[#1A1A1A] mb-4">권한</Text>
        <View className="bg-white rounded-[32px] p-5 mb-8">
          <View className="flex-row justify-between items-center mb-6 px-1">
            <Text className="text-lg font-medium text-[#1A1A1A]">사진 권한</Text>
            <IosSwitch
              value={settings.photoPerm}
              onValueChange={handlePhotoPermission}
            />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center px-1">
            <Text className="text-lg font-medium text-[#1A1A1A]">위치 권한</Text>
            <IosSwitch
              value={settings.locationPerm}
              onValueChange={handleLocationPermission}
            />
          </View>
        </View>

        <Text className="text-xl font-bold text-[#1A1A1A] mb-4">지도 표시 항목</Text>
        <View className="bg-white rounded-[32px] p-5 mb-8">
          <View className="mb-5">
            <Text className="text-lg font-medium text-[#1A1A1A]">기록 전체 보기</Text>
            <Text className="text-sm text-[#7B867E] mt-1">
              지도 위 기록 마커를 모두 숨기고 이동 경로만 보여줘요.
            </Text>
          </View>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-medium text-[#1A1A1A]">동선만 표시</Text>
            <IosSwitch value={isRouteOnlyMode} onValueChange={setRouteOnlyMode} />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-medium text-[#1A1A1A]">사진 표시</Text>
            <IosSwitch
              value={settings.showPhotoPins}
              onValueChange={(val) => updateSettings({ showPhotoPins: val })}
            />
          </View>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-lg font-medium text-[#1A1A1A]">결제 표시</Text>
            <IosSwitch
              value={settings.showPaymentPins}
              onValueChange={(val) => updateSettings({ showPaymentPins: val })}
            />
          </View>
        </View>

        <Text className="text-xl font-bold text-[#1A1A1A] mb-4 mt-2">계정 관리</Text>
        <View className="bg-white rounded-[32px] p-5 mb-8">
          <TouchableOpacity 
            onPress={() => router.push('/edit-profile')}
            className="flex-row justify-between items-center mb-6 px-1"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-full bg-[#F3F6EB] items-center justify-center">
                <Ionicons name="person-outline" size={20} color="#1A1A1A" />
              </View>
              <Text className="text-lg font-medium text-[#1A1A1A]">개인정보 수정</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#C4C4C4" />
          </TouchableOpacity>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <TouchableOpacity 
            onPress={handleLogout}
            className="flex-row justify-between items-center mb-6 px-1"
          >
            <Text className="text-lg font-medium text-[#FF5252]">로그아웃</Text>
            <Ionicons name="log-out-outline" size={24} color="#FF5252" />
          </TouchableOpacity>
          <View className="w-full h-[1px] bg-[#F0F0F0] mb-6" />
          <TouchableOpacity 
            onPress={handleWithdraw}
            className="flex-row justify-between items-center px-1"
          >
            <Text className="text-lg font-medium text-[#1A1A1A]">회원 탈퇴</Text>
            <Ionicons name="trash-outline" size={24} color="#C4C4C4" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
