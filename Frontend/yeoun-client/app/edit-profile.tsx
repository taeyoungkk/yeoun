import React, { useEffect, useState } from 'react';
import { View, Text as RNText, TextInput as RNTextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useUserStore } from '@/src/store';
import { useAuthStore } from '@/src/store/auth.store';
import { updateMyInfo, updatePassword, uploadProfileImage, UpdateProfileRequest } from '@/src/api/user';
import { stringToColor } from '@/src/utils/colors';
import { getProfileImageUrl } from '@/src/utils/image-utils';

// Password requirement checkers
const hasLength = (pw: string) => pw.length >= 8 && pw.length <= 20;
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSpecial = (pw: string) =>
  /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(pw);

const getPretendardFont = (className?: string) => {
  if (!className) return 'Pretendard-Regular';
  if (className.includes('font-bold')) return 'Pretendard-Bold';
  if (className.includes('font-semibold')) return 'Pretendard-SemiBold';
  if (className.includes('font-medium')) return 'Pretendard-Medium';
  return 'Pretendard-Regular';
};

function Text({
  className,
  style,
  ...props
}: React.ComponentProps<typeof RNText> & { className?: string }) {
  return <RNText {...props} className={className} style={[{ fontFamily: getPretendardFont(className) }, style]} />;
}

function TextInput({
  className,
  style,
  ...props
}: React.ComponentProps<typeof RNTextInput> & { className?: string }) {
  return (
    <RNTextInput
      {...props}
      className={className}
      style={[{ fontFamily: getPretendardFont(className) }, style]}
    />
  );
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile } = useUserStore();
  const { setTokens } = useAuthStore();
  
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.profileImageUrl || null);
  
  // 비밀번호 관련 상태
  const INITIAL_PASSWORD = '*********';
  const [password, setPassword] = useState(INITIAL_PASSWORD);
  const [currentPassword, setCurrentPassword] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if profile updates (e.g. after save or background fetch)
  useEffect(() => {
    if (profile?.profileImageUrl) {
      setAvatarUrl(profile.profileImageUrl);
    }
  }, [profile?.profileImageUrl]);
  const pickImage = async () => {
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

  const handleSave = async () => {
    // 닉네임 유효성 검사
    if (nickname.length < 2 || nickname.length > 20) {
      alert('닉네임은 2~20자 사이여야 합니다.');
      return;
    }

    // 비밀번호가 변경되었는지 확인
    if (password !== INITIAL_PASSWORD) {
      // 비밀번호 유효성 검사
      if (!hasLength(password) || !hasNumber(password) || !hasSpecial(password)) {
        alert('비밀번호 형식이 올바르지 않습니다. (8-20자, 숫자, 특수문자 포함)');
        return;
      }
      setIsModalVisible(true);
    } else {
      await saveProfileInfo();
    }
  };

  const saveProfileInfo = async () => {
    setIsSaving(true);
    try {
      const isLocalUri = avatarUrl && (avatarUrl.startsWith('file://') || avatarUrl.startsWith('content://'));
      let finalNickname = profile?.nickname || '';
      let finalProfileImageUrl = profile?.profileImageUrl || null;

      // 1. Upload image if it's a new local file
      if (isLocalUri && avatarUrl) {
        const imgResponse = await uploadProfileImage(avatarUrl);
        if (imgResponse.success) {
          finalProfileImageUrl = imgResponse.data.profileImageUrl;
        }
      }

      // 2. Update nickname if it changed
      if (nickname !== profile?.nickname) {
        const infoResponse = await updateMyInfo({ nickname });
        if (infoResponse.success) {
          finalNickname = infoResponse.data.nickname;
        }
      }

      // Update global state
      updateProfile({
        nickname: finalNickname,
        profileImageUrl: finalProfileImageUrl,
      });
      
      if (password === INITIAL_PASSWORD) {
        router.back();
      }
    } catch (error: any) {
      console.error('Failed to update profile info:', error);
      const serverMsg = error?.response?.data?.message || error?.message;
      alert(`프로필 정보 수정에 실패했습니다: ${serverMsg}`);
    } finally {
      if (password === INITIAL_PASSWORD) {
        setIsSaving(false);
      }
    }
  };

  const handleConfirmSave = async () => {
    if (!currentPassword) {
      alert('현재 비밀번호를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. 프로필 정보 업데이트 (닉네임, 이미지)
      await saveProfileInfo();

      // 2. 비밀번호 업데이트
      const pwResponse = await updatePassword({
        currentPassword,
        newPassword: password,
      });

      if (pwResponse.success) {
        // 새 토큰 저장
        setTokens(pwResponse.data.accessToken, pwResponse.data.refreshToken);
        setIsModalVisible(false);
        alert('프로필과 비밀번호가 성공적으로 변경되었습니다.');
        router.back();
      } else {
        alert(pwResponse.message || '비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인해주세요.');
      }
    } catch (error) {
      console.error('Failed to update password:', error);
      alert('비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const initial = nickname.charAt(0).toUpperCase() || '?';
  const bgColor = stringToColor(nickname);

  return (
    <SafeAreaView className="flex-1 bg-[#EBF3EA]" edges={['top', 'left', 'right']}>
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
                style={{ 
                  backgroundColor: avatarUrl ? '#F0F0F0' : bgColor,
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#E5E5E5',
                  marginBottom: 16
                }}
              >
                {avatarUrl ? (
                  <Image 
                    key={avatarUrl}
                    source={{ uri: getProfileImageUrl(avatarUrl) as string }} 
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover" 
                  />
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
                  editable={false}
                  className="text-base text-[#A0A0A0] py-0"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="mb-6">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">닉네임</Text>
                <TextInput
                  value={nickname}
                  onChangeText={setNickname}
                  className="text-base text-[#1A1A1A] py-0"
                  placeholder="닉네임을 입력하세요"
                />
              </View>

              <View className="mb-2">
                <Text className="text-base font-bold text-[#1A1A1A] mb-2">새 비밀번호</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  className="text-base text-[#1A1A1A] py-0"
                  secureTextEntry
                  placeholder="공백 시 변경되지 않습니다"
                />
                
                {/* 비밀번호 요구사항 표시 (비밀번호가 초기값이 아닐 때만) */}
                {password !== INITIAL_PASSWORD && (
                  <View className="flex-row flex-wrap mt-3 px-1">
                    <Requirement met={hasLength(password)} label="8-20자 사용" />
                    <Requirement met={hasNumber(password)} label="숫자 사용" />
                    <Requirement met={hasSpecial(password)} label="특수문자 사용" />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 하단 버튼 */}
          <View className="px-5 pt-6" style={{ paddingBottom: insets.bottom + 32 }}>
            <TouchableOpacity 
              onPress={handleSave}
              disabled={isSaving}
              className={`w-full ${isSaving ? 'bg-[#9FB4A6]' : 'bg-[#315B45]'} rounded-full py-4 items-center justify-center`}
            >
              {isSaving && password === INITIAL_PASSWORD ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-bold">저장하기</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 비밀번호 확인 모달 */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View className="bg-white w-full rounded-[32px] p-8">
            <Text className="text-2xl font-bold text-[#1A1A1A] mb-4 text-center">비밀번호 변경 확인</Text>
            <Text className="text-base text-[#666] mb-8 text-center">
              비밀번호를 변경하시겠습니까?{"\n"}본인 확인을 위해 현재 비밀번호를 입력해주세요.
            </Text>

            <View className="bg-white rounded-2xl px-4 py-3 mb-8 border border-[#E5E5E5]">
              <TextInput
                secureTextEntry
                placeholder="현재 비밀번호"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                className="text-base text-[#1A1A1A]"
              />
            </View>

            <View className="flex-row gap-x-3">
              <TouchableOpacity 
                onPress={() => setIsModalVisible(false)}
                className="flex-1 bg-[#E5E5E5] rounded-full py-4 items-center"
              >
                <Text className="text-[#666] text-lg font-bold">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleConfirmSave}
                disabled={isSaving}
                className={`flex-1 ${isSaving ? 'bg-[#9FB4A6]' : 'bg-[#315B45]'} rounded-full py-4 items-center`}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white text-lg font-bold">확인</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Requirement bullet component ─────────────────────────────────────────────
function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center mr-4 mb-1">
      <View
        className={`w-1.5 h-1.5 rounded-full mr-1 ${
          met ? "bg-[#414A66]" : "bg-gray-300"
        }`}
      />
      <Text
        className={`text-[12px] ${
          met ? "text-[#414A66] font-medium" : "text-gray-400"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
