import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  /** JWT access token, null when logged out */
  accessToken: string | null;
  /** JWT refresh token, null when logged out */
  refreshToken: string | null;
  /** True once the initial token hydration from storage has finished */
  isHydrated: boolean;

  // ─── Actions ────────────────────────────────────────────────────────────────
  setTokens: (accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearTokens: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      isHydrated: false,

      setTokens: (accessToken, refreshToken) =>
        set(() => {
          console.log('[AuthStore] setTokens', {
            hasAccessToken: Boolean(accessToken),
            accessTokenPreview: accessToken ? `${accessToken.slice(0, 12)}...` : null,
            hasRefreshToken: Boolean(refreshToken),
            refreshTokenPreview: refreshToken ? `${refreshToken.slice(0, 12)}...` : null,
          });
          return { accessToken, refreshToken };
        }),

      setAccessToken: (accessToken) =>
        set(() => {
          console.log('[AuthStore] setAccessToken', {
            hasAccessToken: Boolean(accessToken),
            accessTokenPreview: accessToken ? `${accessToken.slice(0, 12)}...` : null,
          });
          return { accessToken };
        }),

      clearTokens: () =>
        set(() => {
          console.log('[AuthStore] clearTokens');
          return { accessToken: null, refreshToken: null };
        }),

      setHydrated: (hydrated) =>
        set(() => {
          console.log('[AuthStore] setHydrated', { hydrated });
          return { isHydrated: hydrated };
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        console.log('[AuthStore] rehydrated', {
          hasAccessToken: Boolean(state?.accessToken),
          hasRefreshToken: Boolean(state?.refreshToken),
        });
        state?.setHydrated(true);
      },
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
/** True when the user has a valid access token */
export const selectIsLoggedIn = (s: AuthState) => s.accessToken !== null;
