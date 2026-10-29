/**
 * Tokens from the design system (.superdesign/design-system.md). The app uses
 * these names only, never a raw colour.
 */
export const colors = {
  bg: '#EEF3FE',
  surface: '#FFFFFF',
  surfaceSoft: '#F7F9FE',
  line: '#DCE3F2',
  ink: '#2F3A4F',
  inkMuted: '#66718A',
  primary: '#4A6CF7',
  primarySoft: '#E6ECFE',
  danger: '#E0352B',
  dangerSoft: '#FDE8E6',
  warning: '#D9800B',
  warningSoft: '#FEF2DF',
  success: '#1F9D63',
  successSoft: '#E2F5EB',
  white: '#FFFFFF',
  /** The camera's screens: the dark behind the picture and its round buttons. */
  night: '#222736',
  nightSoft: '#3A4050',
  nightMuted: '#A3AABB',
  /** Over the camera's picture around the frame: dims it so the words read. */
  nightScrim: 'rgba(34, 39, 54, 0.6)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const radius = { card: 16, button: 14, tile: 12, pill: 999 } as const;

/** The one shadow a card may have. */
export const cardShadow = {
  shadowColor: colors.ink,
  shadowOpacity: 0.06,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;
