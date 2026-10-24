import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { expiryFromMonth, expiryStatus, localDay, monthsLeft } from '@/domain/expiry';
import { useT } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { Tile } from '@/ui/Tile';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

import { useDraft } from './draft';
import { MONTH_SHORT, MONTH_UNTIL } from './labels';

const YEARS_SHOWN = 4;

/**
 * Month and year as on the pack, into the draft. Four year tiles from this
 * year, moved by ‹ ›, so there is no last year; then twelve months; then «Не
 * знаю» for a pack with no date left, unless `unknown` is false. Nothing is
 * picked at first: a guessed date is worse than none.
 */
export function ExpiryPicker({ unknown = true }: { unknown?: boolean }) {
  const t = useT();
  const year = useDraft((s) => s.year);
  const month = useDraft((s) => s.month);
  const expiryUnknown = useDraft((s) => s.expiryUnknown);
  const set = useDraft((s) => s.set);
  const thisYear = Number(localDay(new Date()).slice(0, 4));
  const [first, setFirst] = useState(year !== null && year >= thisYear + YEARS_SHOWN ? year - YEARS_SHOWN + 1 : thisYear);
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => first + i);

  return (
    <>
      <View style={styles.labelRow}>
        <Text style={type.label}>{t('add.year')}</Text>
        <View style={styles.arrows}>
          <Arrow
            name="chevron-left"
            label={t('add.yearsEarlier')}
            disabled={first <= thisYear}
            onPress={() => setFirst(first - 1)}
          />
          <Arrow name="chevron-right" label={t('add.yearsLater')} onPress={() => setFirst(first + 1)} />
        </View>
      </View>
      <View style={styles.row}>
        {years.map((y) => (
          <View key={y} style={styles.cell}>
            <Tile label={String(y)} picked={y === year} onPress={() => set({ year: y, expiryUnknown: false })} height={52} />
          </View>
        ))}
      </View>

      <Text style={[type.label, styles.monthLabel]}>{t('add.month')}</Text>
      <View style={styles.months}>
        {MONTH_SHORT.map((key, i) => (
          <View key={key} style={styles.cell}>
            <Tile
              label={t(key)}
              picked={i + 1 === month}
              onPress={() => set({ month: i + 1, expiryUnknown: false })}
              height={52}
            />
          </View>
        ))}
      </View>

      {unknown ? (
        <View style={styles.unknown}>
          <Tile
            label={t('when.unknown')}
            picked={expiryUnknown}
            onPress={() => set({ expiryUnknown: true, year: null, month: null })}
            height={52}
          />
          <Text style={[type.secondary, styles.unknownHint]}>{t('when.unknownHint')}</Text>
        </View>
      ) : null}
    </>
  );
}

function Arrow({
  name,
  label,
  onPress,
  disabled = false,
}: {
  name: 'chevron-left' | 'chevron-right';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.arrow, disabled && styles.arrowOff]}
    >
      <Icon name={name} size={20} color={disabled ? colors.inkMuted : colors.primary} strokeWidth={2} />
    </Pressable>
  );
}

/** «Придатні до кінця березня 2027» with how long that is from now. */
export function ExpirySummary({ year, month, today }: { year: number; month: number; today: string }) {
  const t = useT();
  const left = monthsLeft(today, year, month);
  const status = expiryStatus(expiryFromMonth(year, month), today, 30);
  const tone =
    status === 'expired'
      ? { fg: colors.danger, bg: colors.dangerSoft }
      : status === 'expiring'
        ? { fg: colors.warning, bg: colors.warningSoft }
        : { fg: colors.success, bg: colors.successSoft };
  const badge =
    status === 'expired' ? t('add.expired') : left === 0 ? t('add.thisMonth') : t('add.monthsLeft', { count: left });

  return (
    <View style={styles.summary}>
      <View style={[styles.summaryIcon, { backgroundColor: tone.bg }]}>
        <Icon name="calendar-check" size={26} color={tone.fg} />
      </View>
      <View style={styles.fill}>
        <Text style={type.secondary}>{t('add.goodUntil')}</Text>
        <Text style={styles.summaryDate}>{t(MONTH_UNTIL[month - 1], { year })}</Text>
      </View>
      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
        <Text style={[type.secondaryStrong, { color: tone.fg }]}>{badge}</Text>
      </View>
    </View>
  );
}

/** In place of the summary after «Не знаю». */
export function UnknownExpirySummary() {
  const t = useT();
  return (
    <View style={styles.summary}>
      <View style={[styles.summaryIcon, { backgroundColor: colors.surfaceSoft }]}>
        <Icon name="calendar-check" size={26} color={colors.inkMuted} />
      </View>
      <Text style={[styles.summaryDate, styles.fill]}>{t('expiry.unknown')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -spacing.sm },
  arrows: { flexDirection: 'row', gap: spacing.sm },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowOff: { backgroundColor: colors.surfaceSoft },
  row: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.md },
  monthLabel: { marginTop: spacing.xl },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2, marginTop: spacing.md },
  cell: { width: '22%', flexGrow: 1 },
  unknown: { marginTop: spacing.xl },
  unknownHint: { marginTop: spacing.sm, textAlign: 'center' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  summaryIcon: { width: 48, height: 48, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center' },
  summaryDate: { ...type.sectionTitle, fontSize: 20, lineHeight: 26 },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill },
});
