import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as WebBrowser from "expo-web-browser";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FormField } from "@/src/components/ui/form-field";
import { PasswordToggle } from "@/src/components/ui/password-toggle";
import { loginApi, googleAuthApi, LoginRequest } from "@/src/api/auth";
import { useAuthStore } from "@/src/store/auth.store";
import { useUserStore } from "@/src/store";

WebBrowser.maybeCompleteAuthSession();

interface LoginForm {
  email: string;
  password: string;
}

export const LoginScreen = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const isForceMockLogin = process.env.EXPO_PUBLIC_FORCE_MOCK_LOGIN === "true";
  const setTokens = useAuthStore((state) => state.setTokens);
  const setProfile = useUserStore((state) => state.setProfile);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  // Google OAuth Hook
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true, // If you need a refresh token or server side access
    });
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError("");
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error("No idToken received from Google.");
      }

      const apiResponse = await googleAuthApi(idToken);
      if (apiResponse.success && apiResponse.data) {
        const { tokens, user } = apiResponse.data;
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        // Populate user store with basic info
        setProfile({
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
          profileImageUrl: null,
          timezone: 'Asia/Seoul',
          role: 'USER',
          status: 'ACTIVE',
        });

        router.replace("/(tabs)");
      } else {
        setLoginError(apiResponse.message || "구글 로그인에 실패했습니다.");
      }
    } catch (error: any) {
      setLoginError("구글 로그인 중 오류가 발생했습니다.");
      console.error("Google Login Error:", error.message);
      if (error.response?.data) {
        console.error("Backend Error Data:", JSON.stringify(error.response.data, null, 2));
      } else if (error.stack) {
        console.error(error.stack);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockLogin = () => {
    setTokens("mock-access-token", "mock-refresh-token");
    setProfile({
      userId: "mock-user-id",
      email: "test@example.com",
      nickname: "테스트유저",
      profileImageUrl: null,
      timezone: "Asia/Seoul",
      role: "USER",
      status: "ACTIVE",
    });
    router.replace("/(tabs)");
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError("");
    try {
      const response = await loginApi(data);
      if (response.success && response.data) {
        const { tokens, user } = response.data;
        setTokens(tokens.accessToken, tokens.refreshToken);
        
        // Populate user store with basic info
        setProfile({
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
          profileImageUrl: null,
          timezone: 'Asia/Seoul',
          role: 'USER',
          status: 'ACTIVE',
        });

        router.replace("/(tabs)");
      } else {
        setLoginError(response.message || "로그인에 실패했습니다.");
      }
    } catch (error: any) {
      setLoginError("이메일 또는 비밀번호가 올바르지 않습니다.");
      console.error("Login Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-4 pt-20 pb-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text className="font-pretendard-bold text-[30px] leading-[39px] text-center tracking-[-0.3px] text-secondary mb-12">로그인</Text>

          {__DEV__ && isForceMockLogin ? (
            <View className="self-center bg-[#FFF4CC] rounded-full px-3 py-1.5 -mt-5 mb-6">
              <Text className="font-pretendard-bold text-[12px] text-[#7A5C00] tracking-[0.3px]">DEV MOCK LOGIN ON</Text>
            </View>
          ) : null}

          {/* Email field */}
          <Controller
            control={control}
            name="email"
            rules={{
              required: "이메일을 입력해주세요",
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "올바른 이메일 형식이 아닙니다",
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <FormField
                placeholder="이메일"
                keyboardType="email-address"
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
              />
            )}
          />

          {/* Password field */}
          <Controller
            control={control}
            name="password"
            rules={{ required: "비밀번호를 입력해주세요" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <FormField
                placeholder="비밀번호"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
                rightElement={
                  <PasswordToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                }
              />
            )}
          />

          {/* Forgot password */}
          <TouchableOpacity
            className="self-end mb-7 -mt-2"
            onPress={() => router.push("/(auth)/forgot-password" as never)}
            accessibilityLabel="비밀번호 찾기"
          >
            <Text className="font-pretendard-medium text-[12px] text-gray-300">비밀번호 찾기</Text>
          </TouchableOpacity>

          {/* Login Error message */}
          {loginError ? (
            <Text style={{ color: "#FF5252", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
              {loginError}
            </Text>
          ) : null}

          {/* Sign in button */}
          <TouchableOpacity
            className={`rounded-[15px] py-[18px] items-center mb-9 ${isLoading ? 'bg-[#8FA3B8]' : 'bg-primary'}`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityLabel="로그인 버튼"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-pretendard-medium text-[16px] leading-[24px] text-white">로그인</Text>
            )}
          </TouchableOpacity>

          {/* Dev-only Mock Login Button */}
          {__DEV__ && (
            <TouchableOpacity
              className="bg-[#FFEBEE] border border-[#FFCDD2] rounded-[15px] py-3 items-center mb-9"
              onPress={handleMockLogin}
              accessibilityLabel="개발용 목업 로그인"
            >
              <Text className="font-pretendard-semibold text-[14px] text-[#D32F2F]">개발용 목업 로그인 (서버 패스)</Text>
            </TouchableOpacity>
          )}

          {/* Or with divider */}
          <View className="flex-row items-center mb-5 gap-3">
            <View className="flex-1 h-[1px] bg-gray-200" />
            <Text className="font-pretendard text-[14px] text-black/70">또는</Text>
            <View className="flex-1 h-[1px] bg-gray-200" />
          </View>

          {/* Google button */}
          <TouchableOpacity
            className={`border border-gray-200 rounded-[10px] py-[18px] px-[45px] items-center mb-9 bg-white ${isLoading ? 'opacity-50' : ''}`}
            onPress={handleGoogleLogin}
            disabled={isLoading}
            accessibilityLabel="구글 로그인"
          >
            <View className="flex-row flex items-center gap-3">
              <Image
                source={require("@/assets/images/Google__G__logo.png")}
                className="w-5 h-5"
                resizeMode="contain"
              />
              <Text className="font-pretendard-medium text-[14px] text-primary">Google</Text>
              {isLoading && <ActivityIndicator size="small" color="#344966" className="ml-2" />}
            </View>
          </TouchableOpacity>

          {/* Sign up link */}
          <TouchableOpacity
            className="items-center"
            onPress={() => router.push("/(auth)/register" as never)}
            accessibilityLabel="회원가입 페이지로 이동"
          >
            <Text className="font-pretendard text-[14px] text-black/70">
              계정이 없으신가요? <Text className="font-pretendard-bold text-primary">회원가입</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
