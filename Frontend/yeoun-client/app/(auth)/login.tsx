import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginForm) => {
    // TODO: connect to auth API
    console.log('Login:', data);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>로그인</Text>

          {/* Email field */}
          <View style={styles.fieldWrapper}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: '이메일을 입력해주세요',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: '올바른 이메일 형식이 아닙니다',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="이메일"
                  placeholderTextColor="#CACACA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}
          </View>

          {/* Password field */}
          <View style={styles.fieldWrapper}>
            <Controller
              control={control}
              name="password"
              rules={{ required: '비밀번호를 입력해주세요' }}
              render={({ field: { onChange, onBlur, value } }) => (
                <View
                  style={[
                    styles.inputRow,
                    errors.password && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="비밀번호"
                    placeholderTextColor="#CACACA"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                    accessibilityLabel="비밀번호 보기/숨기기"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color="#CACACA"
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
            {errors.password && (
              <Text style={styles.errorText}>{errors.password.message}</Text>
            )}
          </View>

          {/* Forgot password */}
          <TouchableOpacity
            style={styles.forgotWrapper}
            accessibilityLabel="비밀번호 찾기"
          >
            <Text style={styles.forgotText}>비밀번호 찾기</Text>
          </TouchableOpacity>

          {/* Sign in button */}
          <TouchableOpacity
            style={styles.signInButton}
            onPress={handleSubmit(onSubmit)}
            accessibilityLabel="로그인 버튼"
          >
            <Text style={styles.signInText}>Sign in</Text>
          </TouchableOpacity>

          {/* Or with divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google button */}
          <TouchableOpacity
            style={styles.googleButton}
            accessibilityLabel="구글 로그인"
          >
            <View style={styles.googleInner}>
              <Image
                source={require('@/assets/images/Google__G__logo.png')}
                style={styles.googleLogoImg}
                resizeMode="contain"
              />
              <Text style={styles.googleText}>Google</Text>
            </View>
          </TouchableOpacity>

          {/* Sign up link */}
          <TouchableOpacity
            style={styles.signUpWrapper}
            onPress={() => router.push('/(auth)/register' as never)}
            accessibilityLabel="회원가입 페이지로 이동"
          >
            <Text style={styles.signUpText}>
              계정이 없으신가요?{' '}
              <Text style={styles.signUpLink}>회원가입</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 30,
    lineHeight: 39,
    textAlign: 'center',
    letterSpacing: -0.01 * 30,
    color: '#4D3E3E',
    marginBottom: 48,
  },

  // ── Fields ────────────────────────────────────────────────────────────────
  fieldWrapper: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBCBCB',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    color: '#333333',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBCBCB',
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    color: '#333333',
  },
  eyeButton: {
    padding: 4,
  },
  eyeIcon: {
    fontSize: 16,
  },
  inputError: {
    borderColor: '#E53935',
  },
  errorText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 12,
    color: '#3629B7',
    marginTop: 4,
    marginLeft: 4,
  },

  // ── Forgot ─────────────────────────────────────────────────────────────────
  forgotWrapper: {
    alignSelf: 'flex-end',
    marginBottom: 28,
  },
  forgotText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    color: '#CACACA',
  },

  // ── Sign in button ────────────────────────────────────────────────────────
  signInButton: {
    backgroundColor: '#344966',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 36,
  },
  signInText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },

  // ── Divider ───────────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D8DADC',
  },
  dividerText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
  },

  // ── Google button ─────────────────────────────────────────────────────────
  googleButton: {
    borderWidth: 1,
    borderColor: '#D8DADC',
    borderRadius: 10,
    paddingVertical: 18,
    paddingHorizontal: 45,
    alignItems: 'center',
    marginBottom: 36,
    backgroundColor: '#FFFFFF',
  },
  googleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleLogoImg: {
    width: 20,
    height: 20,
  },
  googleText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 14,
    color: '#344966',
  },

  // ── Sign up ───────────────────────────────────────────────────────────────
  signUpWrapper: {
    alignItems: 'center',
  },
  signUpText: {
    fontFamily: 'Inter',
    fontWeight: '400',
    fontSize: 14,
    color: 'rgba(0,0,0,0.7)',
  },
  signUpLink: {
    fontWeight: '700',
    color: '#344966',
  },
});
