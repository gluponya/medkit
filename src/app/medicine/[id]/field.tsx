import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { useMedicineEdit, type DetailsField } from '@/features/medicine/edit';
import { useT, type MessageKey } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

const TITLE: Record<DetailsField, MessageKey> = {
  name: 'details.name',
  manufacturer: 'details.manufacturer',
};

/** A name begins with a capital, however it was typed: «фармак» is «Фармак». */
const capitalized = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * One free-text row of «Деталі», the name or the manufacturer, and «Готово»,
 * which puts the answer back into the edit. Only the name cannot be left
 * empty. The strength, the substance and the low-stock warning have screens
 * of their own, where only real answers can be given.
 */
export default function DetailsFieldScreen() {
  const t = useT();
  const { field } = useLocalSearchParams<{ id: string; field: DetailsField }>();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const [value, setValue] = useState(() => (fields && field in TITLE ? fields[field] : ''));

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields || !(field in TITLE)) return null;

  const ready = field !== 'name' || value.trim() !== '';
  const done = () => {
    if (!ready) return;
    const text = value.trim();
    set({ [field]: field === 'manufacturer' ? capitalized(text) : text });
    router.back();
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t(TITLE[field])}
      subtitle={t('details.asOnBox')}
      button={{ label: t('common.done'), onPress: done, disabled: !ready }}
    >
      <TextInput
        autoFocus
        value={value}
        onChangeText={setValue}
        autoCapitalize="sentences"
        placeholder={t('details.empty')}
        placeholderTextColor={colors.inkMuted}
        style={[type.input, styles.input]}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={done}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 58,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 18,
  },
});
