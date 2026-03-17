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
 * Mock data for development mode to ensure updates "stick" during a session.
 */
let mockProfile: UserProfileData = {
  userId: 'mock-uuid-1234',
  email: 'mock@example.com',
  nickname: 'MockUser',
  profileImageUrl: null,
  timezone: 'Asia/Seoul',
  role: 'USER',
  status: 'ACTIVE',
};

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
      console.log('getMyInfo failed, using mock data');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Info fetched (MOCK)',
        data: { ...mockProfile },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

/**
 * Deletes the currently logged-in user's account.
 * DELETE /api/v1/users/me
 */
export const withdrawAccount = async (): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.delete<CommonResponse<string>>('/api/v1/users/me');
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('withdrawAccount failed, mocking success in dev');
      return {
        success: true,
        code: 'SUCCESS',
        message: 'Account withdrawn (MOCK)',
        data: 'OK',
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};

export interface UpdateProfileRequest {
  nickname?: string;
  profileImageUrl?: string;
}

/**
 * Updates the currently logged-in user's profile information.
 * PATCH /api/v1/users/me
 */
export const updateMyInfo = async (data: UpdateProfileRequest): Promise<CommonResponse<UserProfileData>> => {
  try {
    const response = await apiClient.patch<CommonResponse<UserProfileData>>('/api/v1/users/me', data);
    // If successful, we would ideally update our local mock too, but we return fresh data from server
    return response.data;
  } catch (error) {
    if (__DEV__) {
      console.log('updateMyInfo failed, updating mock data locally');
      
      // Update our local mock so getMyInfo returns the new values
      if (data.nickname) mockProfile.nickname = data.nickname;
      if (data.profileImageUrl !== undefined) mockProfile.profileImageUrl = data.profileImageUrl;

      return {
        success: true,
        code: 'SUCCESS',
        message: 'Info updated (MOCK)',
        data: { ...mockProfile },
        timestamp: new Date().toISOString(),
      };
    }
    throw error;
  }
};
