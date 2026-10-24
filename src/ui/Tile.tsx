import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { PressScale } from './motion';
import { colors, radius, spacing } from './theme';
import { type } from './typography';

/**
 * A choice as a tile (design system: every choice is a tile, never tappable
 * text). Picked: soft blue with a blue border. `dashed` is the «add your own»
 * tile at the end of a set.
 */
export function Tile({
  label,
  onPress,
  picked = false,
  icon,
  check = false,
  dashed = false,
  height = 56,
  role = 'radio',
}: {
  label: string;
  onPress: () => void;
  picked?: boolean;
  icon?: IconName;
  /** A check in a circle on the right when picked, for sets where several can be. */
  check?: boolean;
  dashed?: boolean;
  height?: number;
  role?: 'radio' | 'checkbox' | 'button';
}) {
  const fg = picked || dashed ? colors.primary : colors.ink;
  return (
    <PressScale
      accessibilityRole={role}
      accessibilityState={role === 'button' ? undefined : { checked: picked }}
      onPress={onPress}
      style={[
        styles.tile,
        { minHeight: height },
        icon ? styles.withIcon : styles.centered,
        picked && styles.picked,
        dashed && styles.dashed,
      ]}
    >
      {icon ? <Icon name={icon} size={22} color={colors.primary} /> : null}
      <Text style={[styles.label, { color: fg }, icon ? styles.fill : null]}>{label}</Text>
      {check && picked ? (
        <View style={styles.check}>
          <Icon name="check" size={14} color={colors.white} strokeWidth={3} />
        </View>
      ) : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
  },
  centered: { justifyContent: 'center', paddingHorizontal: spacing.sm },
  withIcon: { gap: spacing.md, paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.sm },
  picked: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
  dashed: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1.5 },
  label: { ...type.bodyMedium, fontSize: 16, lineHeight: 21, textAlign: 'center' },
  fill: { flex: 1, textAlign: 'left' },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
