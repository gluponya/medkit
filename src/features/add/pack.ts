import { router } from 'expo-router';

import { addPackage } from '@/data/medicines';
import type { MedicineForm } from '@/domain/medicine';

import { draftExpires, useDraft } from './draft';
import { finishAdd } from './finish';

/** Adding another pack (docs/screens.md, Medicine): the expiry step, then the quantity. */
const PACK_STEPS = 2;

let saving = false;

/**
 * The step props of adding another pack: its own count, and «Скасувати»
 * goes back to the medicine instead of Home.
 */
export function packStep(step: number, medicineId: string) {
  return {
    step,
    total: PACK_STEPS,
    onCancel: () => {
      useDraft.getState().reset();
      router.dismissTo({ pathname: '/medicine/[id]', params: { id: medicineId } });
    },
  };
}

/** «Додати» by «Упаковки»: the steps start on a clean draft. */
export function startPack(medicineId: string, form: MedicineForm | null): void {
  useDraft.getState().reset();
  useDraft.getState().set({ packFor: medicineId, form });
  router.push('/add/expiry');
}

/** The last step's «Додати»: the pack is saved, and the medicine opens with «Додано». */
export async function addPack(medicineId: string): Promise<void> {
  const draft = useDraft.getState();
  const expires = draftExpires(draft);
  if (saving || expires === undefined) return;
  saving = true;
  try {
    finishAdd(await addPackage({ medicineId, expires, quantity: draft.counted ? draft.quantity : null }));
  } finally {
    saving = false;
  }
}
