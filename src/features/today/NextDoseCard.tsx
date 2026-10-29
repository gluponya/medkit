import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { takeDose } from '@/data/medicines';
import { snoozeDose } from '@/data/notifications';
import type { TodayReminder } from '@/data/today';
import { minutesUntil, type TodayDose } from '@/domain/today';
import { UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Icon } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** How far «Пізніше» puts a dose off. */
const SNOOZE_MINUTES = 30;

export const hhmm = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** The clock a dose screen reads, moved on every half minute so states and «через …» stay true. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The next dose as the big blue card, on Today and on Home: when, the
 * medicine and how much, «Прийняти» and, once it is due, «Пізніше».
 * `more` adds «Ще N ›» in the corner, Home's way to the rest of the day.
 */
export function NextDoseCard({
  dose,
  time,
  more,
}: {
  dose: TodayDose<TodayReminder>;
  /** Now, `HH:MM`. */
  time: string;
  more?: { count: number; onPress: () => void };
}) {
  const t = useT();
  const [snoozedTo, setSnoozedTo] = useState<{ due: string; at: string } | null>(null);
  const taking = useRef<string | null>(null);
  const r = dose.reminder;

  const when =
    dose.state === 'due'
      ? t('today.dueNow')
      : minutesUntil(time, dose.time) < 60
        ? t('today.inMinutes', { count: minutesUntil(time, dose.time) })
        : t('today.inHours', { count: Math.round(minutesUntil(time, dose.time) / 60) });

  // A second tap while the first is saved takes nothing.
  const take = async () => {
    if (taking.current === dose.due) return;
    taking.current = dose.due;
    try {
      await takeDose({ medicineId: r.medicineId, dose: dose.dose, reminderId: r.id, due: dose.due });
    } finally {
      taking.current = null;
    }
  };
  const later = async () => {
    const at = await snoozeDose({ ...r, reminderId: r.id, time: dose.time, dose: dose.dose, due: dose.due }, SNOOZE_MINUTES);
    setSnoozedTo({ due: dose.due, at: hhmm(at) });
  };

  return (
    <View style={styles.hero}>
      <View style={styles.top}>
        <Text style={[type.label, styles.soft, styles.fill]}>{when}</Text>
        {more && more.count > 0 ? (
          <Pressable accessibilityRole="button" onPress={more.onPress} hitSlop={8} style={styles.more}>
            <Text style={[type.secondaryStrong, styles.white]}>{t('home.moreDoses', { count: more.count })}</Text>
            <Icon name="chevron-right" size={18} color={colors.white} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.time}>{dose.time}</Text>
      <Text style={[type.sectionTitle, styles.white, styles.name]}>{r.name}</Text>
      <Text style={[type.body, styles.soft]}>
        {t('medicine.amount', { count: dose.dose, unit: t(UNIT[r.form ?? 'other']) })}
      </Text>
      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => void take()}
          style={({ pressed }) => [styles.take, pressed && styles.pressed]}
        >
          <Icon name="check" size={22} color={colors.primary} strokeWidth={2.2} />
          <Text style={[type.button, styles.primary]}>{t('today.take')}</Text>
        </Pressable>
        {dose.state === 'due' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void later()}
            style={({ pressed }) => [styles.later, pressed && styles.pressed]}
          >
            <Text style={[type.button, styles.white]}>
              {snoozedTo?.due === dose.due ? t('today.snoozedTo', { time: snoozedTo.at }) : t('today.later')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: spacing.lg, marginVertical: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fill: { flex: 1 },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  soft: { color: colors.white, opacity: 0.8 },
  white: { color: colors.white },
  primary: { color: colors.primary },
  pressed: { opacity: 0.7 },
  time: { ...type.hero, color: colors.white, fontSize: 48, lineHeight: 58 },
  name: { fontSize: 22, lineHeight: 28 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  take: {
    flex: 1,
    height: 52,
    borderRadius: radius.button,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  // White over the card's blue, as the design has it.
  later: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
