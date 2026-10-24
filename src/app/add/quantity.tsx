import { router } from 'expo-router';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { StepScreen } from '@/features/add/StepScreen';
import { useDraft } from '@/features/add/draft';
import { QUANTITY_TITLE, UNIT } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Tile } from '@/ui/Tile';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const PRESETS = [30, 60, 90, 120];

/**
 * Step 4: how many are in the pack, so the app knows when to buy more. The
 * number pad is up at once; a preset fills the field and puts it away. «Не
 * рахувати, просто є» leaves the pack uncounted.
 */
export default function QuantityStep() {
  const t = useT();
  const form = useDraft((s) => s.form) ?? 'other';
  const quantity = useDraft((s) => s.quantity);
  const counted = useDraft((s) => s.counted);
  const set = useDraft((s) => s.set);
  const ready = !counted || (quantity !== null && quantity > 0);

  const type_ = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 4);
    set({ quantity: digits === '' ? null : Number(digits), counted: true });
  };
  const preset = (n: number) => {
    set({ quantity: n, counted: true });
    Keyboard.dismiss();
  };
  const notCounted = () => {
    set({ quantity: null, counted: false });
    Keyboard.dismiss();
  };

  return (
    <StepScreen
      step={4}
      title={t(QUANTITY_TITLE[form])}
      subtitle={t('add.quantitySubtitle')}
      next={{ label: t('common.next'), onPress: () => router.push('/add/categories'), disabled: !ready }}
    >
      <View style={[styles.field, counted && styles.fieldOn]}>
        <TextInput
          autoFocus
          value={quantity === null ? '' : String(quantity)}
          onChangeText={type_}
          keyboardType="number-pad"
          placeholder={t('add.quantityPlaceholder')}
          placeholderTextColor={colors.inkMuted}
          style={[type.input, styles.input]}
        />
        <Text style={[type.bodyMedium, styles.unit]}>{t(UNIT[form])}</Text>
      </View>
      <View style={styles.row}>
        {PRESETS.map((n) => (
          <View key={n} style={styles.cell}>
            <Tile label={String(n)} picked={counted && quantity === n} onPress={() => preset(n)} height={52} />
          </View>
        ))}
      </View>
      <View style={styles.skip}>
        <Tile label={t('add.notCounted')} picked={!counted} onPress={notCounted} height={52} />
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
