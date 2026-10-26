import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { usePacks } from '@/data/medicines';
import { stockOf } from '@/domain/stock';
import { UNIT } from '@/features/add/labels';
import { useMedicineEdit } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Icon, type IconName } from '@/ui/Icon';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/** The most that can be typed when the stock is not counted. */
const NO_STOCK_MAX = 999;

/**
 * «Попередити, коли мало» of «Деталі»: a number with −/+ around it. It
 * starts from the warning set before, or else from what is in the cabinet
 * now, and never goes over that: a warning above the stock would ring at
 * once. Zero is no warning.
 */
export default function LowStockScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const stock = stockOf(usePacks(id));
  const max = stock && stock > 0 ? stock : NO_STOCK_MAX;
  const [value, setValue] = useState<number | null>(null);

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields) return null;

  const current = Math.min(value ?? fields.lowStockThreshold ?? stock ?? 0, max);
  const unit = t(UNIT[fields.form ?? 'other']);
  const change = (next: number) => setValue(Math.max(0, Math.min(next, max)));
  const done = () => {
    set({ lowStockThreshold: current === 0 ? null : current });
    router.back();
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t('details.lowStock')}
      subtitle={t('details.lowStockHint')}
      button={{ label: t('common.done'), onPress: done }}
    >
      <View style={styles.stepper}>
        <Step icon="minus" label={t('medicine.less')} disabled={current === 0} onPress={() => change(current - 1)} />
        <View style={styles.middle}>
          <TextInput
            value={String(current)}
            onChangeText={(text) => change(Number(text.replace(/\D/g, '').slice(0, 4) || 0))}
            keyboardType="number-pad"
            selectTextOnFocus
            style={styles.number}
          />
          <Text style={[type.bodyMedium, styles.muted]}>{current === 0 ? t('details.noWarning') : unit}</Text>
        </View>
        <Step icon="plus" label={t('medicine.more')} disabled={current >= max} onPress={() => change(current + 1)} />
      </View>
      {stock !== null ? (
        <Text style={[type.bodyMedium, styles.muted, styles.have]}>{t('details.lowStockHave', { count: stock, unit })}</Text>
      ) : null}
    </FormScreen>
  );
}

function Step({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.step, disabled && styles.disabled, pressed && styles.pressed]}
    >
      <Icon name={icon} size={26} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  middle: { flex: 1, alignItems: 'center' },
  number: { fontSize: 44, fontWeight: '700', color: colors.ink, textAlign: 'center', minWidth: 120, padding: 0 },
  muted: { color: colors.inkMuted },
  have: { marginTop: spacing.xl, textAlign: 'center' },
  step: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
