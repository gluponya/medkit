import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCabinetCounts, type Cabinet } from '@/data/cabinets';
import { useT } from '@/i18n';
import { Icon, type IconName } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Every cabinet as a row: its icon, name and «24 ліки, 1 протерміновано».
 * The switcher ticks the current one; the Cabinets screen shows chevrons.
 */
export function CabinetRows({
  cabinets,
  currentId,
  onPick,
}: {
  cabinets: readonly Cabinet[];
  /** Ticked; leave it out for chevrons instead. */
  currentId?: string;
  onPick: (cabinet: Cabinet) => void;
}) {
  const t = useT();
  const counts = useCabinetCounts();

  return (
    <View style={styles.card}>
      {cabinets.map((c, i) => {
        const n = counts.get(c.id) ?? { medicines: 0, expired: 0 };
        const current = c.id === currentId;
        return (
          <Fragment key={c.id}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={currentId === undefined ? undefined : { selected: current }}
              onPress={() => onPick(c)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.mark, current && styles.markOn]}>
                <Icon name={c.icon} size={24} color={current ? colors.white : colors.primary} />
              </View>
              <View style={styles.fill}>
                <Text style={[type.cardTitle, styles.name]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={type.secondary} numberOfLines={1}>
                  {n.medicines === 0 ? t('cabinets.empty') : t('cabinets.medicines', { count: n.medicines })}
                  {n.expired > 0 ? (
                    <Text style={styles.expired}>{`, ${t('cabinets.expired', { count: n.expired })}`}</Text>
                  ) : null}
                </Text>
              </View>
              {currentId === undefined ? (
                <Icon name="chevron-right" size={20} />
              ) : current ? (
                <Icon name="check" size={22} color={colors.primary} strokeWidth={2.25} />
              ) : null}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

/** The dashed «+ Додати аптечку» under the rows. */
export function AddCabinetRow({ onPress }: { onPress: () => void }) {
  const t = useT();
  return <DashedRow icon="plus" label={t('cabinets.add')} onPress={onPress} />;
}

/** «Приєднатися за кодом», under «Додати аптечку»: a cabinet someone shared. */
export function JoinCabinetRow({ onPress }: { onPress: () => void }) {
  const t = useT();
  return <DashedRow icon="key" label={t('cabinets.join')} onPress={onPress} />;
}

function DashedRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.add, pressed && styles.pressed]}
    >
      <Icon name={icon} size={22} color={colors.primary} />
      <Text style={[type.stepTitle, styles.primary]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 14 + 44 + spacing.md },
  row: {
    minHeight: 68,
    paddingLeft: 14,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: { opacity: 0.7 },
  mark: {
    width: 44,
    height: 44,
    borderRadius: radius.tile,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: colors.primary },
  fill: { flex: 1 },
  name: { fontSize: 17 },
  expired: { color: colors.danger },
  primary: { color: colors.primary },
  add: {
    marginTop: spacing.md,
    height: 56,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
