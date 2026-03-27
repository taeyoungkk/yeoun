import apiClient from './client';
import { CommonResponse, AuthTokens } from './auth';

export interface UserProfileData {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  timezone: string;
  createdAt: string;
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
  createdAt: '2024-03-26T11:54:08.909Z',
  role: 'USER',
  status: 'ACTIVE',
};

/**
 * Fetches the currently logged-in user's profile information.
 * GET /api/v1/users/me
 */
export const getMyInfo = async (): Promise<CommonResponse<UserProfileData>> => {
  try {
    const response = await apiClient.get<CommonResponse<UserProfileData>>('/users/me');
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Deletes the currently logged-in user's account.
 * DELETE /api/v1/users/me
 */
export const withdrawAccount = async (): Promise<CommonResponse<string>> => {
  try {
    const response = await apiClient.delete<CommonResponse<string>>('/users/me');
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

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export type PasswordChangeResponse = AuthTokens;

/**
 * Updates the currently logged-in user's profile information.
 * Supports both JSON (standard updates) and multipart/form-data (image updates).
 * PATCH /api/v1/users/me
 */
export const updateMyInfo = async (
  data: UpdateProfileRequest,
  fileUri?: string
): Promise<CommonResponse<UserProfileData>> => {
  try {
    // If a file URI is provided, we must use FormData for the entire request
    if (fileUri && (fileUri.startsWith('file://') || fileUri.startsWith('content://'))) {
      const formData = new FormData();
      
      if (data.nickname) {
        formData.append('nickname', data.nickname);
      }
      
      const filename = fileUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      // Try using 'profileImageUrl' as the multipart field name
      formData.append('profileImageUrl', {
        uri: fileUri,
        name: filename,
        type,
      } as any);

      const response = await apiClient.patch<CommonResponse<UserProfileData>>('/users/me', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    }

    // Otherwise, a standard JSON patch
    const response = await apiClient.patch<CommonResponse<UserProfileData>>('/users/me', data);
    return response.data;
  } catch (error) {
    console.error('[updateMyInfo] API Error:', error);
    throw error;
  }
};

/**
 * Updates the currently logged-in user's password.
 * PATCH /api/v1/users/me/password
 */
export const updatePassword = async (data: PasswordChangeRequest): Promise<CommonResponse<PasswordChangeResponse>> => {
  try {
    const response = await apiClient.patch<CommonResponse<PasswordChangeResponse>>('/users/me/password', data);
    return response.data;
  } catch (error) {
    throw error;
  }
};
