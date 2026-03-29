import { Ionicons } from "@expo/vector-icons";
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

import {
  confirmPasswordReset,
  requestPasswordReset,
  verifyPasswordResetCode,
} from "@/src/api/auth";
import { FormField } from "@/src/components/ui/form-field";
import { PasswordToggle } from "@/src/components/ui/password-toggle";

interface ForgotPasswordForm {
  email: string;
  code: string;
  newPassword: string;
  passwordConfirm: string;
}

const hasLength = (pw: string) => pw.length >= 8 && pw.length <= 20;
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSpecial = (pw: string) =>
  /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(pw);

type ResetStep = "EMAIL" | "VERIFY" | "NEW_PASSWORD";

const CODE_EXPIRE_SECONDS = 180;
const RESEND_COOLDOWN_SECONDS = 60;

const ERROR_MESSAGE_MAP: Record<string, string> = {
  EMAIL_RESEND_BLOCKED:
    "인증코드는 60초마다 다시 요청할 수 있어요. 잠시 후 다시 시도해주세요.",
  AUTH_ACCOUNT_NOT_FOUND: "가입된 계정을 찾을 수 없어요. 이메일을 다시 확인해주세요.",
  INVALID_EMAIL_FORMAT: "올바른 이메일 형식을 입력해주세요.",
  INVALID_EMAIL_CODE_FORMAT: "인증코드는 6자리 숫자로 입력해주세요.",
  EMAIL_CODE_MISMATCH: "인증코드가 올바르지 않습니다.",
  EMAIL_CODE_EXPIRED: "인증코드가 만료되었습니다. 다시 요청해주세요.",
  PASSWORD_LENGTH_INVALID: "비밀번호는 8자 이상 20자 이하로 입력해주세요.",
  PASSWORD_LETTER_REQUIRED: "비밀번호에 영문을 포함해주세요.",
  PASSWORD_NUMBER_REQUIRED: "비밀번호에 숫자를 포함해주세요.",
  PASSWORD_SPECIAL_REQUIRED: "비밀번호에 특수문자를 포함해주세요.",
  EMAIL_SEND_FAILED: "인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
  INTERNAL_SERVER_ERROR: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

const ERROR_MESSAGE_TEXT_MAP: Record<string, string> = {
  "Verification code resend is not allowed yet.":
    "인증코드는 60초마다 다시 요청할 수 있어요. 잠시 후 다시 시도해주세요.",
  "Verification code is incorrect.": "인증코드가 올바르지 않습니다.",
  "Verification code has expired.": "인증코드가 만료되었습니다. 다시 요청해주세요.",
  "Verification code format is invalid.":
    "인증코드는 6자리 숫자로 입력해주세요.",
  "Auth account not found.": "가입된 계정을 찾을 수 없어요. 이메일을 다시 확인해주세요.",
  "Email format is invalid.": "올바른 이메일 형식을 입력해주세요.",
  "Password must be between 8 and 20 characters.":
    "비밀번호는 8자 이상 20자 이하로 입력해주세요.",
  "Password must include at least one letter.":
    "비밀번호에 영문을 포함해주세요.",
  "Password must include at least one number.":
    "비밀번호에 숫자를 포함해주세요.",
  "Password must include at least one special character.":
    "비밀번호에 특수문자를 포함해주세요.",
  "Failed to send verification email.":
    "인증코드 발송에 실패했습니다. 잠시 후 다시 시도해주세요.",
  "Internal server error.":
    "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
};

export const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ResetStep>("EMAIL");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [timer, setTimer] = useState(CODE_EXPIRE_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isTimerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setIsTimerActive(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, timer]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getLocalizedErrorMessage = (fallback: string, payload?: any) => {
    const data = payload?.response?.data ?? payload;
    const codeValue = data?.code;
    const messageValue = data?.message;

    if (codeValue && ERROR_MESSAGE_MAP[codeValue]) {
      return ERROR_MESSAGE_MAP[codeValue];
    }

    if (messageValue && ERROR_MESSAGE_TEXT_MAP[messageValue]) {
      return ERROR_MESSAGE_TEXT_MAP[messageValue];
    }

    return fallback;
  };

  const handleRequestReset = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      const response = await requestPasswordReset(email);

      if (response.success) {
        setCurrentStep("VERIFY");
        setTimer(CODE_EXPIRE_SECONDS);
        setIsTimerActive(true);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setErrorMsg(
          getLocalizedErrorMessage(
            "비밀번호 재설정 요청에 실패했습니다.",
            response
          )
        );
      }
    } catch (error: any) {
      setErrorMsg(
        getLocalizedErrorMessage(
          "비밀번호 재설정 요청 중 오류가 발생했습니다.",
          error
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6 || isVerifyingCode) return;

    setIsVerifyingCode(true);
    setErrorMsg("");

    try {
      const response = await verifyPasswordResetCode(email, code);

      if (!response.success || !response.data?.verified) {
        setErrorMsg(
          getLocalizedErrorMessage("인증코드가 올바르지 않습니다.", response)
        );
        return;
      }

      setCurrentStep("NEW_PASSWORD");
      setIsTimerActive(false);
    } catch (error: any) {
      setErrorMsg(
        getLocalizedErrorMessage("인증코드가 올바르지 않습니다.", error)
      );
    } finally {
      setIsVerifyingCode(false);
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
        setErrorMsg(
          getLocalizedErrorMessage("비밀번호 재설정에 실패했습니다.", response)
        );
      }
    } catch (error: any) {
      setErrorMsg(
        getLocalizedErrorMessage(
          "비밀번호 재설정 중 오류가 발생했습니다.",
          error
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResendingCode) return;

    setIsResendingCode(true);
    setErrorMsg("");
    setValue("code", "");

    try {
      const response = await requestPasswordReset(email);

      if (response.success) {
        setTimer(CODE_EXPIRE_SECONDS);
        setIsTimerActive(true);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        return;
      }

      setErrorMsg(
        getLocalizedErrorMessage("인증코드 재전송에 실패했습니다.", response)
      );
    } catch (error: any) {
      setErrorMsg(
        getLocalizedErrorMessage("인증코드 재전송에 실패했습니다.", error)
      );

      if (
        error?.response?.data?.code === "EMAIL_RESEND_BLOCKED" ||
        error?.response?.data?.message ===
          "Verification code resend is not allowed yet."
      ) {
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setIsResendingCode(false);
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
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 60,
            paddingBottom: 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() =>
              currentStep === "EMAIL"
                ? router.back()
                : setCurrentStep((prev) =>
                    prev === "VERIFY" ? "EMAIL" : "VERIFY"
                  )
            }
            className="mb-8"
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>

          <Text className="font-pretendard-bold text-[30px] leading-[39px] text-center text-secondary mb-10">
            {currentStep === "NEW_PASSWORD"
              ? "새 비밀번호 설정"
              : "비밀번호 찾기"}
          </Text>

          {currentStep === "EMAIL" && (
            <>
              <Text className="font-pretendard-semibold text-[14px] text-[#333333] mb-1.5">
                이메일
              </Text>
              <Controller
                control={control}
                name="email"
                rules={{
                  required: "이메일을 입력해주세요.",
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: "올바른 이메일 형식을 입력해주세요.",
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    placeholder="가입한 이메일을 입력해주세요"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                  />
                )}
              />

              {errorMsg ? (
                <Text className="text-[#FF5252] text-[12px] mt-2">
                  {errorMsg}
                </Text>
              ) : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-10 ${
                  isLoading ? "bg-[#8FA3B8]" : ""
                }`}
                onPress={() => {
                  void handleRequestReset();
                }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="font-pretendard-semibold text-[16px] text-white">
                      다음
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {currentStep === "VERIFY" && (
            <>
              <Text className="font-pretendard text-[14px] text-[#8E8E8E] text-center mb-12">
                {email}로 인증코드를 발송했습니다.
              </Text>

              <View className="flex-row items-center mb-1.5">
                <Text className="font-pretendard-semibold text-[14px] text-[#333333]">
                  인증코드 입력
                </Text>
                <Text className="font-pretendard text-[12px] text-[#CBCBCB] ml-2">
                  유효시간 {formatTime(timer)}
                </Text>
              </View>

              <View className="flex-row justify-between my-5 relative">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    className={`w-12 h-[60px] border rounded-[4px] justify-center items-center bg-white ${
                      errorMsg ? "border-[#FF5252]" : "border-gray-200"
                    }`}
                  >
                    <Text className="text-[24px] font-pretendard-semibold text-primary">
                      {code[i] || ""}
                    </Text>
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
                        if (errorMsg) setErrorMsg("");
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
                <Text className="text-[12px] text-[#ABABAB]">
                  인증코드를 받지 못하셨나요?{" "}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    void handleResendCode();
                  }}
                  disabled={resendCooldown > 0 || isResendingCode}
                >
                  <Text className="text-[12px] text-primary font-pretendard-bold underline">
                    재전송
                  </Text>
                </TouchableOpacity>
              </View>

              <Text className="font-pretendard text-[12px] text-[#8E8E8E] mt-3">
                {isResendingCode
                  ? "인증코드를 다시 보내는 중이에요."
                  : resendCooldown > 0
                    ? `인증코드는 ${resendCooldown}초 후 다시 요청할 수 있어요.`
                    : "인증코드 재전송 요청이 가능해요."}
              </Text>

              {errorMsg ? (
                <Text className="font-pretendard text-[12px] text-[#FF5252] mt-4">
                  {errorMsg}
                </Text>
              ) : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-10 ${
                  code.length !== 6 || isVerifyingCode ? "bg-[#8FA3B8]" : ""
                }`}
                onPress={() => {
                  void handleVerifyCode();
                }}
                disabled={code.length !== 6 || isVerifyingCode}
              >
                {isVerifyingCode ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="font-pretendard-semibold text-[16px] text-white">
                      다음
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}

          {currentStep === "NEW_PASSWORD" && (
            <>
              <Text className="font-pretendard-semibold text-[14px] text-[#333333] mb-1.5">
                새 비밀번호
              </Text>
              <Controller
                control={control}
                name="newPassword"
                rules={{ required: "비밀번호를 입력해주세요." }}
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
                      <Requirement met={hasLength(value)} label="8~20자" />
                      <Requirement met={hasNumber(value)} label="숫자 포함" />
                      <Requirement
                        met={hasSpecial(value)}
                        label="특수문자 포함"
                      />
                    </View>
                  </>
                )}
              />

              <Controller
                control={control}
                name="passwordConfirm"
                rules={{ required: "비밀번호 확인을 입력해주세요." }}
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
                        <Text
                          className={`text-[12px] ${
                            passwordsMatch
                              ? "text-primary"
                              : "text-[#FF5252]"
                          }`}
                        >
                          {passwordsMatch
                            ? "비밀번호가 일치합니다."
                            : "비밀번호가 일치하지 않습니다."}
                        </Text>
                      </View>
                    )}
                  </>
                )}
              />

              {errorMsg ? (
                <Text className="text-[#FF5252] text-[12px] text-center mb-4">
                  {errorMsg}
                </Text>
              ) : null}

              <TouchableOpacity
                className={`bg-primary rounded-[15px] py-[18px] items-center mt-4 ${
                  !passwordsMatch || isLoading ? "bg-[#8FA3B8]" : ""
                }`}
                onPress={handleSubmit(onSubmit)}
                disabled={!passwordsMatch || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="font-pretendard-semibold text-[16px] text-white">
                    확인
                  </Text>
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
      <View
        className={`w-1.5 h-1.5 rounded-full mr-1 ${
          met ? "bg-primary" : "bg-gray-300"
        }`}
      />
      <Text
        className={`font-pretendard text-[12px] ${
          met ? "text-primary" : "text-gray-300"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
