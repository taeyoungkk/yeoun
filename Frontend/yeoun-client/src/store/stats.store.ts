import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StatsState {
  visitedSigCodes: string[];
  lastSync: string | null;
  isProcessing: boolean;
  
  // Actions
  setVisitedSigCodes: (codes: string[]) => void;
  setProcessing: (processing: boolean) => void;
  reset: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      visitedSigCodes: [],
      lastSync: null,
      isProcessing: false,

      setVisitedSigCodes: (codes: string[]) => 
        set({ 
          visitedSigCodes: codes, 
          lastSync: new Date().toISOString() 
        }),

      setProcessing: (isProcessing: boolean) => set({ isProcessing }),

      reset: () => set({ visitedSigCodes: [], lastSync: null, isProcessing: false }),
    }),
    {
      name: 'yeoun-stats-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the calculated codes, not the processing state
      partialize: (state) => ({ 
        visitedSigCodes: state.visitedSigCodes,
        lastSync: state.lastSync 
      }),
    }
  )
);
