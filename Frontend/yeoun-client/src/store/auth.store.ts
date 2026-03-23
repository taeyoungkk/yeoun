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
        set({ accessToken, refreshToken }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      clearTokens: () =>
        set({ accessToken: null, refreshToken: null }),

      setHydrated: (hydrated) =>
        set({ isHydrated: hydrated }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
/** True when the user has a valid access token */
export const selectIsLoggedIn = (s: AuthState) => s.accessToken !== null;
