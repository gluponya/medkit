import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StepId } from '@/domain/first-steps';

/**
 * How this phone looks at its data, rather than the data itself: which cabinet
 * is on screen and how far the first steps went. Kept in AsyncStorage, never
 * shared with other members of a cabinet.
 */
interface SessionState {
  currentCabinetId: string | null;
  /** First steps the person put off with «Пізніше». */
  stepsLater: StepId[];
  /** Once every step is done or put off, the card never comes back. */
  stepsFinished: boolean;
  hydrated: boolean;
  setCurrentCabinet: (id: string) => void;
  putOffStep: (id: StepId) => void;
  reopenStep: (id: StepId) => void;
  finishSteps: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentCabinetId: null,
      stepsLater: [],
      stepsFinished: false,
      hydrated: false,
      setCurrentCabinet: (id) => set({ currentCabinetId: id }),
      putOffStep: (id) => set((s) => ({ stepsLater: s.stepsLater.includes(id) ? s.stepsLater : [...s.stepsLater, id] })),
      reopenStep: (id) => set((s) => ({ stepsLater: s.stepsLater.filter((x) => x !== id) })),
      finishSteps: () => set({ stepsFinished: true }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
