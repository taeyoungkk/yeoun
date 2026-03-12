import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { globalUserState, updateUser } from '@/src/store/userStore';
import { stringToColor } from '@/src/utils/colors';

export default function EditProfileScreen() {
  const [nickname, setNickname] = useState(globalUserState.nickname);
  const [email, setEmail] = useState(globalUserState.email);
  const [phone, setPhone] = useState(globalUserState.phone);
  const [password, setPassword] = useState('*********');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(globalUserState.avatarUrl);

  const pickImage = async () => {
    // 사진 라이브러리 접근 권한 요청
    let permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      alert("사진 접근 권한이 필요합니다.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    updateUser({ nickname, email, phone, avatarUrl });
    router.back();
  };

  const initial = nickname.charAt(0).toUpperCase() || '?';
  const bgColor = stringToColor(nickname); // 일관된 색상 로직 사용

  return (
    <SafeAreaView className="flex-1 bg-[#F3F6EB]" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <Stack.Screen options={{ headerShown: false }} />
          
          {/* 헤더 */}
          <View className="px-5 py-6 flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
              <Ionicons name="chevron-back" size={28} color="#000" />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-[#1A1A1A]">개인정보</Text>
          </View>

          <View className="px-5 flex-1 mt-2">
            {/* 프로필 사진 섹션 */}
            <View className="items-center mb-8">
              <View 
                style={{ backgroundColor: avatarUrl ? 'transparent' : bgColor }} 
                className="w-24 h-24 rounded-full items-center justify-center mb-4 overflow-hidden border border-[#E5E5E5]"
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} className="w-full h-full" contentFit="cover" />
                ) : (
                  <Text className="text-white text-4xl font-medium">{initial}</Text>
                )}
              </View>
              <TouchableOpacity onPress={pickImage}>
                <Text className="text-base text-[#1A1A1A] font-medium">프로필 사진 수정</Text>
              </TouchableOpacity>
            </View>

            {/* 폼 박스 */}
            <View className="bg-white rounded-[32px] px-6 py-8">
              <View className="mb-6">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">이메일</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  className="text-base text-[#A0A0A0] py-0"
                  placeholder="이메일을 입력하세요"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="mb-6">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">닉네임</Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  className="text-base text-[#A0A0A0] py-0"
                  placeholder="닉네임을 입력하세요"
                />
              </View>

              <View className="mb-6">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">휴대폰 번호</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  className="text-base text-[#A0A0A0] py-0"
                  placeholder="휴대폰 번호를 입력하세요"
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-2">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">비밀번호</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  className="text-base text-[#A0A0A0] py-0"
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* 하단 버튼 */}
          <View className="px-5 pb-8 pt-6">
            <TouchableOpacity 
              onPress={handleSave}
              className="w-full bg-[#414A66] rounded-full py-4 items-center justify-center"
            >
              <Text className="text-white text-lg font-bold">저장하기</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
