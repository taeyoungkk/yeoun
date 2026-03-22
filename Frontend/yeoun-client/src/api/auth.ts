import axios from 'axios';
import apiClient from './client';

export interface CommonResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  isNewUser: boolean;
}

export interface LoginResponseData {
  user?: {
    userId: string;
    email: string;
    nickname: string;
  };
  // The API sometimes returns tokens wrapped in a 'tokens' object, 
  // and sometimes flat at the top level of 'data'.
  tokens?: AuthTokens;
  accessToken?: string;
  refreshToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  nickname: string;
}

export interface AvailabilityCheckData {
  available: boolean;
}

export interface EmailCodeSendData {
  sent: boolean;
  message: string;
}

export interface EmailVerificationData {
  verified: boolean;
  message: string;
}

const API_MOCKS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_API_MOCKS === 'true';
const FORCE_MOCK_LOGIN = process.env.EXPO_PUBLIC_FORCE_MOCK_LOGIN === 'true';

const createMockLoginResponse = (email: string, nickname = 'MockUser'): CommonResponse<LoginResponseData> => ({
  success: true,
  code: 'SUCCESS',
  message: 'Logged in (MOCK)',
  data: {
    user: {
      userId: 'mock-uuid-1234',
      email,
      nickname,
    },
    tokens: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      tokenType: 'Bearer',
      expiresIn: 1800,
      isNewUser: false,
    },
  },
  timestamp: new Date().toISOString(),
});

const shouldMockInDev = (error: unknown) => {
  if (!__DEV__ || !API_MOCKS_ENABLED) {
    return false;
  }

  // Only fall back to mocks when the request never reached the server.
  return axios.isAxiosError(error) && !error.response;
};

/**
 * Logs the user out by calling the backend API.
 * Currently mocks success in development if the network fails.
 */
export const logoutApi = async (): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/logout');
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('API call failed, but mocking success for logout in development.');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Logged out successfully (MOCK)',
        data: 'OK',
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Sends a 6-digit verification code to the input email.
 * Mocks success in development if the network fails.
 */
export const sendEmailCode = async (
  email: string,
): Promise<CommonResponse<EmailCodeSendData>> => {
  try {
    const response = await apiClient.post<CommonResponse<EmailCodeSendData>>('/auth/email/code', { email });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('sendEmailCode failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Code sent (MOCK)',
        data: {
          sent: true,
          message: 'Code sent (MOCK)',
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const checkEmailAvailability = async (
  email: string,
): Promise<CommonResponse<AvailabilityCheckData>> => {
  try {
    const response = await apiClient.get<CommonResponse<AvailabilityCheckData>>(
      '/users/check-email',
      { params: { email } },
    );
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Email availability checked (MOCK)',
        data: {
          available: !email.toLowerCase().includes('test'),
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export const checkNicknameAvailability = async (
  nickname: string,
): Promise<CommonResponse<AvailabilityCheckData>> => {
  try {
    const response = await apiClient.get<CommonResponse<AvailabilityCheckData>>(
      '/users/check-nickname',
      { params: { nickname } },
    );
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Nickname availability checked (MOCK)',
        data: {
          available: !nickname.toLowerCase().includes('test'),
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Verifies the email and the 6-digit code.
 * Mocks success in development if the network fails.
 */
export const verifyEmailCode = async (
  email: string,
  code: string,
): Promise<CommonResponse<EmailVerificationData>> => {
  try {
    const response = await apiClient.post<CommonResponse<EmailVerificationData>>('/auth/email/verify', { email, code });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('verifyEmailCode failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Verified (MOCK)',
        data: {
          verified: true,
          message: 'Verified (MOCK)',
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Logs in the user with email and password.
 * Mocks success in development if the network fails.
 */
export const loginApi = async (data: LoginRequest): Promise<CommonResponse<LoginResponseData>> => {
  if (__DEV__ && FORCE_MOCK_LOGIN) {
    console.log('FORCE_MOCK_LOGIN is enabled. Skipping /auth/login request.');
    return createMockLoginResponse(data.email);
  }

  try {
    const response = await apiClient.post<CommonResponse<LoginResponseData>>('/auth/login', data);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('loginApi failed, mocking success in dev');
      return createMockLoginResponse(data.email);
    }
    throw error;
  }
};

/**
 * Refreshes the access token using the refresh token.
 * Mocks success in development if the network fails.
 */
export const refreshApi = async (refreshToken: string): Promise<CommonResponse<AuthTokens>> => {
  try {
    const response = await apiClient.post<CommonResponse<AuthTokens>>('/auth/refresh', { refreshToken });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('refreshApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Token refreshed (MOCK)',
        data: {
          accessToken: 'mock-access-token-new',
          refreshToken: 'mock-refresh-token-new',
          tokenType: 'Bearer',
          expiresIn: 1800,
          isNewUser: false,
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export interface ResetConfirmRequest {
  email: string;
  code: string;
  newPassword: string;
}

/**
 * Requests a password reset code to be sent to the email.
 */
export const requestPasswordReset = async (email: string): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/password/reset/request', { email });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('requestPasswordReset failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Reset code sent (MOCK)',
        data: 'OK',
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Confirms the password reset with the code and new password.
 */
export const confirmPasswordReset = async (data: ResetConfirmRequest): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/password/reset/confirm', data);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('confirmPasswordReset failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Password reset successful (MOCK)',
        data: 'OK',
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Signs up a new user with email, password, and nickname.
 * Mocks success in development if the network fails.
 */
export const signupApi = async (data: SignupRequest): Promise<CommonResponse<LoginResponseData>> => {
  try {
    const response = await apiClient.post<CommonResponse<LoginResponseData>>('/auth/signup', data);
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('signupApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Signed up successfully (MOCK)',
        data: {
          user: {
            userId: 'mock-uuid-9999',
            email: data.email,
            nickname: data.nickname,
          },
          tokens: {
            accessToken: 'mock-access-token-signup',
            refreshToken: 'mock-refresh-token-signup',
            tokenType: 'Bearer',
            expiresIn: 1800,
            isNewUser: true,
          },
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Authenticates with Google using an idToken.
 * Mocks success in development if the network fails.
 */
export const googleAuthApi = async (idToken: string): Promise<CommonResponse<LoginResponseData>> => {
  try {
    const response = await apiClient.post<CommonResponse<LoginResponseData>>('/auth/oauth/google', { idToken });
    return response.data;
  } catch (error) {
    if (shouldMockInDev(error)) {
      console.log('googleAuthApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Google login successful (MOCK)',
        data: {
          user: {
            userId: 'mock-google-user',
            email: 'google-user@example.com',
            nickname: 'GoogleUser',
          },
          tokens: {
            accessToken: 'mock-access-token-google',
            refreshToken: 'mock-refresh-token-google',
            tokenType: 'Bearer',
            expiresIn: 1800,
            isNewUser: false,
          },
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
