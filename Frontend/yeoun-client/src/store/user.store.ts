import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,

      setProfile: (profile) =>
        set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...partial } : null,
        })),

      clearProfile: () =>
        set({ profile: null }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectProfile = (s: UserState) => s.profile;
export const selectNickname = (s: UserState) => s.profile?.nickname ?? null;
