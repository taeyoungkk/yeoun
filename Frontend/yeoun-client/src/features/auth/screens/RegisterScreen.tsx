import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  checkEmailAvailability,
  checkNicknameAvailability,
  sendEmailCode,
  signupApi,
  verifyEmailCode,
} from '@/src/api/auth';
import { FormField } from '@/src/components/ui/form-field';
import { PasswordToggle } from '@/src/components/ui/password-toggle';
import { useAuthStore } from '@/src/store/auth.store';
import { useUserStore } from '@/src/store';

interface RegisterForm {
  email: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

const hasLength = (pw: string) => pw.length >= 8 && pw.length <= 20;
const hasNumber = (pw: string) => /\d/.test(pw);
const hasSpecial = (pw: string) => /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]\\;'/]/.test(pw);

const hasNicknameLength = (n: string) => n.length >= 2 && n.length <= 20;
const hasNicknameChars = (n: string) => n.length > 0 && /^[가-힣a-zA-Z0-9]+$/.test(n);

type NicknameStatus = 'idle' | 'checking' | 'available' | 'taken';
type RegisterStep = 'EMAIL' | 'VERIFY' | 'INFO';
type EmailStatus = 'idle' | 'checking' | 'available' | 'taken';

const CODE_EXPIRE_SECONDS = 180;
const RESEND_COOLDOWN_SECONDS = 60;
const RESEND_BLOCKED_MESSAGE = '인증코드는 60초마다 다시 요청할 수 있어요. 잠시 후 다시 시도해주세요.';

