import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Choices offered for the notification settings. */
export const EXPIRY_NOTICE_DAYS = [7, 14, 30, 60] as const;
export const MISSED_REPEAT_MINUTES = [0, 10, 15, 30, 60] as const;

/**
 * The person's own settings (docs/screens.md, "Settings"), kept on this phone.
 * The name is what members of a shared cabinet will see.
 */
interface PrefsState {
  name: string;
  /** How long before a pack's date its notification comes. */
  expiryNoticeDays: number;
  /** One repeat of a dose not marked taken, this many minutes later; 0 is none. */
  missedRepeatMinutes: number;
  weeklyDigest: boolean;
  set: (patch: Partial<Omit<PrefsState, 'set'>>) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      name: '',
      expiryNoticeDays: 30,
      missedRepeatMinutes: 15,
      weeklyDigest: true,
      set: (patch) => set(patch),
    }),
    { name: 'prefs', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
