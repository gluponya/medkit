import { router } from 'expo-router';
import { create } from 'zustand';

import { changeMedicine, movePack, type ChangeTarget } from '@/data/change';
import type { Package } from '@/data/medicines';
import { useMedicineEdit } from '@/features/medicine/edit';
import type { Reminder } from '@/data/reminders';
import type { MedicineForm } from '@/domain/medicine';
import { UNIT } from '@/features/add/labels';

/** One question after «Змінити» when the unit changed: a pack's quantity, or the reminder's dose. */
export type ChangeStep = { kind: 'pack'; pack: Package } | { kind: 'dose'; reminder: Reminder };

/**
 * «Змінити ліки» in progress (docs/journeys.md, J9): the medicine, what it
 * becomes, and the answers to the questions after the comparison. Kept in
 * memory only; nothing is saved until the last answer.
 */
interface ChangeState {
  medicineId: string | null;
  /** «Це інші ліки» on one pack: only it moves, the medicine stays. */
  packId: string | null;
  target: ChangeTarget | null;
  /** By hand: the name and form typed so far. */
  name: string;
  form: MedicineForm | null;
  mergeInto: string | null;
  unitChanged: boolean;
  steps: ChangeStep[];
  /** Pack id → quantity in the new unit; null is «Не рахувати, просто є». */
  quantities: Record<string, number | null>;
  dose: number | null;
  /** «Форма» in «Деталі» to another unit: only the numbers are asked again. */
  formOnly: boolean;
  set: (patch: Partial<Omit<ChangeState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY = {
  medicineId: null,
  packId: null,
  target: null,
  name: '',
  form: null,
  mergeInto: null,
  unitChanged: false,
  steps: [],
  quantities: {},
  dose: null,
  formOnly: false,
};

export const useChange = create<ChangeState>()((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

/** Tablets and capsules count differently from ml: only a new unit asks the numbers again. */
export function unitChanged(from: MedicineForm | null, to: MedicineForm): boolean {
  return UNIT[from ?? 'other'] !== UNIT[to];
}

/** «Скасувати» anywhere in the flow: nothing changed, back on the medicine. */
export function cancelChange(): void {
  const { medicineId, formOnly, reset } = useChange.getState();
  reset();
  if (medicineId && formOnly) router.dismissTo({ pathname: '/medicine/[id]/details', params: { id: medicineId } });
  else if (medicineId) router.dismissTo({ pathname: '/medicine/[id]', params: { id: medicineId } });
  else router.back();
}

/** «Це інші ліки» on a pack: the search for what it really is, from the medicine screen. */
export function startPackChange(medicineId: string, packId: string, name: string): void {
  useChange.getState().reset();
  useChange.getState().set({ medicineId, packId });
  router.push({ pathname: '/add/search', params: { change: medicineId, q: name } });
}

/**
 * Saves the change and opens the medicine it ended as, with the «Ліки змінено»
 * toast; a moved pack opens the medicine it went to, with «Упаковку перенесено».
 */
export async function finishChange(): Promise<void> {
  const { medicineId, packId, target, mergeInto, unitChanged: changed, quantities, dose, formOnly, reset } =
    useChange.getState();
  if (!medicineId || !target) return;
  if (formOnly) {
    await changeMedicine({ medicineId, target, mergeInto: null, unitChanged: true, quantities, dose, formOnly });
    reset();
    // «Деталі» shows the edit, not the database: it learns the new form as saved.
    const edit = useMedicineEdit.getState();
    if (edit.medicineId === medicineId && edit.fields) {
      const patch = { form: target.form, lowStockThreshold: null };
      edit.start(medicineId, { ...edit.fields, ...patch });
    }
    router.dismissTo({ pathname: '/medicine/[id]/details', params: { id: medicineId } });
    return;
  }
  if (packId) {
    const id = await movePack({
      packageId: packId,
      target,
      mergeInto,
      ...(packId in quantities ? { quantity: quantities[packId] } : {}),
    });
    reset();
    router.dismissTo({ pathname: '/medicine/[id]', params: { id: medicineId } });
    router.push({ pathname: '/medicine/[id]', params: { id, packMoved: '1' } });
    return;
  }
  const id = await changeMedicine({ medicineId, target, mergeInto, unitChanged: changed, quantities, dose });
  reset();
  if (id === medicineId) {
    router.dismissTo({ pathname: '/medicine/[id]', params: { id, changed: '1' } });
    return;
  }
  // Merged: the old medicine's screen has nothing to show, so it closes too.
  router.dismissTo({ pathname: '/medicine/[id]', params: { id: medicineId } });
  router.replace({ pathname: '/medicine/[id]', params: { id, changed: '1' } });
}
