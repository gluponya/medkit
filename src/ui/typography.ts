import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import type { TextStyle } from 'react-native';

import { colors } from './theme';

export const fontAssets = {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
};

/**
 * One face per weight: Android does not pick a weight out of a family loaded
 * this way, so `fontWeight` is never set, the face is.
 */
const face = {
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  600: 'Manrope_600SemiBold',
  700: 'Manrope_700Bold',
} as const;

/** The type scale; nothing smaller than 12. */
export const type = {
  screenTitle: { fontFamily: face[700], fontSize: 28, lineHeight: 34, color: colors.ink },
  hero: { fontFamily: face[700], fontSize: 44, lineHeight: 52, color: colors.ink },
  sectionTitle: { fontFamily: face[700], fontSize: 18, lineHeight: 24, color: colors.ink },
  cardTitle: { fontFamily: face[600], fontSize: 16, lineHeight: 22, color: colors.ink },
  stepTitle: { fontFamily: face[700], fontSize: 16, lineHeight: 22, color: colors.ink },
  button: { fontFamily: face[600], fontSize: 16, lineHeight: 22 },
  body: { fontFamily: face[400], fontSize: 15, lineHeight: 21, color: colors.ink },
  bodyMedium: { fontFamily: face[500], fontSize: 15, lineHeight: 21, color: colors.ink },
  lead: { fontFamily: face[400], fontSize: 18, lineHeight: 26, color: colors.inkMuted },
  secondary: { fontFamily: face[500], fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  secondaryStrong: { fontFamily: face[600], fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  label: { fontFamily: face[500], fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  caption: { fontFamily: face[600], fontSize: 12, lineHeight: 16 },
  input: { fontFamily: face[500], fontSize: 17, color: colors.ink },
} satisfies Record<string, TextStyle>;
