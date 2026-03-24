import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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

// Google login handles its own auth session via prompts

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

  // ─── Native Google Sign-In Setup ──────────────────────────────────────────
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      // For native sign-in, the SHA-1 registers the Android client automatically.
      // We ONLY need the Web Client ID here so Google can issue an ID token for our backend.
    });
  }, []);

  const handleNativeGoogleLogin = async () => {
    setIsLoading(true);
    setLoginError("");
    try {
      await GoogleSignin.hasPlayServices();
      const googleResponse = await GoogleSignin.signIn();
      
      let idToken = null;
      if (googleResponse.data?.idToken) {
        idToken = googleResponse.data.idToken;
      } else {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        setLoginError("구글 인증 토큰을 가져오지 못했습니다.");
        setIsLoading(false);
        return;
      }

      // ─── Call our Backend API ───
      const apiResponse = await googleAuthApi(idToken);
      console.log('[LoginScreen] Google Auth Response:', JSON.stringify(apiResponse, null, 2));

      if (apiResponse.success && apiResponse.data) {
        const data = apiResponse.data;
        
        // Handle both wrapped and flat token structures
        const accessToken = data.tokens?.accessToken || data.accessToken;
        const refreshToken = data.tokens?.refreshToken || data.refreshToken;

        if (!accessToken) {
          console.error('[LoginScreen] Missing accessToken in response:', data);
          setLoginError("서버 응답 형식이 올바르지 않습니다. (액세스 토큰 누락)");
          return;
        }

        setTokens(accessToken, refreshToken || "");
        
        // Extract basic info from either backend (best) or google (fallback)
        const userNickname = data.user?.nickname || googleResponse.data?.user.name || 'Google 사용자';
        const userEmail = data.user?.email || googleResponse.data?.user.email || '';
        const userPhoto = data.user?.profileImageUrl || googleResponse.data?.user.photo || null;

        setProfile({
          userId: data.user?.userId || googleResponse.data?.user.id || 'google-user',
          email: userEmail,
          nickname: userNickname,
          profileImageUrl: userPhoto,
          timezone: data.user?.timezone || 'Asia/Seoul',
          role: data.user?.role || 'USER',
          status: data.user?.status || 'ACTIVE',
        });

        router.replace("/(tabs)");
      } else {
        setLoginError(apiResponse.message || "구글 로그인에 실패했습니다.");
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
        console.log("User cancelled Google Login");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // operation (e.g. sign in) is in progress already
        console.log("Google Login is already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setLoginError("Google Play 서비스를 사용할 수 없습니다.");
      } else {
        setLoginError("구글 로그인 중 오류가 발생했습니다.");
        console.error("Google Login Error:", error);
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
      console.log('[LoginScreen] Email Login Response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        const resData = response.data;
        
        const accessToken = resData.tokens?.accessToken || resData.accessToken;
        const refreshToken = resData.tokens?.refreshToken || resData.refreshToken;

        if (!accessToken) {
          console.error('[LoginScreen] Missing tokens in email login response:', resData);
          setLoginError("서버 응답 형식이 올바르지 않습니다. (토큰 누락)");
          return;
        }

        setTokens(accessToken, refreshToken || "");
        
        const user = resData.user || {
          userId: 'user',
          email: data.email,
          nickname: '사용자',
        };

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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>로그인</Text>

          {__DEV__ && isForceMockLogin ? (
            <View style={styles.devBadge}>
              <Text style={styles.devBadgeText}>DEV MOCK LOGIN ON</Text>
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
            style={styles.forgotWrapper}
            onPress={() => router.push("/(auth)/forgot-password" as never)}
            accessibilityLabel="비밀번호 찾기"
          >
            <Text style={styles.forgotText}>비밀번호 찾기</Text>
          </TouchableOpacity>

          {/* Login Error message */}
          {loginError ? (
            <Text style={{ color: "#FF5252", fontSize: 13, textAlign: "center", marginBottom: 16 }}>
              {loginError}
            </Text>
          ) : null}

          {/* Sign in button */}
          <TouchableOpacity
            style={[styles.signInButton, isLoading && { backgroundColor: "#8FA3B8" }]}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
            accessibilityLabel="로그인 버튼"
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.signInText}>로그인</Text>
            )}
          </TouchableOpacity>

          {/* Dev-only Mock Login Button */}
          {__DEV__ && (
            <TouchableOpacity
              style={styles.mockLoginButton}
              onPress={handleMockLogin}
              accessibilityLabel="개발용 목업 로그인"
            >
              <Text style={styles.mockLoginText}>개발용 목업 로그인 (서버 패스)</Text>
            </TouchableOpacity>
          )}

          {/* Or with divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={[styles.googleButton, isLoading && { opacity: 0.5 }]}
            onPress={handleNativeGoogleLogin}
            disabled={isLoading}
            accessibilityLabel="구글 로그인"
          >
            <View style={styles.googleInner}>
              <Image
                source={require("@/assets/images/Google__G__logo.png")}
                style={styles.googleLogoImg}
                resizeMode="contain"
              />
              <Text style={styles.googleText}>Google</Text>
              {isLoading && <ActivityIndicator size="small" color="#344966" style={{ marginLeft: 8 }} />}
            </View>
          </TouchableOpacity>

          {/* Sign up link */}
          <TouchableOpacity
            style={styles.signUpWrapper}
            onPress={() => router.push("/(auth)/register" as never)}
            accessibilityLabel="회원가입 페이지로 이동"
          >
            <Text style={styles.signUpText}>
              계정이 없으신가요? <Text style={styles.signUpLink}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },

  // ── Title ─────────────────────────────────────────────────────────────────
  title: {
    fontFamily: "Poppins",
    fontWeight: "700",
    fontSize: 30,
    lineHeight: 39,
    textAlign: "center",
    letterSpacing: -0.01 * 30,
    color: "#4D3E3E",
    marginBottom: 48,
  },
  devBadge: {
    alignSelf: "center",
    backgroundColor: "#FFF4CC",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: -20,
    marginBottom: 24,
  },
  devBadgeText: {
    fontFamily: "Inter",
    fontWeight: "700",
    fontSize: 12,
    color: "#7A5C00",
    letterSpacing: 0.3,
  },

  // ── Forgot ────────────────────────────────────────────────────────────────
  forgotWrapper: {
    alignSelf: "flex-end",
    marginBottom: 28,
    marginTop: -8,
  },
  forgotText: {
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 12,
    color: "#CACACA",
  },

  // ── Sign in button ────────────────────────────────────────────────────────
  signInButton: {
    backgroundColor: "#344966",
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 36,
  },
  signInText: {
    fontFamily: "Poppins",
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 24,
    color: "#FFFFFF",
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#D8DADC",
  },
  dividerText: {
    fontFamily: "Inter",
    fontWeight: "400",
    fontSize: 14,
    color: "rgba(0,0,0,0.7)",
  },

  // ── Google button ─────────────────────────────────────────────────────────
  googleButton: {
    borderWidth: 1,
    borderColor: "#D8DADC",
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 45,
    alignItems: "center",
    marginBottom: 36,
    backgroundColor: "#FFFFFF",
  },
  googleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  googleLogoImg: {
    width: 20,
    height: 20,
  },
  googleText: {
    fontFamily: "Inter",
    fontWeight: "500",
    fontSize: 14,
    color: "#344966",
  },

  // ── Sign up ───────────────────────────────────────────────────────────────
  signUpWrapper: {
    alignItems: "center",
  },
  signUpText: {
    fontFamily: "Inter",
    fontWeight: "400",
    fontSize: 14,
    color: "rgba(0,0,0,0.7)",
  },
  signUpLink: {
    fontWeight: "700",
    color: "#344966",
  },
  mockLoginButton: {
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    borderRadius: 15,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 36,
  },
  mockLoginText: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 14,
    color: "#D32F2F",
  },
});
