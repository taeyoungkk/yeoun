import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  userId: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  timezone: string;
  createdAt: string;
  role: string;
  status: string;
}

export interface UserSettings {
  receiptNotif: boolean;
  endNotif: boolean;
  photoPerm: boolean;
  locationPerm: boolean;
  showPhotoPins: boolean;
  showPaymentPins: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  receiptNotif: true,
  endNotif: true,
  photoPerm: true,
  locationPerm: true,
  showPhotoPins: true,
  showPaymentPins: true,
};

interface UserState {
  profile: UserProfile | null;
  settings: UserSettings;

  // ─── Actions ────────────────────────────────────────────────────────────────
  setProfile: (profile: UserProfile) => void;
  updateProfile: (partial: Partial<UserProfile>) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  clearProfile: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      profile: null,
      settings: DEFAULT_SETTINGS,

      setProfile: (profile) =>
        set({ profile }),

      updateProfile: (partial) =>
        set((state) => ({
          profile: state.profile ? { ...state.profile, ...partial } : null,
        })),

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
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
export const selectSettings = (s: UserState) => s.settings;
