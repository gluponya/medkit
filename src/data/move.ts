import { eq } from 'drizzle-orm';

import { mergeMedicine } from './change';
import { db } from './db/client';
import { medicines, reminders, shoppingItems } from './db/schema';
import { rescheduleDoses } from './notifications';

/**
 * «Перенести в іншу аптечку» (docs/model.md, "Moving a medicine"): the
 * medicine goes with its packs, tags, intakes and shopping lines. A cabinet
 * that keeps only expiry drops the reminder. Into a medicine that cabinet
 * already has, everything joins it and this one goes. Returns the medicine
 * to open.
 */
export async function moveMedicine(input: {
  medicineId: string;
  cabinetId: string;
  /** The target cabinet keeps only expiry. */
  expiryOnly: boolean;
  /** The target cabinet's medicine this one already is. */
  mergeInto: string | null;
}): Promise<string> {
  const { medicineId, cabinetId, expiryOnly, mergeInto } = input;
  await db.transaction(async (tx) => {
    if (expiryOnly) await tx.delete(reminders).where(eq(reminders.medicineId, medicineId));
    if (mergeInto) {
      await mergeMedicine(tx, medicineId, mergeInto);
      return;
    }
    await tx.update(medicines).set({ cabinetId }).where(eq(medicines.id, medicineId));
    await tx.update(shoppingItems).set({ cabinetId }).where(eq(shoppingItems.medicineId, medicineId));
  });
  await rescheduleDoses();
  return mergeInto ?? medicineId;
}
