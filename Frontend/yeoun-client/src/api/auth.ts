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
  user: {
    userId: string;
    email: string;
    nickname: string;
  };
  tokens: AuthTokens;
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

/**
 * Logs the user out by calling the backend API.
 * Currently mocks success in development if the network fails.
 */
export const logoutApi = async (): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/logout');
    return response.data;
  } catch (error) {
    // If we're in development, we'll mock a successful response for a better DX
    if (__DEV__) {
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
export const sendEmailCode = async (email: string): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/email/code', { email });
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('sendEmailCode failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Code sent (MOCK)',
        data: 'OK',
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
export const verifyEmailCode = async (email: string, code: string): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.post<CommonResponse<string>>('/auth/email/verify', { email, code });
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('verifyEmailCode failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Verified (MOCK)',
        data: 'OK',
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
  try {
    const response = await apiClient.post<CommonResponse<LoginResponseData>>('/auth/login', data);
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('loginApi failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Logged in (MOCK)',
        data: {
          user: {
            userId: 'mock-uuid-1234',
            email: data.email,
            nickname: 'MockUser',
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
      };
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
    if (__DEV__) {
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
    if (__DEV__) {
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
    if (__DEV__) {
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
    if (__DEV__) {
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
