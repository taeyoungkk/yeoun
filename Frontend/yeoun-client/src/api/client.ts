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

const isPublicApiRequest = (url?: string) => {
  if (!url) return false;
  // Define public endpoints that don't need Authorization header
  const publicPaths = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/password/reset', '/auth/email'];
  return publicPaths.some(path => url.includes(path));
};

// Request interceptor to add the access token to every request
apiClient.interceptors.request.use(
  (config) => {
    // Skip Authorization header for public endpoints or refresh endpoint
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

// Response interceptor to handle token refresh on 401/403
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url;

    // If error is 401/403 and NOT already retrying and NOT a public request
    if (
      (error.response?.status === 401 || error.response?.status === 403) && 
      !originalRequest?._retry &&
      !isPublicApiRequest(requestUrl)
    ) {
      originalRequest._retry = true;

      console.log(`[API Interceptor] Error ${error.response.status} on ${requestUrl}. Attempting token refresh...`);

      try {
        const { refreshToken, setTokens, clearTokens } = useAuthStore.getState();
        
        if (!refreshToken) {
          console.log('[API Interceptor] No refresh token available. Clearing session.');
          clearTokens();
          return Promise.reject(error);
        }

        // Import refreshApi here to avoid circular dependency
        const { refreshApi } = require('./auth');
        const refreshResponse = await refreshApi(refreshToken);

        if (refreshResponse.success) {
          console.log('[API Interceptor] Token refresh successful. Retrying original request.');
          const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data;
          setTokens(newAccess, newRefresh);
          
          // Update original request header and retry
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return apiClient(originalRequest);
        } else {
          console.log('[API Interceptor] Token refresh failed. Clearing session.');
          clearTokens();
          return Promise.reject(error);
        }
      } catch (refreshError) {
        console.error('[API Interceptor] Token refresh error:', refreshError);
        useAuthStore.getState().clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
