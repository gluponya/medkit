import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { localDay } from '@/domain/expiry';
import { ExpiryPicker, ExpirySummary } from '@/features/add/ExpiryPicker';
import { expiryAnswered, useDraft } from '@/features/add/draft';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * The expiry of a medicine picked from the Register, opened from Confirm
 * medicine: the same month and year tiles as step 3 of adding by hand.
 */
export default function WhenScreen() {
  const t = useT();
  const name = useDraft((s) => s.name);
  const year = useDraft((s) => s.year);
  const month = useDraft((s) => s.month);
  const ready = useDraft(expiryAnswered);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={name || t('common.back')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.screenTitle}>{t('add.expiryTitle')}</Text>
        <Text style={[type.bodyMedium, styles.subtitle]}>{t('add.expirySubtitle')}</Text>
        <View style={styles.picker}>
          <ExpiryPicker />
        </View>
      </ScrollView>
      {year !== null && month !== null ? (
        <View style={styles.below}>
          <ExpirySummary year={year} month={month} today={localDay(new Date())} />
        </View>
      ) : null}
      <View style={styles.footer}>
        <Button label={t('common.done')} onPress={() => router.back()} disabled={!ready} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  subtitle: { color: colors.inkMuted, marginTop: spacing.xs },
  picker: { marginTop: spacing.xxl },
  below: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
