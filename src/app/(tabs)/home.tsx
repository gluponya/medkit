import { router, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCurrentCabinet, useMedicineCount } from '@/data/cabinets';
import { usePackRows } from '@/data/medicines';
import { useReminderCount } from '@/data/reminders';
import { useSession } from '@/data/session';
import { useCabinetReminders, useDayIntakes } from '@/data/today';
import { localDay } from '@/domain/expiry';
import { firstSteps, firstStepsFinished } from '@/domain/first-steps';
import { overview } from '@/domain/overview';
import { nextDose, todayDoses } from '@/domain/today';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Switcher } from '@/features/cabinets/Switcher';
import { FirstSteps } from '@/features/first-steps/FirstSteps';
import { MedicineList } from '@/features/home/MedicineList';
import { hhmm, NextDoseCard, useNow } from '@/features/today/NextDoseCard';
import { Hint } from '@/ui/Hint';
import { Icon } from '@/ui/Icon';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Home (docs/screens.md): the cabinet's name as the switcher, search and add,
 * then what needs attention and every medicine. Before the first medicine it
 * shows the first-steps card, or the plain empty cabinet once that is gone.
 */
export default function Home() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const medicineCount = useMedicineCount(cabinet?.id);
  const rows = usePackRows(cabinet?.id);
  const reminderCount = useReminderCount(cabinet?.id);
  const warningDays = cabinet?.expiryWarningDays ?? 30;
  const list = useMemo(() => overview(rows, localDay(new Date()), warningDays), [rows, warningDays]);
  const later = useSession((s) => s.stepsLater);
  const stepsFinished = useSession((s) => s.stepsFinished);
  const finishSteps = useSession((s) => s.finishSteps);
  const [switching, setSwitching] = useState(false);
  const hintDue = useSession((s) => s.switcherHint === 'due');
  const closeHint = useSession((s) => s.closeSwitcherHint);
  // Where the title sits, for the hint's arrow: the header in the scroll
  // content, under the status bar, and the switcher inside the header.
  const insets = useSafeAreaInsets();
  const [header, setHeader] = useState<LayoutRectangle>();
  const [title, setTitle] = useState<LayoutRectangle>();
  // The next dose, as on Today, in a cabinet that keeps intake.
  const now = useNow();
  const today = localDay(now);
  const time = hhmm(now);
  const plans = useCabinetReminders(cabinet?.id);
  const marks = useDayIntakes(cabinet?.id, today);
  const doses = useMemo(() => todayDoses(plans ?? [], marks, today, time), [plans, marks, today, time]);
  const next = cabinet?.mode === 'with_intake' ? nextDose(doses) : null;
  // «Ще N»: the day's doses still ahead after this one.
  const ahead = doses.filter((d) => d !== next && (d.state === 'due' || d.state === 'later')).length;

  const steps = cabinet
    ? firstSteps({ withIntake: cabinet.mode === 'with_intake', medicineCount, reminderCount, later })
    : [];
  const finishedNow = cabinet !== undefined && cabinet !== null && firstStepsFinished(steps);
  useEffect(() => {
    if (finishedNow && !stepsFinished) finishSteps();
  }, [finishedNow, stepsFinished, finishSteps]);

  // The cabinets list is still loading, or the last one was just removed.
  if (!cabinet) return null;

  const soon = () => router.push('/soon');
  const find = () => router.push('/add/scan');
  const showSteps = !stepsFinished && !finishedNow;
  // The typed-routes generator lists /medicine/[id] as a static path on Windows, so it is cast.
  const openMedicine = (id: string) => router.push(`/medicine/${id}` as Href);
  const nextCard = next ? (
    <NextDoseCard dose={next} time={time} more={{ count: ahead, onPress: () => router.push('/today') }} />
  ) : null;
  const medicineList = <MedicineList overview={list} onOpen={openMedicine} onTags={() => router.push('/find')} />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!hintDue}>
        <View style={styles.header} onLayout={(e) => setHeader(e.nativeEvent.layout)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.switchCabinet')}
            onPress={() => setSwitching(true)}
            onLayout={(e) => setTitle(e.nativeEvent.layout)}
            style={styles.switcher}
          >
            <Text style={type.screenTitle} numberOfLines={1}>
              {cabinet.name}
            </Text>
            <Icon name="chevron-down" size={22} />
          </Pressable>
          <View style={styles.headerButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.search')} onPress={() => router.push('/find')} style={[styles.round, styles.roundSearch]}>
              <Icon name="search" size={20} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.add')} onPress={find} style={[styles.round, styles.roundAdd]}>
              <Icon name="plus" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {showSteps ? (
          <>
            <FirstSteps
              steps={steps}
              medicineCount={medicineCount}
              onScan={soon}
              onFind={find}
              onAddReminder={() => router.push('/pick-medicine')}
            />
            {medicineCount === 0 ? (
              <View style={styles.placeholder}>
                <Icon name="first-aid-kit" size={32} />
                <Text style={[type.bodyMedium, styles.muted]}>{t('home.placeholder')}</Text>
              </View>
            ) : (
              <>
                {nextCard}
                {medicineList}
              </>
            )}
          </>
        ) : medicineCount === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyMark}>
              <Icon name="first-aid-kit" size={32} color={colors.primary} />
            </View>
            <Text style={[type.sectionTitle, styles.emptyTitle]}>{t('home.emptyTitle')}</Text>
            <Text style={[type.bodyMedium, styles.muted, styles.center]}>{t('home.emptyText')}</Text>
            <View style={styles.emptyButtons}>
              <Button label={t('home.scan')} icon="scan" onPress={soon} />
              <Button label={t('home.find')} icon="search" variant="secondary" onPress={find} />
            </View>
          </View>
        ) : (
          <>
            {nextCard}
            {medicineList}
          </>
        )}
      </ScrollView>
      {/* The hint comes on the Home of the second cabinet, just made, so the list is at its top. */}
      {hintDue && header && title ? (
        <Hint
          text={t('home.switcherHint')}
          top={insets.top + header.y + header.height + spacing.xs}
          arrowLeft={Math.min(title.width / 2, HINT_ARROW_MAX)}
          onClose={closeHint}
        />
      ) : null}
      {switching ? <Switcher currentId={cabinet.id} onClose={() => setSwitching(false)} /> : null}
    </SafeAreaView>
  );
}

/** A long cabinet name: the arrow stays near its start, over the bubble. */
const HINT_ARROW_MAX = 140;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  headerButtons: { flexDirection: 'row', gap: spacing.sm },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  roundSearch: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  roundAdd: { backgroundColor: colors.primarySoft },
  placeholder: { marginTop: spacing.xxl, alignItems: 'center', gap: spacing.sm },
  muted: { color: colors.inkMuted },
  center: { textAlign: 'center' },
  empty: { marginTop: 96, alignItems: 'center' },
  emptyMark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { marginTop: spacing.lg, fontSize: 20, marginBottom: spacing.xs },
  emptyButtons: { alignSelf: 'stretch', marginTop: spacing.xxl, gap: spacing.sm },
});
