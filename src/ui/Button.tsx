import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { PressScale } from './motion';
import { colors, radius, spacing } from './theme';
import { type } from './typography';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'night';

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  secondary: { bg: colors.primarySoft, fg: colors.primary },
  outline: { bg: colors.surface, fg: colors.ink, border: colors.line },
  danger: { bg: colors.danger, fg: colors.white },
  night: { bg: colors.nightSoft, fg: colors.white },
};

/**
 * The design's buttons: filled primary, soft secondary, outlined plain, red
 * for what cannot be undone, light on dark for the camera screens. A
 * disabled button has no border and muted text, so it does not look tappable.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  height = 52,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  height?: number;
}) {
  const look = VARIANTS[variant];
  const fg = disabled ? colors.inkMuted : look.fg;
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        {
          height,
          backgroundColor: disabled ? colors.surfaceSoft : look.bg,
          borderColor: disabled ? 'transparent' : (look.border ?? 'transparent'),
        },
      ]}
    >
      <View style={styles.row}>
        {icon ? <Icon name={icon} size={20} color={fg} /> : null}
        {/* One line always: a label too long for a narrow button shrinks a little instead of wrapping. */}
        <Text
          style={[type.button, styles.label, { color: fg }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {label}
        </Text>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});
