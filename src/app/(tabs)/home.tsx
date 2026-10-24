import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentCabinet, useMedicineCount } from '@/data/cabinets';
import { useSession } from '@/data/session';
import { firstSteps, firstStepsFinished } from '@/domain/first-steps';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { FirstSteps } from '@/features/first-steps/FirstSteps';
import { Icon } from '@/ui/Icon';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Home (docs/screens.md): the cabinet's name as the switcher, search and add,
 * then what needs attention. For now only the empty states are drawn: the
 * first-steps card, and the plain empty cabinet once that is gone.
 */
export default function Home() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const medicineCount = useMedicineCount(cabinet?.id);
  const later = useSession((s) => s.stepsLater);
  const stepsFinished = useSession((s) => s.stepsFinished);
  const finishSteps = useSession((s) => s.finishSteps);

  const steps = cabinet
    ? firstSteps({ withIntake: cabinet.mode === 'with_intake', medicineCount, reminderCount: 0, later })
    : [];
  const finishedNow = cabinet !== undefined && cabinet !== null && firstStepsFinished(steps);
  useEffect(() => {
    if (finishedNow && !stepsFinished) finishSteps();
  }, [finishedNow, stepsFinished, finishSteps]);

  // The cabinets list is still loading, or the last one was just removed.
  if (!cabinet) return null;

  const soon = () => router.push('/soon');
  const showSteps = !stepsFinished && !finishedNow;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.switchCabinet')}
            onPress={soon}
            style={styles.switcher}
          >
            <Text style={type.screenTitle} numberOfLines={1}>
              {cabinet.name}
            </Text>
            <Icon name="chevron-down" size={22} />
          </Pressable>
          <View style={styles.headerButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.search')} onPress={soon} style={[styles.round, styles.roundSearch]}>
              <Icon name="search" size={20} color={colors.ink} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('home.add')} onPress={soon} style={[styles.round, styles.roundAdd]}>
              <Icon name="plus" size={22} color={colors.primary} />
            </Pressable>
          </View>
        </View>

        {showSteps ? (
          <>
            <FirstSteps steps={steps} medicineCount={medicineCount} onScan={soon} onFind={soon} onAddReminder={soon} />
            {medicineCount === 0 ? (
              <View style={styles.placeholder}>
                <Icon name="first-aid-kit" size={32} />
                <Text style={[type.bodyMedium, styles.muted]}>{t('home.placeholder')}</Text>
              </View>
            ) : null}
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
              <Button label={t('home.find')} icon="search" variant="secondary" onPress={soon} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

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
