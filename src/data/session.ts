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
  /**
   * The first-time hint at the switcher: due once a second cabinet is made,
   * seen for good after its first close.
   */
  switcherHint: 'unseen' | 'due' | 'seen';
  /** The first-time hint at «Кілька поспіль», shown until the scanner's first close of it. */
  scanHintSeen: boolean;
  /** The scanner's «Кілька поспіль», kept as last left. */
  scanMany: boolean;
  hydrated: boolean;
  setCurrentCabinet: (id: string) => void;
  putOffStep: (id: StepId) => void;
  reopenStep: (id: StepId) => void;
  finishSteps: () => void;
  closeSwitcherHint: () => void;
  closeScanHint: () => void;
  setScanMany: (on: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      currentCabinetId: null,
      stepsLater: [],
      stepsFinished: false,
      switcherHint: 'unseen',
      scanHintSeen: false,
      scanMany: false,
      hydrated: false,
      setCurrentCabinet: (id) => set({ currentCabinetId: id }),
      putOffStep: (id) => set((s) => ({ stepsLater: s.stepsLater.includes(id) ? s.stepsLater : [...s.stepsLater, id] })),
      reopenStep: (id) => set((s) => ({ stepsLater: s.stepsLater.filter((x) => x !== id) })),
      finishSteps: () => set({ stepsFinished: true }),
      closeSwitcherHint: () => set({ switcherHint: 'seen' }),
      closeScanHint: () => set({ scanHintSeen: true }),
      setScanMany: (on) => set({ scanMany: on }),
    }),
    {
      name: 'session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    },
  ),
);
