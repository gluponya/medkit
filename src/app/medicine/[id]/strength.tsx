import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useMedicineEdit } from '@/features/medicine/edit';
import { ALL_STRENGTH_UNITS, cleanAmount, formatStrength, parseStrength, STRENGTH_UNITS } from '@/features/medicine/strength';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Tile } from '@/ui/Tile';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * The strength of «Деталі»: the number is typed, the unit is a tile under it,
 * the likeliest for the form first and picked, so a unit cannot be misspelt.
 * A real unit the list lacks stays as one more tile. An empty
 * number and «Готово» clear the strength.
 */
export default function StrengthScreen() {
  const t = useT();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const units = STRENGTH_UNITS[fields?.form ?? 'other'].map((key) => t(key));
  const [start] = useState(() => parseStrength(fields?.strength ?? ''));
  // A unit outside this form's list is kept when it is a real one (another
  // form's, or a combination from the Register, «мг/12,5 мг»); one typed
  // wrong before («мгаа») is dropped.
  const real = (u: string) => ALL_STRENGTH_UNITS.some((key) => t(key) === u) || /\d/.test(u);
  const extra = start.unit && !units.includes(start.unit) && real(start.unit) ? start.unit : null;
  const offered = extra ? [...units, extra] : units;
  const [amount, setAmount] = useState(start.amount);
  const [unit, setUnit] = useState(start.unit && offered.includes(start.unit) ? start.unit : units[0]);

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields) return null;

  const done = () => {
    set({ strength: amount === '' ? '' : formatStrength(amount.replace(/,$/, ''), unit) });
    router.back();
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t('details.strength')}
      subtitle={t('details.strengthHint')}
      button={{ label: t('common.done'), onPress: done }}
    >
      <View style={styles.field}>
        <TextInput
          autoFocus
          value={amount}
          onChangeText={(text) => setAmount(cleanAmount(text))}
          keyboardType="decimal-pad"
          placeholder="200"
          placeholderTextColor={colors.inkMuted}
          style={[type.input, styles.input]}
        />
        <Text style={[type.bodyMedium, styles.unit]}>{unit}</Text>
      </View>
      <View style={styles.units}>
        {offered.map((u) => (
          <View key={u} style={styles.cell}>
            <Tile label={u} picked={u === unit} onPress={() => setUnit(u)} height={48} />
          </View>
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  input: { flex: 1, height: '100%', fontSize: 18 },
  unit: { color: colors.inkMuted, fontSize: 17 },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  cell: { width: '31%' },
});
