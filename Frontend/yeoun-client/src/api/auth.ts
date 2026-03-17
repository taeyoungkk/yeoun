import apiClient from './client';

export interface CommonResponse<T = any> {
  success: boolean;
  code: string;
  message: string;
  data: T;
  timestamp: string;
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
