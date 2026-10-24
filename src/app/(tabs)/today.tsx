import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentCabinet } from '@/data/cabinets';
import { takeDose } from '@/data/medicines';
import { snoozeDose } from '@/data/notifications';
import { useCabinetReminders, useDayIntakes, type TodayReminder } from '@/data/today';
import { localDay } from '@/domain/expiry';
import { weekday } from '@/domain/reminders';
import { daysLeft, minutesUntil, nextDose, todayDoses, type TodayDose } from '@/domain/today';
import { UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const soon = () => router.push('/soon');

/** How far «Пізніше» puts a dose off. */
const SNOOZE_MINUTES = 30;

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** The clock the screen reads, moved on every half minute so states and «через …» stay true. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * Today (docs/screens.md, 5-today): the day's doses in order with what became
 * of each, the next one as a big card with «Прийняти» and «Пізніше», then
 * every reminder of the cabinet.
 */
export default function Today() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const now = useNow();
  const today = localDay(now);
  const time = hhmm(now);
  const plans = useCabinetReminders(cabinet?.id);
  const marks = useDayIntakes(cabinet?.id, today);
  const doses = useMemo(() => todayDoses(plans ?? [], marks, today, time), [plans, marks, today, time]);
  const next = nextDose(doses);
  const [snoozed, setSnoozed] = useState<{ due: string; at: string } | null>(null);

  if (!cabinet || plans === undefined) return null;

  const [, month, date] = today.split('-').map(Number);
  const dateLine = t('today.date', {
    weekday: t(`weekday.long.${weekday(today)}` as 'weekday.long.1'),
    day: date,
    month: t(`month.until.${month}` as 'month.until.1', { year: '' }).trim(),
  });
  const takenCount = doses.filter((d) => d.state === 'taken').length;
  const unit = (r: TodayReminder) => t(UNIT[r.form ?? 'other']);
  const take = (d: TodayDose<TodayReminder>) =>
    takeDose({ medicineId: d.reminder.medicineId, dose: d.dose, reminderId: d.reminder.id, due: d.due });
  const later = async (d: TodayDose<TodayReminder>) => {
    const at = await snoozeDose(
      { ...d.reminder, reminderId: d.reminder.id, time: d.time, dose: d.dose, due: d.due },
      SNOOZE_MINUTES,
    );
    setSnoozed({ due: d.due, at: hhmm(at) });
  };
  // The typed-routes generator lists /medicine/[id] as a static path on Windows, so it is cast.
  const openReminder = (medicineId: string) => router.push(`/medicine/${medicineId}/reminder` as Href);

  const whenNext = (d: TodayDose<TodayReminder>) => {
    if (d.state === 'due') return t('today.dueNow');
    const left = minutesUntil(time, d.time);
    return left < 60 ? t('today.inMinutes', { count: left }) : t('today.inHours', { count: Math.round(left / 60) });
  };

  const summary = (r: TodayReminder) => {
    if (r.schedule === 'as_needed') return t('reminder.asNeeded');
    const kind =
      r.schedule === 'days_of_week'
        ? (r.daysOfWeek ?? []).map((d) => t(`weekday.${d}` as 'weekday.1')).join(', ')
        : t('reminder.timesADay', { count: r.times.length });
    return [kind, ...r.times.map((x) => x.time).sort()].join(', ');
  };

  const course = (r: TodayReminder) => {
    const left = daysLeft(r, today);
    if (left === null) return t('today.ongoing');
    return left === 0 ? t('today.ended') : t('today.daysLeft', { count: left });
  };

  const missed = (d: TodayDose<TodayReminder>) => d.state === 'missed' || d.state === 'skipped';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.fill}>
            <Text style={type.screenTitle}>{t('today.title')}</Text>
            <Text style={type.label}>{dateLine}</Text>
          </View>
          {doses.length > 0 && (
            <View style={styles.progress}>
              <Icon name="check" size={16} color={colors.success} strokeWidth={2.4} />
              <Text style={[type.secondaryStrong, styles.success]}>
                {t('today.progress', { taken: takenCount, total: doses.length })}
              </Text>
            </View>
          )}
        </View>

        {doses.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}>
              <Icon name="alarm" size={40} color={colors.primary} />
            </View>
            <Text style={[type.sectionTitle, styles.center]}>{t('today.empty')}</Text>
            <Button label={t('today.addReminder')} icon="plus" onPress={soon} />
          </View>
        ) : (
          <View style={styles.doses}>
            {doses.map((d) =>
              d === next ? (
                <View key={d.due + d.reminder.id} style={styles.hero}>
                  <Text style={[type.label, styles.heroSoft]}>{whenNext(d)}</Text>
                  <Text style={styles.heroTime}>{d.time}</Text>
                  <Text style={[type.sectionTitle, styles.white, styles.heroName]}>{d.reminder.name}</Text>
                  <Text style={[type.body, styles.heroSoft]}>
                    {t('medicine.amount', { count: d.dose, unit: unit(d.reminder) })}
                  </Text>
                  <View style={styles.heroButtons}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => take(d)}
                      style={({ pressed }) => [styles.heroTake, pressed && styles.pressed]}
                    >
                      <Icon name="check" size={22} color={colors.primary} strokeWidth={2.2} />
                      <Text style={[type.button, styles.primary]}>{t('today.take')}</Text>
                    </Pressable>
                    {d.state === 'due' && (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => later(d)}
                        style={({ pressed }) => [styles.heroLater, pressed && styles.pressed]}
                      >
                        <Text style={[type.button, styles.white]}>
                          {snoozed?.due === d.due ? t('today.snoozedTo', { time: snoozed.at }) : t('today.later')}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ) : (
                <View key={d.due + d.reminder.id} style={styles.dose}>
                  <Text style={[type.bodyMedium, styles.doseTime]}>{d.time}</Text>
                  <View style={styles.fill}>
                    <Text style={[type.cardTitle, d.state === 'later' && styles.muted]} numberOfLines={1}>
                      {t('today.dose', { name: d.reminder.name, count: d.dose, unit: unit(d.reminder) })}
                    </Text>
                    {d.state === 'taken' && d.at && (
                      <Text style={[type.secondaryStrong, styles.success]}>
                        {t('today.takenAt', { time: hhmm(new Date(d.at)) })}
                      </Text>
                    )}
                    {missed(d) && <Text style={[type.secondaryStrong, styles.danger]}>{t('today.missed')}</Text>}
                  </View>
                  {d.state === 'taken' ? (
                    <View style={[styles.circle, styles.circleTaken]}>
                      <Icon name="check" size={20} color={colors.white} strokeWidth={2.4} />
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('today.markTaken')}
                      onPress={() => take(d)}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.circle,
                        missed(d) ? styles.circleMissed : styles.circleOpen,
                        pressed && styles.pressed,
                      ]}
                    />
                  )}
                </View>
              ),
            )}
          </View>
        )}

        {plans.length > 0 && (
          <>
            <View style={styles.titleRow}>
              <Text style={type.sectionTitle}>{t('today.all')}</Text>
              <Pressable accessibilityRole="button" onPress={soon} style={styles.add}>
                <Icon name="plus" size={20} color={colors.primary} />
                <Text style={[type.button, styles.primary]}>{t('today.add')}</Text>
              </Pressable>
            </View>
            <View style={styles.card}>
              {plans.map((r, i) => (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  onPress={() => openReminder(r.medicineId)}
                  style={({ pressed }) => [styles.reminder, i > 0 && styles.divided, pressed && styles.pressed]}
                >
                  <View style={styles.fill}>
                    <View style={styles.reminderTop}>
                      <Text style={[type.cardTitle, styles.fill]} numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text style={type.secondary}>{course(r)}</Text>
                    </View>
                    <Text style={type.label}>{summary(r)}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('common.more')} onPress={soon} hitSlop={8}>
                    <View style={styles.vertical}>
                      <Icon name="dots" size={22} color={colors.inkMuted} />
                    </View>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  white: { color: colors.white },
  primary: { color: colors.primary },
  muted: { color: colors.inkMuted },
  success: { color: colors.success },
  danger: { color: colors.danger },
  pressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
  },
  empty: { alignItems: 'center', gap: spacing.xl, paddingTop: 96, paddingBottom: spacing.xxl },
  emptyMark: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doses: { marginTop: spacing.lg, gap: spacing.xs },
  dose: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  doseTime: { width: 52, color: colors.inkMuted },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  circleTaken: { backgroundColor: colors.success },
  circleMissed: { borderWidth: 2, borderColor: colors.danger },
  circleOpen: { borderWidth: 2, borderColor: colors.line },
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: spacing.lg, marginVertical: spacing.sm },
  heroSoft: { color: colors.white, opacity: 0.8 },
  heroTime: { ...type.hero, color: colors.white, fontSize: 48, lineHeight: 58 },
  heroName: { fontSize: 22, lineHeight: 28 },
  heroButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  heroTake: {
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
  heroLater: {
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.button,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  vertical: { transform: [{ rotate: '90deg' }] },
});
