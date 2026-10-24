import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useCurrentCabinet } from '@/data/cabinets';
import { addMedicine } from '@/data/medicines';
import { CATEGORIES } from '@/domain/categories';
import { StepScreen } from '@/features/add/StepScreen';
import { draftExpires, useDraft } from '@/features/add/draft';
import { finishAdd } from '@/features/add/finish';
import { CATEGORY_ICON, CATEGORY_NAME } from '@/features/add/labels';
import { useT } from '@/i18n';
import { Tile } from '@/ui/Tile';
import { spacing } from '@/ui/theme';

/**
 * Step 5: what the medicine is for, so it is quick to find. Several can be
 * picked, none is fine. The button adds the medicine to the current cabinet.
 */
export default function CategoriesStep() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const draft = useDraft();
  const [saving, setSaving] = useState(false);

  const toggle = (category: string) =>
    draft.set({
      categories: draft.categories.includes(category)
        ? draft.categories.filter((c) => c !== category)
        : [...draft.categories, category],
    });

  const save = async () => {
    const expires = draftExpires(draft);
    if (!cabinet || !draft.form || expires === undefined) return;
    setSaving(true);
    try {
      const added = await addMedicine({
        cabinetId: cabinet.id,
        name: draft.name,
        form: draft.form,
        expires,
        quantity: draft.counted ? draft.quantity : null,
        categories: draft.categories,
      });
      finishAdd(added);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepScreen
      step={5}
      title={t('add.categoriesTitle')}
      subtitle={t('add.categoriesSubtitle')}
      next={{
        label: t('add.addTo', { cabinet: cabinet?.name ?? '' }),
        icon: 'plus',
        onPress: save,
        disabled: saving || !cabinet,
      }}
    >
      <View style={styles.grid}>
        {CATEGORIES.map((c) => (
          <View key={c} style={styles.cell}>
            <Tile
              label={t(CATEGORY_NAME[c])}
              icon={CATEGORY_ICON[c]}
              picked={draft.categories.includes(c)}
              check
              role="checkbox"
              onPress={() => toggle(c)}
              height={60}
            />
          </View>
        ))}
        <View style={styles.cell}>
          <Tile label={t('add.ownCategory')} icon="plus" dashed role="button" onPress={() => router.push('/soon')} height={60} />
        </View>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '47%', flexGrow: 1 },
});
