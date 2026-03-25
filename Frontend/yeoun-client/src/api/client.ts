import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const DEFAULT_API_URL = 'https://j14b105.p.ssafy.io/api/v1';
const API_BASE_PATH = '/api/v1';

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

const normalizeApiUrl = (value?: string) => {
  const rawValue = value?.trim();
  if (!rawValue) {
    return DEFAULT_API_URL;
  }

  try {
    const parsedUrl = new URL(rawValue);
    const normalizedPath = trimTrailingSlashes(parsedUrl.pathname);

    // Accept root origins like https://host and promote them to the API base path.
    parsedUrl.pathname = normalizedPath ? normalizedPath : API_BASE_PATH;
    return trimTrailingSlashes(parsedUrl.toString());
  } catch {
    return trimTrailingSlashes(rawValue);
  }
};

const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL);

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log('[API Client] baseURL:', API_URL);

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

const toTokenPreview = (token?: string | null) =>
  token ? `${token.slice(0, 12)}...` : null;

// Request interceptor to add the access token to every request
apiClient.interceptors.request.use(
  (config) => {
    // Skip Authorization header for public endpoints or refresh endpoint
    if (isPublicApiRequest(config.url)) {
      if (config.headers?.Authorization) {
        delete config.headers.Authorization;
      }
      console.log('[API Request]', {
        method: config.method?.toUpperCase?.() ?? 'GET',
        url: config.url,
        public: true,
      });
      return config;
    }

    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('[API Request]', {
      method: config.method?.toUpperCase?.() ?? 'GET',
      url: config.url,
      public: false,
      hasAccessToken: Boolean(token),
      accessTokenPreview: toTokenPreview(token),
      hasAuthorizationHeader: Boolean(config.headers?.Authorization),
    });
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh on 401 only.
// Treating 403 as an expired session causes valid login sessions to be cleared
// when the backend is actually reporting a permission problem.
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API Response]', {
      method: response.config.method?.toUpperCase?.() ?? 'GET',
      url: response.config.url,
      status: response.status,
      code: response.data?.code,
      success: response.data?.success,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url;
    const status = error.response?.status;

    console.warn('[API Response Error]', {
      method: originalRequest?.method?.toUpperCase?.() ?? 'GET',
      url: requestUrl,
      status,
      code: error.response?.data?.code,
      message: error.response?.data?.message,
      hasAccessToken: Boolean(useAuthStore.getState().accessToken),
      accessTokenPreview: toTokenPreview(useAuthStore.getState().accessToken),
      hasRefreshToken: Boolean(useAuthStore.getState().refreshToken),
    });

    // If error is 401 and NOT already retrying and NOT a public request
    if (
      status === 401 &&
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
