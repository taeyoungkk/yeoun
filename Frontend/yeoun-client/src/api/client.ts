import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

// We'll use a default if EXPO_PUBLIC_API_URL is not set,
// though in a real app you'd want this to be mandatory.
const normalizeApiUrl = (url: string) => url.replace(/\/+$/, '');
const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL || 'https://api.yeoun.com/api/v1');

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_API_PATH_PREFIXES = [
  '/auth/signup',
  '/auth/login',
  '/auth/oauth/google',
  '/auth/refresh',
  '/auth/email/code',
  '/auth/email/verify',
  '/auth/password/reset/request',
  '/auth/password/reset/confirm',
  '/users/check-email',
  '/users/check-nickname',
];

const isPublicApiRequest = (url?: string) => {
  if (!url) return false;
  return PUBLIC_API_PATH_PREFIXES.some((prefix) => url.startsWith(prefix));
};

// Request interceptor to add the access token to every request
apiClient.interceptors.request.use(
  (config) => {
    if (isPublicApiRequest(config.url)) {
      if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      return config;
    }

    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh on 401
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url;

    // If error is 401 and not already retrying
    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isPublicApiRequest(requestUrl)
    ) {
      originalRequest._retry = true;

      try {
        const { refreshToken, setTokens, clearTokens } = useAuthStore.getState();
        
        if (!refreshToken) {
          clearTokens();
          return Promise.reject(error);
        }

        // Import refreshApi here to avoid circular dependency
        const { refreshApi } = require('./auth');
        const refreshResponse = await refreshApi(refreshToken);

        if (refreshResponse.success) {
          const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data;
          setTokens(newAccess, newRefresh);
          
          // Update original request header and retry
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(originalRequest);
        } else {
          clearTokens();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        useAuthStore.getState().clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
