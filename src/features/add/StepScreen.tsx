import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { FitTitle } from '@/ui/FitTitle';
import { Icon, type IconName } from '@/ui/Icon';
import { colors, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

import { useDraft } from './draft';

export const STEPS = 5;

/**
 * One step of «Додати вручну»: «Назад» and «Скасувати», the progress bar,
 * «Крок N з 5», the question, the answer, and the button at the bottom.
 */
export function StepScreen({
  step,
  title,
  subtitle,
  children,
  next,
  below,
}: {
  step: number;
  title: string;
  subtitle: string;
  children: ReactNode;
  next: { label: string; onPress: () => void; disabled?: boolean; icon?: IconName };
  /** Pinned over the button, outside the scroll: the expiry summary. */
  below?: ReactNode;
}) {
  const t = useT();
  const cancel = () => {
    useDraft.getState().reset();
    router.dismissTo('/home');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.barButton} hitSlop={8}>
          <Icon name="chevron-left" size={24} color={colors.primary} strokeWidth={2} />
          <Text style={styles.barText}>{t('common.back')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={cancel} style={styles.barButton} hitSlop={8}>
          <Text style={styles.barText}>{t('common.cancel')}</Text>
        </Pressable>
      </View>

      <View style={styles.progress}>
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
      <Text style={[type.secondary, styles.counter]}>{t('add.step', { step, total: STEPS })}</Text>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FitTitle>{title}</FitTitle>
          <Text style={[type.bodyMedium, styles.subtitle]}>{subtitle}</Text>
          <View style={styles.answer}>{children}</View>
        </ScrollView>
        {below ? <View style={styles.below}>{below}</View> : null}
        <View style={styles.footer}>
          <Button label={next.label} icon={next.icon} onPress={next.onPress} disabled={next.disabled} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  barButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  barText: { ...type.cardTitle, color: colors.primary, fontSize: 17 },
  progress: { flexDirection: 'row', gap: spacing.sm - 2, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.line },
  segmentDone: { backgroundColor: colors.primary },
  counter: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  subtitle: { color: colors.inkMuted, marginTop: spacing.xs },
  answer: { marginTop: spacing.xxl },
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
