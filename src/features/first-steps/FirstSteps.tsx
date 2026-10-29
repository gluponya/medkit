import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePrefs } from '@/data/prefs';
import { useSession } from '@/data/session';
import type { Step, StepId } from '@/domain/first-steps';
import { useT, type MessageKey } from '@/i18n';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const TITLE: Record<StepId, MessageKey> = {
  medicines: 'firstSteps.medicines',
  reminders: 'firstSteps.reminders',
  evidence: 'firstSteps.evidence',
};
const HINT: Record<StepId, MessageKey> = {
  medicines: 'firstSteps.medicinesHint',
  reminders: 'firstSteps.remindersHint',
  evidence: 'firstSteps.evidenceHint',
};

/**
 * «Перші кроки» (docs/screens.md, "First steps"): the current step open with its
 * buttons and «Пізніше», the others as one-line rows. A put-off row opens again
 * on a tap.
 */
export function FirstSteps({
  steps,
  medicineCount,
  onScan,
  onFind,
  onAddReminder,
}: {
  steps: Step[];
  medicineCount: number;
  onScan: () => void;
  onFind: () => void;
  onAddReminder: () => void;
}) {
  const t = useT();
  const putOff = useSession((s) => s.putOffStep);
  const reopen = useSession((s) => s.reopenStep);
  const markNoEvidence = usePrefs((s) => s.markNoEvidence);
  const setPrefs = usePrefs((s) => s.set);
  const settled = steps.filter((s) => s.state !== 'open').length;

  const row = (step: Step, number: number) => {
    if (step.current) {
      return (
        <View style={styles.open}>
          <View style={styles.head}>
            <View style={[styles.badge, styles.badgeCurrent]}>
              <Text style={[type.secondaryStrong, styles.white]}>{number}</Text>
            </View>
            <View style={styles.fill}>
              <Text style={type.stepTitle}>{t(TITLE[step.id])}</Text>
              <Text style={type.secondary}>{t(HINT[step.id])}</Text>
            </View>
          </View>
          {step.id === 'evidence' ? (
            // An answer, not a task: two buttons of equal weight and no «Пізніше».
            <View style={[styles.buttons, styles.pair]}>
              <View style={styles.fill}>
                <Button label={t('firstSteps.evidenceYes')} variant="secondary" onPress={() => setPrefs({ markNoEvidence: true })} height={48} />
              </View>
              <View style={styles.fill}>
                <Button label={t('firstSteps.evidenceNo')} variant="secondary" onPress={() => setPrefs({ markNoEvidence: false })} height={48} />
              </View>
            </View>
          ) : (
          <View style={styles.buttons}>
            {step.id === 'medicines' ? (
              <>
                <Button label={t('home.scan')} icon="scan" onPress={onScan} height={48} />
                <Button label={t('home.find')} icon="search" variant="secondary" onPress={onFind} height={48} />
              </>
            ) : (
              <Button label={t('firstSteps.addReminder')} icon="bell-plus" onPress={onAddReminder} height={48} />
            )}
            <Button label={t('common.later')} variant="outline" onPress={() => putOff(step.id)} height={48} />
          </View>
          )}
        </View>
      );
    }

    const subtitle =
      step.state === 'done'
        ? step.id === 'medicines'
          ? t('firstSteps.medicinesDone', { count: medicineCount })
          : step.id === 'reminders'
            ? t('firstSteps.remindersDone')
            : t(markNoEvidence ? 'firstSteps.evidenceOn' : 'firstSteps.evidenceOff')
        : step.state === 'later'
          ? t('firstSteps.putOff')
          : t(HINT[step.id]);
    const muted = step.state !== 'open';
    const onPress =
      step.state === 'later'
        ? () => reopen(step.id)
        : step.state === 'open' && step.id !== 'evidence'
          ? step.id === 'medicines'
            ? onScan
            : onAddReminder
          : undefined;

    return (
      <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={styles.closed}>
        {step.state === 'done' ? (
          <View style={[styles.badge, styles.badgeDone]}>
            <Icon name="check" size={16} color={colors.white} strokeWidth={2.5} />
          </View>
        ) : step.state === 'later' ? (
          <View style={[styles.badge, styles.badgeQuiet]}>
            <Icon name="clock" size={16} />
          </View>
        ) : (
          <View style={[styles.badge, styles.badgeQuiet]}>
            <Text style={type.secondaryStrong}>{number}</Text>
          </View>
        )}
        <View style={styles.fill}>
          <Text style={[type.cardTitle, muted && styles.muted]}>{t(TITLE[step.id])}</Text>
          <Text style={type.secondary} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {onPress ? <Icon name="chevron-right" size={18} /> : null}
      </Pressable>
    );
  };

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={type.sectionTitle}>{t('firstSteps.title')}</Text>
        <Text style={type.secondaryStrong}>{t('firstSteps.progress', { done: settled, total: steps.length })}</Text>
      </View>
      <View style={styles.card}>
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row(step, i + 1)}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const BADGE = 28;
const INDENT = spacing.md + BADGE + spacing.md;

const styles = StyleSheet.create({
  titleRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: INDENT },
  fill: { flex: 1 },
  open: { padding: spacing.md, paddingVertical: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  buttons: { marginTop: spacing.md + 2, paddingLeft: BADGE + spacing.md, gap: spacing.sm },
  pair: { flexDirection: 'row' },
  closed: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  badge: { width: BADGE, height: BADGE, borderRadius: BADGE / 2, alignItems: 'center', justifyContent: 'center' },
  badgeCurrent: { backgroundColor: colors.primary },
  badgeDone: { backgroundColor: colors.success },
  badgeQuiet: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.line },
  white: { color: colors.white },
  muted: { color: colors.inkMuted },
});
