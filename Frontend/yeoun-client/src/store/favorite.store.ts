import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FavoriteState {
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useFavoriteStore = create<FavoriteState>()(
  persist(
    (set, get) => ({
      favoriteIds: [], // Initialize empty
      toggleFavorite: (id) => {
        const { favoriteIds } = get();
        const isFav = favoriteIds.includes(id);
        if (isFav) {
          set({ favoriteIds: favoriteIds.filter((favId) => favId !== id) });
        } else {
          set({ favoriteIds: [...favoriteIds, id] });
        }
      },
      isFavorite: (id) => get().favoriteIds.includes(id),
    }),
    {
      name: 'favorite-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
