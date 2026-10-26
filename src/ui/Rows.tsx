import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Toggle } from './Toggle';
import { cardShadow, colors, radius, spacing } from './theme';
import { type } from './typography';

/** A titled card of rows with dividers between them, as on Settings. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.group}>
      {title ? <Text style={[type.secondaryStrong, styles.caption]}>{title.toLocaleUpperCase()}</Text> : null}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

/**
 * One settings row: an icon, the label, the current value and a chevron; or a
 * switch in place of the value, which the whole row turns on and off. `hint`
 * is a line of text under the label.
 */
export function Row({
  icon,
  label,
  value,
  hint,
  onPress,
  toggle,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  toggle?: { on: boolean; onChange: (on: boolean) => void };
}) {
  const body = (
    <>
      {icon ? <Icon name={icon} size={24} color={colors.primary} /> : null}
      <View style={styles.fill}>
        <View style={styles.line}>
          <Text style={[type.cardTitle, styles.label]} numberOfLines={1}>
            {label}
          </Text>
          {value ? (
            <Text style={[type.bodyMedium, styles.value]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
        </View>
        {hint ? <Text style={[type.label, styles.hint]}>{hint}</Text> : null}
      </View>
      {toggle ? (
        <Toggle on={toggle.on} />
      ) : onPress ? (
        <Icon name="chevron-right" size={20} />
      ) : null}
    </>
  );
  if (toggle) {
    return (
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: toggle.on }}
        onPress={() => toggle.onChange(!toggle.on)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {body}
      </Pressable>
    );
  }
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

/** A radio row: a round mark, the label and a line under it. */
export function Choice({
  label,
  hint,
  picked,
  onPress,
}: {
  label: string;
  hint?: string;
  picked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: picked }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.choice, pressed && styles.pressed]}
    >
      <View style={[styles.radio, picked && styles.radioOn]}>{picked ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.fill}>
        <Text style={[type.cardTitle, styles.choiceLabel]}>{label}</Text>
        {hint ? <Text style={type.label}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: spacing.xl, gap: spacing.sm },
  caption: { marginLeft: spacing.xs, letterSpacing: 0.4 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 52 },
  row: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  fill: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontSize: 17 },
  value: { color: colors.inkMuted, flexShrink: 1 },
  hint: { marginTop: 2 },
  choice: { alignItems: 'flex-start' },
  choiceLabel: { fontSize: 17 },
  radio: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.white },
});
