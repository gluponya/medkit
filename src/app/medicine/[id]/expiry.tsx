import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setPackExpiry, useMedicine } from '@/data/medicines';
import { expiryFromMonth, localDay } from '@/domain/expiry';
import { ExpiryPicker, ExpirySummary } from '@/features/add/ExpiryPicker';
import { useDraft } from '@/features/add/draft';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * «Вказати термін» on a pack added with «Не знаю»: the month and year tiles of
 * adding, without «Не знаю» this time. The picker works on the add draft, so
 * the draft is cleared on the way in and out.
 */
export default function PackExpiryScreen() {
  const t = useT();
  const { id, pack } = useLocalSearchParams<{ id: string; pack: string }>();
  const medicine = useMedicine(id);
  const year = useDraft((s) => s.year);
  const month = useDraft((s) => s.month);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    useDraft.getState().reset();
    return () => useDraft.getState().reset();
  }, []);

  const save = async () => {
    if (year === null || month === null) return;
    setSaving(true);
    try {
      await setPackExpiry(pack, expiryFromMonth(year, month));
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar label={medicine?.name ?? t('common.back')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.screenTitle}>{t('add.expiryTitle')}</Text>
        <Text style={[type.bodyMedium, styles.subtitle]}>{t('add.expirySubtitle')}</Text>
        <View style={styles.picker}>
          <ExpiryPicker unknown={false} />
        </View>
      </ScrollView>
      {year !== null && month !== null ? (
        <View style={styles.below}>
          <ExpirySummary year={year} month={month} today={localDay(new Date())} />
        </View>
      ) : null}
      <View style={styles.footer}>
        <Button label={t('common.done')} onPress={save} disabled={year === null || month === null || saving} />
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
