import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

// We'll use a default if EXPO_PUBLIC_API_URL is not set, 
// though in a real app you'd want this to be mandatory.
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.yeoun.com/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the access token to every request
apiClient.interceptors.request.use(
  (config) => {
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

export default apiClient;
