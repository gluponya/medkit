import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { addCustomCategory } from '@/data/categories';
import { useDraft } from '@/features/add/draft';
import { OWN_ICONS, useCategoryPicks, type OwnCategoryFor } from '@/features/categories/categories';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Icon, type IconName } from '@/ui/Icon';
import { PressScale } from '@/ui/motion';
import { colors, radius, spacing } from '@/ui/theme';
import { type } from '@/ui/typography';

/**
 * Own category (docs/screens.md): a name and one of twelve icons. The new
 * category is kept on the phone for every cabinet and comes back picked,
 * in the add draft or on the Categories screen that opened it.
 */
export default function OwnCategoryScreen() {
  const t = useT();
  const { for: target } = useLocalSearchParams<{ for?: OwnCategoryFor }>();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<IconName>(OWN_ICONS[0]);
  const [saving, setSaving] = useState(false);
  const ready = name.trim() !== '' && !saving;

  const add = async () => {
    if (!ready) return;
    setSaving(true);
    try {
      const id = await addCustomCategory(name, icon);
      if (target === 'picks') {
        const picks = useCategoryPicks.getState();
        if (!picks.picked.includes(id)) picks.set([...picks.picked, id]);
      } else {
        const draft = useDraft.getState();
        if (!draft.categories.includes(id)) draft.set({ categories: [...draft.categories, id] });
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      back={t('categories.title')}
      title={t('ownCategory.title')}
      subtitle={t('ownCategory.subtitle')}
      button={{ label: t('ownCategory.add'), icon: 'plus', onPress: add, disabled: !ready }}
    >
      <TextInput
        autoFocus
        value={name}
        onChangeText={setName}
        placeholder={t('ownCategory.placeholder')}
        placeholderTextColor={colors.inkMuted}
        style={[type.input, styles.input]}
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={add}
      />
      <Text style={[type.label, styles.caption]}>{t('ownCategory.icon')}</Text>
      {ICON_ROWS.map((row) => (
        <View key={row[0]} style={styles.icons}>
          {row.map((choice) => (
            <PressScale
              key={choice}
              accessibilityRole="radio"
              accessibilityState={{ checked: choice === icon }}
              onPress={() => setIcon(choice)}
              outerStyle={styles.iconCell}
              style={[styles.icon, choice === icon && styles.iconPicked]}
            >
              <Icon name={choice} size={26} color={choice === icon ? colors.primary : colors.ink} />
            </PressScale>
          ))}
        </View>
      ))}
    </FormScreen>
  );
}

// Two rows of six, every tile the same size. Wrapping let a short last row
// stretch its tiles to the full width.
const PER_ROW = 6;
const ICON_ROWS = Array.from({ length: Math.ceil(OWN_ICONS.length / PER_ROW) }, (_, i) =>
  OWN_ICONS.slice(i * PER_ROW, (i + 1) * PER_ROW),
);

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
  caption: { marginTop: spacing.xl, marginBottom: 2, color: colors.inkMuted },
  icons: { flexDirection: 'row', gap: spacing.sm + 2, marginTop: spacing.sm + 2 },
  iconCell: { flex: 1 },
  icon: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  iconPicked: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 2 },
});