export const RegisterScreen = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<RegisterStep>('EMAIL');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [emailErrorMessage, setEmailErrorMessage] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [timer, setTimer] = useState(CODE_EXPIRE_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: {
      email: '',
      nickname: '',
      password: '',
      passwordConfirm: '',
    },
    mode: 'onChange',
  });

  const email = watch('email');
  const nickname = watch('nickname');
  const password = watch('password');
  const passwordConfirm = watch('passwordConfirm');
  const passwordsMatch = passwordConfirm.length > 0 && password === passwordConfirm;

  const setTokens = useAuthStore((state) => state.setTokens);
  const setProfile = useUserStore((state) => state.setProfile);

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
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResendErrorMessage = (fallback: string, error?: any) => {
    const message = error?.response?.data?.message;
    const code = error?.response?.data?.code;

    if (code === 'EMAIL_RESEND_BLOCKED' || message === 'Verification code resend is not allowed yet.') {
      return RESEND_BLOCKED_MESSAGE;
    }

    return message || fallback;
  };

  const checkEmail = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setEmailStatus('checking');
    setEmailErrorMessage('');

    try {
      const response = await checkEmailAvailability(email);

      if (!response.success) {
        setEmailStatus('idle');
        setEmailErrorMessage(response.message || '이메일 중복 확인에 실패했습니다.');
        return;
      }

      setEmailStatus(response.data.available ? 'available' : 'taken');
    } catch (error: any) {
      setEmailStatus('idle');
      setEmailErrorMessage(error?.response?.data?.message || '이메일 중복 확인에 실패했습니다.');
    }
  };

  const handleNextFromEmail = async () => {
    if (emailStatus !== 'available' || isSendingCode) return;

    setIsSendingCode(true);
    setEmailErrorMessage('');

    try {
      const response = await sendEmailCode(email);

      if (!response.success || !response.data?.sent) {
        setEmailErrorMessage(response.message || response.data?.message || '인증코드 발송에 실패했습니다.');
        return;
      }

      setCurrentStep('VERIFY');
      setVerificationCode('');
      setVerificationError('');
      setTimer(CODE_EXPIRE_SECONDS);
      setIsTimerActive(true);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      setEmailErrorMessage(error?.response?.data?.message || '인증코드 발송에 실패했습니다.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) return;

    setVerificationError('');

    try {
      const response = await verifyEmailCode(email, verificationCode);

      if (!response.success || !response.data?.verified) {
        setVerificationError(response.message || response.data?.message || '인증코드가 올바르지 않습니다.');
        return;
      }

      setCurrentStep('INFO');
      setIsTimerActive(false);
    } catch (error: any) {
      setVerificationError(error?.response?.data?.message || '인증코드가 올바르지 않습니다.');
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResendingCode) return;

    setIsResendingCode(true);
    setVerificationCode('');
    setVerificationError('');

    try {
      const response = await sendEmailCode(email);

      if (!response.success || !response.data?.sent) {
        setVerificationError(response.message || response.data?.message || '인증코드 재발송에 실패했습니다.');
        return;
      }

      setTimer(CODE_EXPIRE_SECONDS);
      setIsTimerActive(true);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error: any) {
      setVerificationError(error?.response?.data?.message || '인증코드 재발송에 실패했습니다.');
      if (
        error?.response?.data?.code === 'EMAIL_RESEND_BLOCKED' ||
        error?.response?.data?.message === 'Verification code resend is not allowed yet.'
      ) {
        setVerificationError(RESEND_BLOCKED_MESSAGE);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setIsResendingCode(false);
    }
  };

  const checkNickname = async () => {
    if (!nickname || nickname.length < 2) return;

    setNicknameStatus('checking');

    try {
      const response = await checkNicknameAvailability(nickname);

      if (!response.success) {
        setNicknameStatus('idle');
        return;
      }

      setNicknameStatus(response.data.available ? 'available' : 'taken');
    } catch {
      setNicknameStatus('idle');
    }
  };

  const onSubmit = async (data: RegisterForm) => {
    if (nicknameStatus !== 'available') return;

    setIsSubmitting(true);
    setRegisterError('');

    try {
      const response = await signupApi({
        email: data.email,
        password: data.password,
        nickname: data.nickname,
      });

      if (response.success && response.data) {
        const { tokens, user } = response.data;
        setTokens(tokens.accessToken, tokens.refreshToken);
        setProfile({
          userId: user.userId,
          email: user.email,
          nickname: user.nickname,
          profileImageUrl: null,
          timezone: 'Asia/Seoul',
          role: 'USER',
          status: 'ACTIVE',
        });
        router.replace('/(tabs)');
        return;
      }

      setRegisterError(response.message || '회원가입에 실패했습니다.');
    } catch {
      setRegisterError('회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
          <Text className="font-pretendard-bold text-[30px] leading-[39px] text-center text-secondary mb-10">
            {currentStep === 'VERIFY' ? '인증코드 입력' : '회원가입'}
          </Text>

          {currentStep === 'EMAIL' && (
            <>
              <View className="flex-row items-center mb-1.5">
                <Text className="font-pretendard-semibold text-[14px] text-[#333333]">이메일</Text>
                {emailStatus === 'available' && (
                  <View className="border border-primary rounded-full px-2.5 py-0.5 ml-2">
                    <Text className="text-[10px] color-primary font-pretendard-semibold">확인완료</Text>
                  </View>
                )}
              </View>

              <View className="flex-row items-start gap-2">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="email"
                    rules={{
                      required: '이메일을 입력해주세요.',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: '올바른 이메일 형식을 입력해주세요.',
                      },
                    }}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <FormField
                        placeholder="test@naver.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        onBlur={onBlur}
                        onChangeText={(v) => {
                          onChange(v);
                          setEmailStatus('idle');
                          setEmailErrorMessage('');
                        }}
                        value={value}
                        error={errors.email?.message}
                      />
                    )}
                  />
                </View>

                <TouchableOpacity
                  className={`rounded-[10px] px-3.5 py-3.5 items-center justify-center min-w-[78px] ${
                    emailStatus === 'checking' || emailStatus === 'available' ? 'bg-gray-300' : 'bg-primary'
                  }`}
                  onPress={checkEmail}
                  disabled={emailStatus === 'checking' || emailStatus === 'available'}
                >
                  {emailStatus === 'checking' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="font-pretendard-semibold text-[12px] text-white">
                      {emailStatus === 'available' ? '확인완료' : '중복확인'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <Text className="font-pretendard text-[11px] text-[#ABABAB] mt-2 mb-1">
                * 이메일 중복확인 후 다음 단계에서 인증코드를 발송합니다.
              </Text>

              {emailStatus === 'available' && (
                <Text className="font-pretendard text-[12px] text-primary mt-2">사용 가능한 이메일입니다.</Text>
              )}

              {emailStatus === 'taken' && (
                <Text className="font-pretendard text-[12px] text-[#FF5252] mt-2">이미 사용 중인 이메일입니다.</Text>
              )}

              {!!emailErrorMessage && (
                <Text className="font-pretendard text-[12px] text-[#FF5252] mt-2">{emailErrorMessage}</Text>
              )}

              <TouchableOpacity
                className={`rounded-[15px] py-[18px] items-center mt-10 ${
                  emailStatus !== 'available' || isSendingCode ? 'bg-[#8FA3B8]' : 'bg-primary'
                }`}
                onPress={handleNextFromEmail}
                disabled={emailStatus !== 'available' || isSendingCode}
              >
                {isSendingCode ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Text className="font-pretendard-semibold text-[16px] text-white">다음</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} className="mt-6 items-center">
                <Text className="font-pretendard text-[14px] text-[#ABABAB]">
                  이미 계정이 있으신가요? <Text className="text-primary font-pretendard-semibold">로그인</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {currentStep === 'VERIFY' && (
            <>
              <Text className="font-pretendard text-[14px] text-[#8E8E8E] text-center mb-12">
                {email}로 인증코드를 발송했습니다.
              </Text>

              <View className="flex-row items-center mb-1.5">
                <Text className="font-pretendard-semibold text-[14px] text-[#333333]">인증코드 입력</Text>
                <Text className="font-pretendard text-[12px] text-[#CBCBCB] ml-2">유효시간 {formatTime(timer)}</Text>
              </View>

              <View className="flex-row justify-between my-5 relative">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View
                    key={i}
                    className={`w-12 h-[60px] border rounded-[4px] justify-center items-center bg-white ${
                      verificationError ? 'border-[#FF5252]' : 'border-gray-200'
                    }`}
                  >
                    <Text className="text-[24px] font-pretendard-semibold text-primary">{verificationCode[i] || ''}</Text>
                  </View>
                ))}

                <TextInput
                  value={verificationCode}
                  onChangeText={(v) => {
                    const clean = v.replace(/[^0-9]/g, '');
                    if (clean.length <= 6) setVerificationCode(clean);
                    if (verificationError) setVerificationError('');
                  }}
                  keyboardType="number-pad"
                  className="absolute w-full h-full opacity-0"
                  autoFocus
                  caretHidden
                  autoComplete="one-time-code"
                />
              </View>

              <View className="flex-row justify-start mt-2">
                <Text className="text-[12px] text-[#ABABAB]">인증코드를 받지 못하셨나요? </Text>
                <TouchableOpacity onPress={handleResendCode} disabled={resendCooldown > 0 || isResendingCode}>
                  <Text className="text-[12px] text-primary font-pretendard-bold underline">재전송</Text>
                </TouchableOpacity>
              </View>

              <Text className="font-pretendard text-[12px] text-[#8E8E8E] mt-3">
                {isResendingCode
                  ? '인증코드를 다시 보내는 중이에요.'
                  : resendCooldown > 0
                    ? `인증코드는 ${resendCooldown}초 후 다시 요청할 수 있어요.`
                    : '인증코드 재전송 요청이 가능해요.'}
              </Text>

              {!!verificationError && (
                <Text className="font-pretendard text-[12px] text-[#FF5252] text-center mt-5">{verificationError}</Text>
              )}

              <TouchableOpacity
                className={`rounded-[15px] py-[18px] items-center mt-10 ${
                  verificationCode.length !== 6 ? 'bg-[#8FA3B8]' : 'bg-primary'
                }`}
                onPress={handleVerifyCode}
                disabled={verificationCode.length !== 6}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-pretendard-semibold text-[16px] text-white">다음</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                className="border border-primary rounded-[15px] py-[18px] items-center bg-transparent mt-3"
                onPress={() => setCurrentStep('EMAIL')}
              >
                <View className="flex-row items-center gap-2">
                  <Text className="font-pretendard-semibold text-[16px] text-primary">이전</Text>
                  <Ionicons name="arrow-back" size={18} color="#344966" />
                </View>
              </TouchableOpacity>
            </>
          )}

          {currentStep === 'INFO' && (
            <>
              <Text className="font-pretendard text-[14px] text-[#8E8E8E] text-center mb-8">회원 정보를 입력해주세요.</Text>

              <View className="flex-row items-center mb-1.5">
                <Text className="font-pretendard-semibold text-[14px] text-[#333333]">닉네임</Text>
                <Text className="font-pretendard text-[10px] text-[#ABABAB] ml-1">* 한글, 영문, 숫자만 사용 가능 / 2~20자</Text>
              </View>

              <Controller
                control={control}
                name="nickname"
                rules={{
                  required: '닉네임을 입력해주세요.',
                  pattern: {
                    value: /^[가-힣a-zA-Z0-9]{2,20}$/,
                    message: '2~20자 한글/영문/숫자만 사용할 수 있습니다.',
                  },
                }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <View className="flex-row items-start gap-2">
                      <View className="flex-1">
                        <FormField
                          placeholder="닉네임"
                          autoCapitalize="none"
                          onBlur={onBlur}
                          onChangeText={(v) => {
                            onChange(v);
                            setNicknameStatus('idle');
                          }}
                          value={value}
                          error={errors.nickname?.message}
                        />
                      </View>

                      <TouchableOpacity
                        className={`rounded-[10px] px-3.5 py-3.5 items-center justify-center min-w-[78px] ${
                          nicknameStatus === 'checking' ? 'bg-gray-300' : 'bg-primary'
                        }`}
                        onPress={checkNickname}
                        disabled={nicknameStatus === 'checking'}
                      >
                        {nicknameStatus === 'checking' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="font-pretendard-semibold text-[12px] text-white">중복확인</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View className="flex-row flex-wrap -mt-2 mb-4 px-1">
                      <Requirement met={hasNicknameLength(value)} label="2~20자" />
                      <Requirement met={hasNicknameChars(value)} label="한글/영문/숫자" />
                    </View>

                    {nicknameStatus === 'available' && (
                      <Text className="font-pretendard text-[12px] -mt-2 mb-3 px-1 text-primary">사용 가능한 닉네임입니다.</Text>
                    )}

                    {nicknameStatus === 'taken' && (
                      <Text className="font-pretendard text-[12px] -mt-2 mb-3 px-1 text-[#FF5252]">이미 사용 중인 닉네임입니다.</Text>
                    )}
                  </>
                )}
              />

              <Text className="font-pretendard-semibold text-[14px] text-[#333333] mb-1.5 mt-4">비밀번호</Text>

              <Controller
                control={control}
                name="password"
                rules={{ required: '비밀번호를 입력해주세요.' }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <FormField
                      placeholder="비밀번호"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      rightElement={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((prev) => !prev)} />}
                    />

                    <View className="flex-row flex-wrap -mt-2 mb-4 px-1">
                      <Requirement met={hasLength(value)} label="8~20자" />
                      <Requirement met={hasNumber(value)} label="숫자 포함" />
                      <Requirement met={hasSpecial(value)} label="특수문자 포함" />
                    </View>
                  </>
                )}
              />

              <Controller
                control={control}
                name="passwordConfirm"
                rules={{ required: '비밀번호 확인을 입력해주세요.' }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <>
                    <FormField
                      placeholder="비밀번호 확인"
                      secureTextEntry={!showConfirm}
                      autoCapitalize="none"
                      onBlur={onBlur}
                      onChangeText={onChange}
                      value={value}
                      rightElement={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((prev) => !prev)} />}
                    />

                    {passwordConfirm.length > 0 && (
                      <View className="flex-row -mt-2 mb-2 px-1">
                        <Requirement
                          met={passwordsMatch}
                          label={passwordsMatch ? '비밀번호가 일치합니다' : '비밀번호가 일치하지 않습니다'}
                        />
                      </View>
                    )}
                  </>
                )}
              />

              {!!registerError && <Text className="text-[#FF5252] text-[13px] text-center mt-4 mb-2">{registerError}</Text>}

              <TouchableOpacity
                className={`rounded-[15px] py-[18px] items-center mt-4 ${
                  nicknameStatus !== 'available' || isSubmitting ? 'bg-[#8FA3B8]' : 'bg-primary'
                }`}
                onPress={handleSubmit(onSubmit)}
                disabled={isSubmitting || nicknameStatus !== 'available'}
                accessibilityLabel="회원가입 완료"
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-pretendard-semibold text-[16px] text-white">가입하기</Text>
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
      <View className={`w-1.5 h-1.5 rounded-full mr-1 ${met ? 'bg-primary' : 'bg-gray-300'}`} />
      <Text className={`font-pretendard text-[12px] ${met ? 'text-primary' : 'text-gray-300'}`}>
        {label}
      </Text>
    </View>
  );
}
