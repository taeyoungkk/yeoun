import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
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

interface RegisterForm {
  email: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

// Password requirement checkers
const hasLength = (pw: string) => pw.length >= 8 && pw.length <= 20;
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSpecial = (pw: string) =>
  /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(pw);

// Nickname requirement checkers
const hasNicknameLength = (n: string) => n.length >= 2 && n.length <= 10;
const hasNicknameChars = (n: string) =>
  n.length > 0 && /^[가-힣a-zA-Z0-9]+$/.test(n);

type NicknameStatus = "idle" | "checking" | "available" | "taken";

export const RegisterScreen = () => {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>("idle");

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      email: "",
      nickname: "",
      password: "",
      passwordConfirm: "",
    },
    mode: "onChange",
  });

  const password = watch("password");
  const passwordConfirm = watch("passwordConfirm");
  const nickname = watch("nickname");

  const passwordsMatch =
    passwordConfirm.length > 0 && password === passwordConfirm;

  // Simulate duplicate nickname check (replace with real API call)
  const checkNickname = async () => {
    if (!nickname || nickname.length < 2) return;
    setNicknameStatus("checking");
    await new Promise((r) => setTimeout(r, 800)); // TODO: replace with real API
    // Mock: nicknames containing "test" are taken
    setNicknameStatus(
      nickname.toLowerCase().includes("test") ? "taken" : "available",
    );
  };

  const onSubmit = (data: RegisterForm) => {
    if (nicknameStatus !== "available") return;
    // TODO: connect to register API
    console.log("Register:", data);
    router.replace("/(auth)/login");
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
          <Text style={styles.title}>정보 입력</Text>

          {/* Email */}
          <Text style={styles.label}>이메일</Text>
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

          {/* Nickname */}
          <View style={styles.labelRow}>
            <Text style={styles.label}>닉네임</Text>
            <Text style={styles.labelHint}>
              {" "}
              * 한글, 영문, 숫자만 가능 (특수문자 금지), 2~10자
            </Text>
          </View>
          <Controller
            control={control}
            name="nickname"
            rules={{
              required: "닉네임을 입력해주세요",
              pattern: {
                value: /^[가-힣a-zA-Z0-9]{2,10}$/,
                message: "2~10자, 한글/영문/숫자만 가능합니다",
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <View style={styles.nicknameRow}>
                  <View style={styles.nicknameFlex}>
                    <FormField
                      placeholder="닉네임"
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={(v) => {
                        onChange(v);
                        setNicknameStatus("idle");
                      }}
                      value={value}
                      error={errors.nickname?.message}
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.checkBtn,
                      nicknameStatus === "checking" && styles.checkBtnDisabled,
                    ]}
                    onPress={checkNickname}
                    disabled={nicknameStatus === "checking"}
                  >
                    {nicknameStatus === "checking" ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.checkBtnText}>중복 확인</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {/* Nickname requirement dots */}
                <View style={styles.requirementsRow}>
                  <Requirement
                    met={hasNicknameLength(value)}
                    label="2~10자 사용"
                  />
                  <Requirement
                    met={hasNicknameChars(value)}
                    label="한글/영문/숫자만"
                  />
                </View>
                {/* Duplicate check status message */}
                {nicknameStatus === "available" && (
                  <Text
                    style={[
                      styles.nicknameStatus,
                      styles.nicknameAvailableInline,
                    ]}
                  >
                    사용가능한 닉네임입니다.
                  </Text>
                )}
                {nicknameStatus === "taken" && (
                  <Text
                    style={[styles.nicknameStatus, styles.nicknameTakenInline]}
                  >
                    이미 존재하는 닉네임입니다.
                  </Text>
                )}
              </>
            )}
          />

          {/* Password */}
          <Text style={styles.label}>비밀번호</Text>
          <Controller
            control={control}
            name="password"
            rules={{ required: "비밀번호를 입력해주세요" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <FormField
                  placeholder="비밀번호"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  rightElement={
                    <PasswordToggle
                      visible={showPassword}
                      onToggle={() => setShowPassword((v) => !v)}
                    />
                  }
                />
                {/* Password requirement indicators */}
                <View style={styles.requirementsRow}>
                  <Requirement met={hasLength(value)} label="8-20자 사용" />
                  <Requirement met={hasNumber(value)} label="숫자 사용" />
                  <Requirement met={hasSpecial(value)} label="특수문자 사용" />
                </View>
              </>
            )}
          />

          {/* Password Confirm */}
          <Controller
            control={control}
            name="passwordConfirm"
            rules={{ required: "비밀번호 확인을 입력해주세요" }}
            render={({ field: { onChange, onBlur, value } }) => (
              <>
                <FormField
                  placeholder="비밀번호 확인"
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  rightElement={
                    <PasswordToggle
                      visible={showConfirm}
                      onToggle={() => setShowConfirm((v) => !v)}
                    />
                  }
                />
                {/* Match indicator — shows one message only when user has typed something */}
                {passwordConfirm.length > 0 && (
                  <View style={styles.matchRow}>
                    <Requirement
                      met={passwordsMatch}
                      label={
                        passwordsMatch
                          ? "비밀번호가 일치합니다"
                          : "비밀번호가 일치하지 않습니다"
                      }
                    />
                  </View>
                )}
              </>
            )}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              nicknameStatus !== "available" && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit(onSubmit)}
            accessibilityLabel="회원가입 완료"
          >
            <Text style={styles.submitText}>완료</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ── Requirement bullet component ─────────────────────────────────────────────
function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={reqStyles.row}>
      <View
        style={[reqStyles.dot, met ? reqStyles.dotMet : reqStyles.dotUnmet]}
      />
      <Text
        style={[
          reqStyles.label,
          met ? reqStyles.labelMet : reqStyles.labelUnmet,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const reqStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  dotMet: {
    backgroundColor: "#344966",
  },
  dotUnmet: {
    backgroundColor: "#CBCBCB",
  },
  label: {
    fontFamily: "Poppins",
    fontSize: 12,
    fontWeight: "400",
  },
  labelMet: {
    color: "#344966",
  },
  labelUnmet: {
    color: "#CBCBCB",
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  title: {
    fontFamily: "Poppins",
    fontWeight: "700",
    fontSize: 30,
    lineHeight: 39,
    textAlign: "center",
    color: "#4D3E3E",
    marginBottom: 40,
  },

  // ── Labels ────────────────────────────────────────────────────────────────
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 14,
    color: "#333333",
    marginBottom: 6,
  },
  labelHint: {
    fontFamily: "Poppins",
    fontWeight: "400",
    fontSize: 10,
    color: "#ABABAB",
    marginBottom: 6,
  },

  // ── Nickname row ──────────────────────────────────────────────────────────
  nicknameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  nicknameFlex: {
    flex: 1,
  },
  nicknameStatus: {
    fontFamily: "Poppins",
    fontSize: 12,
    fontWeight: "500",
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  nicknameAvailableInline: {
    color: "#344966",
  },
  nicknameTakenInline: {
    color: "#E53935",
  },
  checkBtn: {
    backgroundColor: "#344966",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    minWidth: 72,
  },
  checkBtnDisabled: {
    backgroundColor: "#ABABAB",
  },
  checkBtnText: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Requirements / match ──────────────────────────────────────────────────
  requirementsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  matchRow: {
    flexDirection: "row",
    marginTop: -8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitButton: {
    backgroundColor: "#344966",
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: "#8FA3B8",
  },
  submitText: {
    fontFamily: "Poppins",
    fontWeight: "600",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
