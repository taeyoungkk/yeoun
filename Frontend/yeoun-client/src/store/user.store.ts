import { create } from 'zustand';

export interface UserProfile {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  timezone: string;
  role: string;
  status: string;
}

interface UserState {
  profile: UserProfile | null;

  // ─── Actions ────────────────────────────────────────────────────────────────
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  profile: null,

  setProfile: (profile) =>
    set({ profile }),

  updateProfile: (partial) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...partial } : null,
    })),

  clearProfile: () =>
    set({ profile: null }),
}));

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectProfile = (s: UserState) => s.profile;
export const selectNickname = (s: UserState) => s.profile?.nickname ?? null;
