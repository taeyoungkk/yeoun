import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { loginApi, LoginRequest } from "@/src/api/auth";
import { useAuthStore } from "@/src/store/auth.store";

interface LoginForm {
  email: string;
  password: string;
}

export const LoginScreen = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const setTokens = useAuthStore((state) => state.setTokens);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setLoginError("");
    try {
      const response = await loginApi(data);
      if (response.success && response.data) {
        const { tokens } = response.data;
        setTokens(tokens.accessToken, tokens.refreshToken);
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

          {/* Or with divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={styles.googleButton}
            accessibilityLabel="구글 로그인"
          >
            <View style={styles.googleInner}>
              <Image
                source={require("@/assets/images/Google__G__logo.png")}
                style={styles.googleLogoImg}
                resizeMode="contain"
              />
              <Text style={styles.googleText}>Google</Text>
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
});
