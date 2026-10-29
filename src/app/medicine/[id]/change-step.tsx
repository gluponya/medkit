import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { useMedicine } from '@/data/medicines';
import { packSizes } from '@/domain/register';
import { StepScreen } from '@/features/add/StepScreen';
import { QUANTITY_TITLE, UNIT } from '@/features/add/labels';
import { cancelChange, finishChange, useChange } from '@/features/change/draft';
import { monthText, reminderAt } from '@/features/change/text';
import { useT, type MessageKey } from '@/i18n';
import { Tile } from '@/ui/Tile';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** Five digits is more than any pack holds, as in adding. */
const MAX_QUANTITY = 99999;

/** Tiles under the field, by unit: what a pack usually holds, what one dose usually is. */
const PACK_PRESETS: Record<string, number[]> = {
  'unit.ml': [50, 100, 150, 200],
  'unit.grams': [15, 25, 50, 100],
  'unit.sachets': [6, 10, 12, 20],
};
const DOSE_PRESETS: Record<string, number[]> = {
  'unit.ml': [2.5, 5, 7.5, 10],
  'unit.grams': [1, 2, 5, 10],
};

/**
 * The questions after «Змінити» when the unit changed (docs/journeys.md, J9):
 * one per screen, each pack's quantity in the new unit («Не рахувати, просто
 * є» allowed), then the reminder's dose. The last one saves the change.
 */
export default function ChangeStepScreen() {
  const t = useT();
  const { id, step: stepParam } = useLocalSearchParams<{ id: string; step: string }>();
  const steps = useChange((s) => s.steps);
  const mergeInto = useChange((s) => s.mergeInto);
  const moving = useChange((s) => s.packId !== null);
  const target = useChange((s) => s.target);
  const formOnly = useChange((s) => s.formOnly);
  const into = useMedicine(mergeInto ?? '');
  const n = Number(stepParam);
  const step = steps[n - 1];
  const quantities = useChange((s) => s.quantities);
  const dose = useChange((s) => s.dose);
  const set = useChange((s) => s.set);
  // The dose as typed, so «3,» stays on screen while the next digit comes.
  const [doseText, setDoseText] = useState(dose === null ? '' : String(dose).replace('.', ','));
  const [saving, setSaving] = useState(false);

  // The flow was finished or dropped under the screen.
  if (!step || !target) return null;

  const form = into?.form ?? target.form;
  const unitKey = UNIT[form];
  const unit = t(unitKey);
  const last = n === steps.length;

  const next = async () => {
    if (!last) {
      router.push({ pathname: '/medicine/[id]/change-step', params: { id, step: String(n + 1) } });
      return;
    }
    setSaving(true);
    try {
      await finishChange();
    } finally {
      setSaving(false);
    }
  };
  const nextButton = (ready: boolean) => ({
    label: last
      ? mergeInto
        ? t('change.merge')
        : moving
          ? t('change.move')
          : formOnly
            ? t('common.save')
            : t('change.change')
      : t('common.next'),
    onPress: () => void next(),
    disabled: !ready || saving,
  });

  if (step.kind === 'pack') {
    const { pack } = step;
    const answered = pack.id in quantities;
    const quantity = quantities[pack.id] ?? null;
    const counted = !answered || quantity !== null;
    const setQuantity = (value: number | null) => set({ quantities: { ...quantities, [pack.id]: value } });
    const typeQuantity = (text: string) => {
      const digits = text.replace(/\D/g, '').slice(0, 5);
      if (digits === '') {
        const rest = { ...quantities };
        delete rest[pack.id];
        set({ quantities: rest });
        return;
      }
      setQuantity(Math.min(MAX_QUANTITY, Number(digits)));
    };
    const pick = (value: number | null) => {
      setQuantity(value);
      Keyboard.dismiss();
    };
    const subtitle = [
      pack.expires === null
        ? t('change.packUnknown')
        : t('change.packOf', { until: t('home.until', { date: monthText(pack.expires) }) }),
      pack.openedAt ? t('medicine.opened') : t('medicine.whole'),
    ].join(', ');
    // The new pick's own pack sizes when the Register lists them.
    const sizes = target.register ? packSizes(target.register.formText, target.register.form).slice(0, 4) : [];
    const presets = sizes.length > 0 ? sizes : (PACK_PRESETS[unitKey] ?? [10, 20, 30, 60]);
    const title = QUANTITY_TITLE[form].replace('add.quantityTitle', 'change.packTitle') as MessageKey;

    return (
      <StepScreen
        key={pack.id}
        step={n}
        total={steps.length}
        onCancel={cancelChange}
        title={t(title)}
        subtitle={subtitle}
        next={nextButton(answered && quantity !== 0)}
      >
        <View style={[styles.field, answered && counted && styles.fieldOn]}>
          <TextInput
            autoFocus
            value={quantity === null ? '' : String(quantity)}
            onChangeText={typeQuantity}
            keyboardType="number-pad"
            placeholder={t('add.quantityPlaceholder')}
            placeholderTextColor={colors.inkMuted}
            style={[type.input, styles.input]}
          />
          <Text style={[type.bodyMedium, styles.unit]}>{unit}</Text>
        </View>
        <View style={styles.row}>
          {presets.map((value) => (
            <View key={value} style={styles.cell}>
              <Tile label={String(value)} picked={quantity === value} onPress={() => pick(value)} height={52} />
            </View>
          ))}
        </View>
        <View style={styles.skip}>
          <Tile label={t('add.notCounted')} picked={answered && !counted} onPress={() => pick(null)} height={52} />
        </View>
      </StepScreen>
    );
  }

  const typeDose = (text: string) => {
    // Digits and one decimal comma: «3,5».
    const clean = text.replace('.', ',').replace(/[^\d,]/g, '');
    const [whole, ...rest] = clean.split(',');
    const shown = rest.length > 0 ? `${whole.slice(0, 3)},${rest.join('').slice(0, 2)}` : whole.slice(0, 3);
    setDoseText(shown);
    const value = Number(shown.replace(',', '.'));
    set({ dose: shown === '' || shown === ',' || !Number.isFinite(value) ? null : value });
  };
  const pickDose = (value: number) => {
    setDoseText(String(value).replace('.', ','));
    set({ dose: value });
    Keyboard.dismiss();
  };

  return (
    <StepScreen
      key="dose"
      step={n}
      total={steps.length}
      onCancel={cancelChange}
      title={t('change.doseTitle', { unit })}
      subtitle={t('change.doseOf', { when: reminderAt(t, step.reminder) })}
      next={nextButton(dose !== null && dose > 0)}
    >
      <View style={[styles.field, dose !== null && styles.fieldOn]}>
        <TextInput
          autoFocus
          value={doseText}
          onChangeText={typeDose}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.inkMuted}
          style={[type.input, styles.input]}
        />
        <Text style={[type.bodyMedium, styles.unit]}>{unit}</Text>
      </View>
      <View style={styles.row}>
        {(DOSE_PRESETS[unitKey] ?? [1, 2, 3, 4]).map((value) => (
          <View key={value} style={styles.cell}>
            <Tile label={String(value).replace('.', ',')} picked={dose === value} onPress={() => pickDose(value)} height={52} />
          </View>
        ))}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  fieldOn: { borderWidth: 2, borderColor: colors.primary },
  input: { flex: 1, height: '100%', fontSize: 18 },
  unit: { color: colors.inkMuted, fontSize: 17 },
  row: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.md },
  cell: { flex: 1 },
  skip: { marginTop: spacing.md },
});
