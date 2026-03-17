import apiClient from './client';
import { CommonResponse } from './auth';

export interface UserProfileData {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  timezone: string;
  role: string;
  status: string;
}

/**
 * Fetches the currently logged-in user's profile information.
 * GET /api/v1/users/me
 */
export const getMyInfo = async (): Promise<CommonResponse<UserProfileData>> => {
  try {
    const response = await apiClient.get<CommonResponse<UserProfileData>>('/api/v1/users/me');
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('getMyInfo failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Info fetched (MOCK)',
        data: {
          userId: 'mock-uuid-1234',
          email: 'mock@example.com',
          nickname: 'MockUser',
          profileImageUrl: null,
          timezone: 'Asia/Seoul',
          role: 'USER',
          status: 'ACTIVE',
        },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
