import { useState } from 'react';

import { rememberCode } from '@/data/barcodes';
import { useCurrentCabinet } from '@/data/cabinets';
import { addMedicine } from '@/data/medicines';
import { StepScreen } from '@/features/add/StepScreen';
import { draftExpires, useDraft } from '@/features/add/draft';
import { finishAdd } from '@/features/add/finish';
import { useScan } from '@/features/add/scan';
import { CategoryGrid, openOwnCategory, toggled } from '@/features/categories/categories';
import { useT } from '@/i18n';

/**
 * Step 5: what the medicine is for, so it is quick to find. Several can be
 * picked, none is fine. The button adds the medicine to the current cabinet;
 * a scanned code is kept as this name and form, so the next scan finds it.
 */
export default function CategoriesStep() {
  const t = useT();
  const cabinet = useCurrentCabinet();
  const draft = useDraft();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const expires = draftExpires(draft);
    if (!cabinet || !draft.form || expires === undefined) return;
    setSaving(true);
    try {
      const gtin = useScan.getState().scan?.gtin ?? null;
      const added = await addMedicine({
        cabinetId: cabinet.id,
        name: draft.name,
        form: draft.form,
        expires,
        quantity: draft.counted ? draft.quantity : null,
        categories: draft.categories,
        gtin,
      });
      if (gtin) rememberCode(gtin, { registerId: null, name: draft.name.trim(), form: draft.form, packSize: null });
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
      <CategoryGrid
        picked={draft.categories}
        onToggle={(key) => draft.set({ categories: toggled(draft.categories, key) })}
        onOwn={() => openOwnCategory('draft')}
      />
    </StepScreen>
  );
}
