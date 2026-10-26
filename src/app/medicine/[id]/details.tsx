import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useCabinets } from '@/data/cabinets';
import { medicineFields, updateMedicine, useMedicine, useMedicineCategories } from '@/data/medicines';
import { FORM_NAME, UNIT } from '@/features/add/labels';
import { useCategoryName } from '@/features/categories/categories';
import { fieldsChanged, useMedicineEdit, type DetailsField } from '@/features/medicine/edit';
import { useT } from '@/i18n';
import { FormScreen } from '@/ui/FormScreen';
import { Group, Row } from '@/ui/Rows';

type Route = 'field' | 'form' | 'strength' | 'substance' | 'low-stock' | 'categories' | 'move';

/**
 * Medicine details (docs/screens.md): what the medicine is and how it is
 * found and bought, as rows with the value and a chevron. Each row opens a
 * screen for that one answer; whatever comes back is saved at once, so there
 * is no «Зберегти».
 */
export default function DetailsScreen() {
  const t = useT();
  // «rx»: opened from the «За рецептом» chip, so the switch is in sight.
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const medicine = useMedicine(id);
  const categories = useMedicineCategories(id);
  const categoryName = useCategoryName();
  const edit = useMedicineEdit();
  const cabinet = useCabinets()?.find((c) => c.id === medicine?.cabinetId);

  // The edit starts from the medicine as saved, once both have loaded, and
  // is dropped when the screen goes.
  const loaded = medicine && categories !== undefined;
  useEffect(() => {
    if (loaded && useMedicineEdit.getState().medicineId !== id) {
      useMedicineEdit.getState().start(id, medicineFields(medicine, categories));
    }
  }, [loaded, id, medicine, categories]);
  useEffect(() => () => useMedicineEdit.getState().reset(), []);

  // Every change is written as soon as it is in the edit.
  const fields = edit.medicineId === id ? edit.fields : null;
  useEffect(() => {
    if (!fields || !edit.saved || !fieldsChanged(fields, edit.saved)) return;
    edit.markSaved(fields);
    void updateMedicine(id, fields);
  }, [fields, edit, id]);

  if (!medicine || !fields || !edit.saved) return null;

  const empty = t('details.empty');
  const go = (route: Route, params: Record<string, string> = {}) =>
    router.push({ pathname: `/medicine/[id]/${route}`, params: { id, ...params } });
  const open = (field: DetailsField) => go('field', { field });
  const unit = t(UNIT[fields.form ?? 'other']);
  const tags = fields.categories.map(categoryName).filter(Boolean).join(', ');

  return (
    <FormScreen back={medicine.name} title={t('details.title')} subtitle={t('details.subtitle')} atEnd={focus === 'rx'}>
      <Group title={t('details.medicine')}>
        <Row label={t('details.name')} value={fields.name} onPress={() => open('name')} />
        <Row label={t('details.form')} value={fields.form ? t(FORM_NAME[fields.form]) : empty} onPress={() => go('form')} />
        <Row label={t('details.strength')} value={fields.strength.trim() || empty} onPress={() => go('strength')} />
        <Row label={t('details.inn')} value={fields.inn.trim() || empty} onPress={() => go('substance')} />
        <Row
          label={t('details.manufacturer')}
          value={fields.manufacturer.trim() || empty}
          onPress={() => open('manufacturer')}
        />
      </Group>
      <Group title={t('details.searchAndBuying')}>
        <Row label={t('details.categories')} value={tags || empty} onPress={() => go('categories', { from: 'details' })} />
        <Row
          label={t('details.lowStock')}
          value={fields.lowStockThreshold === null ? t('details.noWarning') : `${fields.lowStockThreshold} ${unit}`}
          onPress={() => go('low-stock')}
        />
        <Row label={t('details.rx')} toggle={{ on: fields.rx, onChange: (rx) => edit.set({ rx }) }} />
      </Group>
      <Group title={t('details.where')}>
        <Row label={t('details.cabinet')} value={cabinet?.name ?? ''} onPress={() => go('move')} />
      </Group>
    </FormScreen>
  );
}
