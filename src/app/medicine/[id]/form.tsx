import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { usePacks } from '@/data/medicines';
import { useReminder } from '@/data/reminders';
import type { MedicineForm } from '@/domain/medicine';
import { FormTiles } from '@/features/add/FormTiles';
import { unitChanged, useChange, type ChangeStep } from '@/features/change/draft';
import { useMedicineEdit } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';

/**
 * «Форма» on «Деталі»: the tiles of adding. The form sets the stock unit: to
 * another unit, the counted packs and the reminder's dose are asked again, as
 * in «Змінити ліки», and the low-stock line goes. 20 tablets are not 20 ml.
 */
export default function DetailsFormScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fields = useMedicineEdit((s) => s.fields);
  const set = useMedicineEdit((s) => s.set);
  const packs = usePacks(id);
  const reminder = useReminder(id);
  const [form, setForm] = useState<MedicineForm | null>(fields?.form ?? null);

  // «Деталі» was left under this screen: nothing to edit.
  if (!fields) return null;

  const done = () => {
    if (!form) return;
    if (!unitChanged(fields.form, form)) {
      set({ form });
      router.back();
      return;
    }
    const steps: ChangeStep[] = [
      ...packs.filter((p) => p.quantity !== null).map((pack) => ({ kind: 'pack' as const, pack })),
      ...(reminder ? [{ kind: 'dose' as const, reminder }] : []),
    ];
    if (steps.length === 0) {
      set({ form, lowStockThreshold: null });
      router.back();
      return;
    }
    useChange.getState().reset();
    useChange.getState().set({
      medicineId: id,
      target: { name: fields.name, form, register: null },
      formOnly: true,
      mergeInto: null,
      unitChanged: true,
      steps,
      quantities: {},
      dose: null,
    });
    router.push({ pathname: '/medicine/[id]/change-step', params: { id, step: '1' } });
  };

  return (
    <FormScreen
      back={t('details.title')}
      title={t('details.form')}
      subtitle={fields.name}
      button={{ label: t('common.done'), onPress: done, disabled: form === null || reminder === undefined }}
    >
      <FormTiles form={form} onPick={setForm} />
    </FormScreen>
  );
}
