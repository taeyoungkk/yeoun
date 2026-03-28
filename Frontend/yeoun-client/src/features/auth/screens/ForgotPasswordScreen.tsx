import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { FormField } from "@/src/components/ui/form-field";
import { PasswordToggle } from "@/src/components/ui/password-toggle";
import { requestPasswordReset, confirmPasswordReset } from "@/src/api/auth";

interface ForgotPasswordForm {
  email: string;
  code: string;
  newPassword: string;
  passwordConfirm: string;
}

// Password requirement checkers
const hasLength = (pw: string) => pw.length >= 8 && pw.length <= 20;
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSpecial = (pw: string) =>
  /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(pw);

type ResetStep = "EMAIL" | "VERIFY" | "NEW_PASSWORD";
const RESEND_BLOCKED_MESSAGE = "인증코드는 60초마다 다시 요청할 수 있어요. 잠시 후 다시 시도해주세요.";

export const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ResetStep>("EMAIL");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [timer, setTimer] = useState(180); // 3 minutes
  const [isTimerActive, setIsTimerActive] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    defaultValues: {
      email: "",
      code: "",
      newPassword: "",
      passwordConfirm: "",
    },
    mode: "onChange",
  });

  const email = watch("email");
  const code = watch("code");
  const newPassword = watch("newPassword");
  const passwordConfirm = watch("passwordConfirm");

  const passwordsMatch =
    passwordConfirm.length > 0 && newPassword === passwordConfirm;

  // Timer effect
  useEffect(() => {
    let interval: any;
    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getResendBlockedMessage = (fallback: string, error?: any) => {
    const message = error?.response?.data?.message;
    const code = error?.response?.data?.code;

    if (code === "EMAIL_RESEND_BLOCKED" || message === "Verification code resend is not allowed yet.") {
      return RESEND_BLOCKED_MESSAGE;
    }

    return message || fallback;
  };

  const handleRequestReset = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const response = await requestPasswordReset(email);
      if (response.success) {
        setCurrentStep("VERIFY");
        setTimer(180);
        setIsTimerActive(true);
      } else {
        setErrorMsg(response.message || "비밀번호 재설정 요청에 실패했습니다.");
      }
    } catch (error: any) {
      setErrorMsg(getResendBlockedMessage("비밀번호 재설정 요청 중 오류가 발생했습니다.", error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = () => {
    if (code.length === 6) {
      setCurrentStep("NEW_PASSWORD");
      setIsTimerActive(false);
    }
  };

  const onSubmit = async (data: ForgotPasswordForm) => {
    if (!passwordsMatch) return;
    setIsLoading(true);
    setErrorMsg("");
    try {
      const response = await confirmPasswordReset({
        email: data.email,
        code: data.code,
        newPassword: data.newPassword,
      });
      if (response.success) {
        router.replace("/(auth)/login");
      } else {
        setErrorMsg(response.message || "비밀번호 재설정에 실패했습니다.");
      }
    } catch (error) {
      setErrorMsg("비밀번호 재설정 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setErrorMsg("");
    setValue("code", "");
    try {
      const response = await requestPasswordReset(email);
      if (response.success) {
        setTimer(180);
        setIsTimerActive(true);
        return;
      }

      setErrorMsg(response.message || "인증코드 재전송에 실패했습니다.");
    } catch (error: any) {
      setErrorMsg(getResendBlockedMessage("인증코드 재전송에 실패했습니다.", error));
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
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity 
            onPress={() => currentStep === "EMAIL" ? router.back() : setCurrentStep(prev => prev === "VERIFY" ? "EMAIL" : "VERIFY")}
            className="mb-8"
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>

          {/* Title */}
          <Text className="font-pretendard-bold text-[30px] leading-[39px] text-center text-secondary mb-10">
            {currentStep === "NEW_PASSWORD" ? "새 비밀번호 설정" : "비밀번호 찾기"}
          </Text>

          {currentStep === "EMAIL" && (
            <>
              <Text className="font-pretendard-semibold text-[14px] text-[#333333] mb-1.5">이메일</Text>
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
                    placeholder="가입하신 이메일을 입력해주세요"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                  />
                )}
              />
              {errorMsg ? <Text className="text-[#FF5252] text-[12px] mt-2">{errorMsg}</Text> : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-10 ${isLoading ? "bg-[#8FA3B8]" : ""}`}
                onPress={() => {
                  void handleRequestReset();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="font-pretendard-semibold text-[16px] text-white">다음</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {currentStep === "VERIFY" && (
            <>
              <Text className="font-pretendard text-[14px] text-[#8E8E8E] text-center mb-12">
                {email}으로 인증코드를 전송했습니다.
              </Text>

              <View className="flex-row items-center mb-1.5">
                <Text className="font-pretendard-semibold text-[14px] text-[#333333]">인증 코드 입력</Text>
                <Text className="font-pretendard text-[12px] text-[#CBCBCB] ml-2">• 남은 시간: {formatTime(timer)}</Text>
              </View>

              <View className="flex-row justify-between mv-5 relative">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    className="w-12 h-[60px] border border-gray-200 rounded-[4px] justify-center items-center bg-white"
                  >
                    <Text className="text-[24px] font-pretendard-semibold text-primary">{code[i] || ""}</Text>
                  </View>
                ))}
                <Controller
                  control={control}
                  name="code"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={(v) => {
                        const clean = v.replace(/[^0-9]/g, "");
                        if (clean.length <= 6) onChange(clean);
                      }}
                      keyboardType="number-pad"
                      className="absolute w-full h-full opacity-0"
                      autoFocus
                      caretHidden
                      autoComplete="one-time-code"
                    />
                  )}
                />
              </View>

              <View className="flex-row justify-start mt-2">
                <Text className="text-[12px] text-[#ABABAB]">이메일을 받지 못하셨나요? </Text>
                <TouchableOpacity
                  onPress={() => {
                    void handleResendCode();
                  }}
                >
                  <Text className="text-[12px] text-primary font-pretendard-bold underline">재전송</Text>
                </TouchableOpacity>
              </View>

              {errorMsg ? (
                <Text className="font-pretendard text-[12px] text-[#ABABAB] mt-2">
                  {errorMsg}
                </Text>
              ) : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-10 ${code.length !== 6 ? "bg-[#8FA3B8]" : ""}`}
                onPress={handleVerifyCode}
                disabled={code.length !== 6}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-pretendard-semibold text-[16px] text-white">다음</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </TouchableOpacity>
            </>
          )}

          {currentStep === "NEW_PASSWORD" && (
            <>
              <Text className="font-pretendard-semibold text-[14px] text-[#333333] mb-1.5">새 비밀번호</Text>
              <Controller
                control={control}
                name="newPassword"
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
                      error={errors.newPassword?.message}
                      rightElement={
                        <PasswordToggle
                          visible={showPassword}
                          onToggle={() => setShowPassword((v) => !v)}
                        />
                      }
                    />
                    <View className="flex-row flex-wrap -mt-2 mb-4 px-1">
                      <Requirement met={hasLength(value)} label="8-20자 사용" />
                      <Requirement met={hasNumber(value)} label="숫자 사용" />
                      <Requirement met={hasSpecial(value)} label="특수문자 사용" />
                    </View>
                  </>
                )}
              />

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
                    {passwordConfirm.length > 0 && (
                      <View className="flex-row -mt-2 mb-2 px-1">
                        <Text className={`text-[12px] ${passwordsMatch ? "text-primary" : "text-[#FF5252]"}`}>
                          {passwordsMatch ? "비밀번호가 일치합니다" : "비밀번호가 일치하지 않습니다"}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              />

              {errorMsg ? <Text className="text-[#FF5252] text-[12px] text-center mb-4">{errorMsg}</Text> : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-4 ${!passwordsMatch || isLoading ? "bg-[#8FA3B8]" : ""}`}
                onPress={handleSubmit(onSubmit)}
                disabled={!passwordsMatch || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-pretendard-semibold text-[16px] text-white">확인</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center mr-4">
      <View className={`w-1.5 h-1.5 rounded-full mr-1 ${met ? "bg-primary" : "bg-gray-300"}`} />
      <Text className={`font-pretendard text-[12px] ${met ? "text-primary" : "text-gray-300"}`}>{label}</Text>
    </View>
  );
}
