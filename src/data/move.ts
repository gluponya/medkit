import { eq, inArray } from 'drizzle-orm';

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
  let into = mergeInto;
  db.transaction((tx) => {
    if (expiryOnly) tx.delete(reminders).where(eq(reminders.medicineId, medicineId)).run();
    // A medicine of another form is not the same one: its numbers are in another unit.
    if (into) {
      const forms = tx
        .select({ id: medicines.id, form: medicines.form })
        .from(medicines)
        .where(inArray(medicines.id, [medicineId, into]))
        .all();
      const [a, b] = [forms.find((m) => m.id === medicineId), forms.find((m) => m.id === into)];
      if (!a || !b || a.form !== b.form) into = null;
    }
    if (into) {
      mergeMedicine(tx, medicineId, into);
      return;
    }
    tx.update(medicines).set({ cabinetId }).where(eq(medicines.id, medicineId)).run();
    tx.update(shoppingItems).set({ cabinetId }).where(eq(shoppingItems.medicineId, medicineId)).run();
  });
  await rescheduleDoses();
  return into ?? medicineId;
}
