import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { formatMessage } from './format';
import { en } from './messages.en';
import { uk, type MessageKey } from './messages.uk';
import type { Language, Message, MessageParams } from './types';

/**
 * The i18n layer, the same as Freshka's: a lookup, `{placeholder}` substitution
 * and a hand-written plural rule (plural.ts). Ukrainian is the source language
 * and the default; English is the second one. Components hold keys, never text.
 */

export type { Language, MessageKey };

export const LANGUAGES: readonly Language[] = ['uk', 'en'];

const CATALOGUES: Record<Language, Record<MessageKey, Message>> = { uk, en };

/** The device's language if we speak it, otherwise Ukrainian, the home audience's. */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    const code = locale.languageCode as Language | null;
    if (code && LANGUAGES.includes(code)) return code;
  }
  return 'uk';
}

interface I18nState {
  language: Language;
  /** false until the stored choice has been read: before that, text may change under the person. */
  hydrated: boolean;
  setLanguage: (language: Language) => void;
}

/** The chosen language, kept: a person who switched away from the device language means it. */
export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      language: deviceLanguage(),
      hydrated: false,
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'language',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ language: state.language }),
      onRehydrateStorage: () => () => useI18n.setState({ hydrated: true }),
    },
  ),
);

export function translate(language: Language, key: MessageKey, params?: MessageParams): string {
  return formatMessage(CATALOGUES[language][key] ?? uk[key], language, params);
}

/** Translation outside React. Inside a component use `useT`. */
export function t(key: MessageKey, params?: MessageParams): string {
  return translate(useI18n.getState().language, key, params);
}

/** Translation bound to the current language; re-renders when it changes. */
export function useT() {
  const language = useI18n((s) => s.language);
  return useMemo(
    () => (key: MessageKey, params?: MessageParams) => translate(language, key, params),
    [language],
  );
}
