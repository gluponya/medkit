import { router } from 'expo-router';
import { useState } from 'react';

import type { MedicineForm } from '@/domain/medicine';
import { FormTiles } from '@/features/add/FormTiles';
import { useMedicineEdit } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';

/** «Форма» on «Деталі»: the tiles of adding. The form sets the stock unit. */
export default function DetailsFormScreen() {
  const t = useT();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const [form, setForm] = useState<MedicineForm | null>(fields?.form ?? null);

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields) return null;

  const done = () => {
    set({ form });
    router.back();
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t('details.form')}
      subtitle={fields.name}
      button={{ label: t('common.done'), onPress: done, disabled: form === null }}
    >
      <FormTiles form={form} onPick={setForm} />
    </FormScreen>
  );
}
