import { create } from 'zustand';

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

export const useAuthStore = create<AuthState>((set) => ({
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
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
/** True when the user has a valid access token */
export const selectIsLoggedIn = (s: AuthState) => s.accessToken !== null;
