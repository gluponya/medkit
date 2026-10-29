import { router } from 'expo-router';

import { rememberCode } from '@/data/barcodes';
import { addPackage } from '@/data/medicines';
import type { MedicineForm } from '@/domain/medicine';

import { draftExpires, useDraft } from './draft';
import { finishAdd } from './finish';
import { useScan } from './scan';

/** Adding another pack (docs/screens.md, Medicine): the expiry step, then the quantity. */
const PACK_STEPS = 2;

let saving = false;

/**
 * The step props of adding another pack: its own count, and «Скасувати»
 * goes back to the medicine instead of Home, or to the scanner it came from.
 */
export function packStep(step: number, medicineId: string) {
  return {
    step,
    total: PACK_STEPS,
    onCancel: () => {
      useDraft.getState().reset();
      if (useScan.getState().open) router.dismissTo('/add/scan');
      else router.dismissTo({ pathname: '/medicine/[id]', params: { id: medicineId } });
    },
  };
}

/** «Додати» by «Упаковки»: the steps start on a clean draft. */
export function startPack(medicineId: string, form: MedicineForm | null): void {
  useDraft.getState().reset();
  useDraft.getState().set({ packFor: medicineId, form });
  router.push('/add/expiry');
}

/**
 * The last step's «Додати»: the pack is saved, and the medicine opens with
 * «Додано». Scanned, it was a code known as a medicine typed by hand (see the
 * scanner): its code is confirmed as that name and form.
 */
export async function addPack(medicineId: string): Promise<void> {
  const draft = useDraft.getState();
  const expires = draftExpires(draft);
  if (saving || expires === undefined) return;
  saving = true;
  try {
    const gtin = useScan.getState().scan?.gtin ?? null;
    const added = await addPackage({ medicineId, expires, quantity: draft.counted ? draft.quantity : null, gtin });
    if (gtin && draft.form && draft.name.trim()) {
      rememberCode(gtin, { registerId: null, name: draft.name.trim(), form: draft.form, packSize: null });
    }
    finishAdd(added);
  } finally {
    saving = false;
  }
}
