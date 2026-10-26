import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { setMedicineCategories, useMedicine, useMedicineCategories } from '@/data/medicines';
import {
  CategoryGrid,
  openOwnCategory,
  toggled,
  useCategoryPicks,
} from '@/features/categories/categories';
import { sameSet, useMedicineEdit } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';

/**
 * Categories of a saved medicine (docs/screens.md, "Categories"). From
 * «Деталі» the picks go back into its edit; from a chip on the medicine
 * «Зберегти» writes them at once. «Зберегти» waits for a change.
 */
export default function MedicineCategoriesScreen() {
  const t = useT();
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const fromDetails = from === 'details';
  const medicine = useMedicine(id);
  const saved = useMedicineCategories(id);
  const editing = useMedicineEdit((s) => s.fields?.categories);
  const initial = fromDetails ? editing : saved;

  if (!medicine || initial === undefined) return null;
  return <Picker id={id} back={fromDetails ? t('details.title') : medicine.name} fromDetails={fromDetails} initial={initial} />;
}

function Picker({ id, back, fromDetails, initial }: { id: string; back: string; fromDetails: boolean; initial: string[] }) {
  const t = useT();
  // The picks start from what was there when the screen opened, once.
  const [start] = useState(() => {
    useCategoryPicks.getState().set(initial);
    return initial;
  });
  const picked = useCategoryPicks((s) => s.picked);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (fromDetails) {
      useMedicineEdit.getState().set({ categories: picked });
      router.back();
      return;
    }
    setSaving(true);
    try {
      await setMedicineCategories(id, picked);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreen
      back={back}
      title={t('categories.title')}
      subtitle={t('categories.subtitle')}
      button={{ label: t('common.save'), onPress: save, disabled: saving || sameSet(picked, start) }}
    >
      <CategoryGrid
        picked={picked}
        onToggle={(key) => useCategoryPicks.getState().set(toggled(picked, key))}
        onOwn={() => openOwnCategory('picks')}
      />
    </FormScreen>
  );
}
