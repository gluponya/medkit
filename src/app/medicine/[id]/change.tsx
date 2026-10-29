import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCabinets } from '@/data/cabinets';
import { sameMedicine, useKnownMedicines, useMedicine, usePackCount, usePacks } from '@/data/medicines';
import { useReminder } from '@/data/reminders';
import type { MedicineForm } from '@/domain/medicine';
import { formWord, packSizes } from '@/domain/register';
import { FORM_ICON, FORM_NAME, UNIT } from '@/features/add/labels';
import { cancelChange, finishChange, unitChanged, useChange, type ChangeStep } from '@/features/change/draft';
import { packsText, packText, reminderWhen } from '@/features/change/text';
import { shownStrength } from '@/features/medicine/strength';
import { useT } from '@/i18n';
import { BackBar } from '@/ui/BackBar';
import { Button } from '@/ui/Button';
import { Icon, type IconName } from '@/ui/Icon';
import { cardShadow, colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

type Part = { key: 'inn' | 'form' | 'strength'; text: string };

const same = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toLocaleLowerCase() === (b ?? '').trim().toLocaleLowerCase();

/**
 * Change medicine (docs/screens.md, J9): the old pick, grey, over the new one,
 * the words that differ struck out above and blue below, then what happens to
 * the packs and the reminder. A medicine the cabinet already has is joined
 * with «Об’єднати». A new unit asks the numbers again in the steps after it;
 * in the same unit, so do whole packs that hold what the new pick's packs never do.
 * For «Це інші ліки» on one pack, only that pack moves and the medicine stays.
 */
export default function ChangeScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const target = useChange((s) => s.target);
  const packId = useChange((s) => s.packId);
  const medicine = useMedicine(id);
  const allPacks = usePacks(id);
  // One pack moving: the questions and the lines are about it alone.
  const moving = packId ? allPacks.find((p) => p.id === packId) : undefined;
  const packs = moving ? [moving] : allPacks;
  const rest = allPacks.filter((p) => p !== moving);
  const reminder = useReminder(id) ?? null;
  const cabinet = useCabinets()?.find((c) => c.id === medicine?.cabinetId);
  const known = useKnownMedicines(cabinet?.id).filter((m) => m.id !== id);
  const merge = target ? sameMedicine(known, target.register?.id ?? '', target.name) : null;
  const mergeMedicine = useMedicine(merge?.id ?? '');
  const mergePacks = usePackCount(merge?.id);
  const mergeReminder = useReminder(merge?.id ?? '') ?? null;
  const [saving, setSaving] = useState(false);

  // The flow was finished or dropped under the screen.
  if (!medicine || !target || (packId && !moving)) return null;

  const formText = (form: MedicineForm, text?: string) =>
    form === 'other' ? (formWord(text ?? '') ?? t(FORM_NAME.other).toLocaleLowerCase()) : t(FORM_NAME[form]).toLocaleLowerCase();
  const parts = (inn: string | null, form: MedicineForm, strength: string | null, text?: string): Part[] =>
    [
      { key: 'inn' as const, text: inn ?? '' },
      { key: 'form' as const, text: formText(form, text) },
      { key: 'strength' as const, text: shownStrength(strength) ?? '' },
    ].filter((p) => p.text !== '');

  const entry = target.register;
  const oldParts = parts(medicine.inn, medicine.form ?? 'other', medicine.strength);
  const newParts = parts(entry?.inn ?? null, target.form, entry?.strength ?? null, entry?.formText);
  const textOf = (list: Part[], key: Part['key']) => list.find((p) => p.key === key)?.text;

  // Into a medicine already there, the numbers must fit that one's unit.
  const toForm = mergeMedicine?.form ?? target.form;
  const changed = unitChanged(medicine.form, toForm);
  const reminderMoves = !moving && reminder !== null && !(merge && mergeReminder);
  // 100 tablets left from the wrong pick, where the new one comes by 10 or 20:
  // a whole pack must be one of its sizes, an opened one no more than the largest.
  const sizes = entry ? packSizes(entry.formText, entry.form) : [];
  const misfit = (q: number, opened: boolean) =>
    sizes.length > 0 && (q > Math.max(...sizes) || (!opened && !sizes.includes(q)));
  const steps: ChangeStep[] = changed
    ? [
        ...packs.filter((p) => p.quantity !== null).map((pack) => ({ kind: 'pack' as const, pack })),
        ...(reminder && reminderMoves ? [{ kind: 'dose' as const, reminder }] : []),
      ]
    : packs
        .filter((p) => p.quantity !== null && misfit(p.quantity, p.openedAt !== null))
        .map((pack) => ({ kind: 'pack' as const, pack }));
  const hasPackSteps = steps.some((s) => s.kind === 'pack');
  const hasDoseStep = steps.some((s) => s.kind === 'dose');
  const unit = t(UNIT[toForm]);
  const unitNote = !changed
    ? hasPackSteps
      ? 'change.sizePacks'
      : null
    : hasPackSteps && hasDoseStep
      ? 'change.unitAll'
      : hasPackSteps
        ? 'change.unitPacks'
        : hasDoseStep
          ? 'change.unitDose'
          : null;

  const go = async () => {
    useChange.getState().set({ mergeInto: merge?.id ?? null, unitChanged: changed, steps, quantities: {}, dose: null });
    if (steps.length > 0) {
      router.push({ pathname: '/medicine/[id]/change-step', params: { id, step: '1' } });
      return;
    }
    setSaving(true);
    try {
      await finishChange();
    } finally {
      setSaving(false);
    }
  };

  const lines: { icon: IconName; tone: string; title: string; text: string }[] = [];
  if (moving) {
    lines.push(
      merge
        ? { icon: 'arrow-merge', tone: colors.primary, title: t('change.packJoins', { name: merge.name }), text: t('change.packsTotal', { count: 1 + mergePacks }) }
        : { icon: 'circle-check', tone: colors.success, title: t('change.packKeeps'), text: packText(t, moving, t(UNIT[medicine.form ?? 'other'])) },
      {
        icon: 'circle-check',
        tone: colors.success,
        title: t('change.oldStays', { name: medicine.name }),
        text: reminder ? t('change.withReminder', { packs: packsText(t, rest) }) : packsText(t, rest),
      },
    );
  } else if (packs.length > 0) {
    lines.push(
      merge
        ? { icon: 'arrow-merge', tone: colors.primary, title: t('change.packsMove'), text: t('change.packsTotal', { count: packs.length + mergePacks }) }
        : { icon: 'circle-check', tone: colors.success, title: t('change.packsStay'), text: packsText(t, packs) },
    );
  }
  if (reminder && !moving) {
    lines.push(
      !merge
        ? { icon: 'circle-check', tone: colors.success, title: t('change.reminderStays'), text: reminderWhen(t, reminder) }
        : mergeReminder
          ? { icon: 'circle-check', tone: colors.success, title: t('change.reminderThere', { name: merge.name }), text: reminderWhen(t, mergeReminder) }
          : { icon: 'arrow-merge', tone: colors.primary, title: t('change.reminderMoves'), text: reminderWhen(t, reminder) },
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <BackBar
        label={t('change.back')}
        right={
          <Pressable accessibilityRole="button" onPress={cancelChange} hitSlop={8}>
            <Text style={[type.cardTitle, styles.barText]}>{t('common.cancel')}</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={type.screenTitle}>{moving ? t('change.packOther') : t('change.title')}</Text>
        <Text style={[type.bodyMedium, styles.muted, styles.subtitle]}>{t('change.subtitle')}</Text>

        <View style={[styles.card, styles.was]}>
          <Text style={type.secondary}>{moving ? packText(t, moving, t(UNIT[medicine.form ?? 'other']), true) : t('change.was')}</Text>
          <View style={styles.head}>
            <View style={[styles.mark, styles.markWas]}>
              <Icon name={FORM_ICON[medicine.form ?? 'other']} size={26} color={colors.inkMuted} />
            </View>
            <View style={styles.fill}>
              <Text style={[type.sectionTitle, styles.muted, styles.name]}>{medicine.name}</Text>
              <Details parts={oldParts} differs={(p) => !same(p.text, textOf(newParts, p.key))} style={styles.struck} />
            </View>
          </View>
        </View>

        <View style={styles.arrow}>
          <Icon name="arrow-down" size={20} color={colors.primary} />
        </View>

        <View style={[styles.card, styles.becomes]}>
          <View style={styles.labelRow}>
            <Text style={[type.secondaryStrong, styles.primary]}>{t('change.becomes')}</Text>
            {merge && cabinet ? (
              <View style={styles.chip}>
                <Icon name="stack" size={16} color={colors.primary} />
                <Text style={[type.secondaryStrong, styles.primary]}>{t('search.inCabinet', { cabinet: cabinet.name })}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.head}>
            <View style={[styles.mark, styles.markNew]}>
              <Icon name={FORM_ICON[target.form]} size={26} color={colors.primary} />
            </View>
            <View style={styles.fill}>
              <Text style={[type.sectionTitle, styles.name]}>{target.name}</Text>
              <Details parts={newParts} differs={(p) => !same(p.text, textOf(oldParts, p.key))} style={styles.marked} />
            </View>
          </View>
        </View>

        {lines.length > 0 ? (
          <View style={[styles.card, styles.lines]}>
            {lines.map((line, i) => (
              <View key={line.title}>
                {i > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.line}>
                  <Icon name={line.icon} size={24} color={line.tone} />
                  <View style={styles.fill}>
                    <Text style={type.cardTitle}>{line.title}</Text>
                    <Text style={type.label}>{line.text}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {merge && !moving ? <Note text={t('change.mergeNote', { name: medicine.name })} /> : null}
        {unitNote ? <Note text={t(unitNote, { unit })} /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={merge ? t('change.merge') : moving ? t('change.move') : t('change.change')} onPress={() => void go()} disabled={saving} />
      </View>
    </SafeAreaView>
  );
}

/** «Ібупрофен, пігулки, 200 мг», the parts that differ in their own style. */
function Details({ parts, differs, style }: { parts: Part[]; differs: (p: Part) => boolean; style: object }) {
  if (parts.length === 0) return null;
  return (
    <Text style={type.label}>
      {parts.map((p, i) => {
        const text = i === 0 ? p.text.charAt(0).toLocaleUpperCase() + p.text.slice(1) : p.text;
        return (
          <Text key={p.key}>
            {i > 0 ? ', ' : ''}
            <Text style={differs(p) ? style : undefined}>{text}</Text>
          </Text>
        );
      })}
    </Text>
  );
}

function Note({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <Icon name="info" size={20} color={colors.inkMuted} />
      <Text style={[type.label, styles.fill]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xxl },
  fill: { flex: 1 },
  muted: { color: colors.inkMuted },
  primary: { color: colors.primary },
  barText: { color: colors.primary, fontSize: 17 },
  subtitle: { marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    ...cardShadow,
  },
  was: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surfaceSoft },
  becomes: { padding: spacing.lg, borderWidth: 2, borderColor: colors.primary },
  arrow: {
    alignSelf: 'center',
    width: 36,
    height: 36,
    marginVertical: -spacing.sm,
    zIndex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    height: 28,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  mark: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  markWas: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  markNew: { backgroundColor: colors.primarySoft },
  name: { marginBottom: 2 },
  struck: { textDecorationLine: 'line-through' },
  marked: { color: colors.primary, fontFamily: type.stepTitle.fontFamily },
  lines: { marginTop: spacing.lg },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  divider: { height: 1, backgroundColor: colors.line, marginLeft: 56 },
  note: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
