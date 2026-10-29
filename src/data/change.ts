import { and, eq, isNotNull } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { categoriesForAtc } from '@/domain/categories';
import type { MedicineForm } from '@/domain/medicine';

import { rememberCode } from './barcodes';
import { db } from './db/client';
import { intakes, medicineCategories, medicines, packages, reminders, shoppingItems } from './db/schema';
import { rescheduleDoses } from './notifications';
import type { RegisterEntry } from './register';

/** What the medicine really is: a Register entry, or a name and form typed by hand. */
export interface ChangeTarget {
  name: string;
  form: MedicineForm;
  register: RegisterEntry | null;
}

/**
 * «Змінити ліки» (docs/model.md, "Changing what a medicine is"): the same
 * boxes, picked again. Packs, intakes and the reminder are kept; what the
 * medicine is comes from the new pick. Into a medicine the cabinet already
 * has, everything moves there and this one goes. Numbers in an old unit are
 * replaced by the answers to the questions after it, never converted.
 * The codes scanned off its packs were picked wrong too: the map learns the
 * new pick.
 * Returns the medicine to open.
 */
export async function changeMedicine(input: {
  medicineId: string;
  target: ChangeTarget;
  /** The cabinet's medicine the new pick already is. */
  mergeInto: string | null;
  unitChanged: boolean;
  /** Pack id → its quantity in the new unit; null is «Не рахувати, просто є». */
  quantities: Readonly<Record<string, number | null>>;
  /** The reminder's dose in the new unit; null when it was not asked. */
  dose: number | null;
}): Promise<string> {
  const { medicineId, target, mergeInto, quantities, dose } = input;
  const into = mergeInto ?? medicineId;
  const entry = target.register;
  const scanned = await db
    .selectDistinct({ gtin: packages.gtin })
    .from(packages)
    .where(and(eq(packages.medicineId, medicineId), isNotNull(packages.gtin)));

  await db.transaction(async (tx) => {
    for (const [packageId, quantity] of Object.entries(quantities)) {
      await tx.update(packages).set({ quantity }).where(eq(packages.id, packageId));
    }

    const [reminder] = await tx.select().from(reminders).where(eq(reminders.medicineId, medicineId));
    if (reminder && dose !== null) {
      await tx
        .update(reminders)
        .set({ times: reminder.times.map((time) => ({ ...time, dose })) })
        .where(eq(reminders.id, reminder.id));
    }

    if (mergeInto) {
      await mergeMedicine(tx, medicineId, mergeInto);
      return;
    }

    await tx
      .update(medicines)
      .set({
        name: target.name.trim(),
        form: target.form,
        inn: entry?.inn ?? null,
        strength: entry?.strength ?? null,
        manufacturer: entry?.manufacturer ?? null,
        rx: entry?.rx ?? false,
        registerId: entry?.id ?? null,
        ...(input.unitChanged ? { lowStockThreshold: null } : {}),
      })
      .where(eq(medicines.id, medicineId));
    // Tags she picked stay; the new pick's ATC codes add theirs.
    const atc = entry ? categoriesForAtc(entry.atc) : [];
    if (atc.length > 0) {
      await tx
        .insert(medicineCategories)
        .values(atc.map((category) => ({ medicineId, category })))
        .onConflictDoNothing();
    }
    await tx
      .update(shoppingItems)
      .set({ name: target.name.trim() })
      .where(eq(shoppingItems.medicineId, medicineId));
  });

  for (const { gtin } of scanned) {
    if (!gtin) continue;
    rememberCode(
      gtin,
      entry
        ? { registerId: entry.id, packSize: null }
        : { registerId: null, name: target.name.trim(), form: target.form, packSize: null },
    );
  }
  await rescheduleDoses();
  return into;
}

/**
 * «Це інші ліки» on one pack (docs/model.md, "Changing what a medicine is"):
 * one box of several was picked wrong. The pack leaves this medicine for the
 * one it really is: a medicine the cabinet already has, or a new one made from
 * the pick. Its date and count go with it; the reminder, the intakes and the
 * tags stay here, with the boxes that were right. Its code learns the new pick.
 * Returns the medicine to open.
 */
export async function movePack(input: {
  packageId: string;
  target: ChangeTarget;
  mergeInto: string | null;
  /** Its quantity in the new unit, when it was asked; null is «Не рахувати, просто є». */
  quantity?: number | null;
}): Promise<string> {
  const { packageId, target, mergeInto } = input;
  const entry = target.register;
  const [pack] = await db.select().from(packages).where(eq(packages.id, packageId));
  if (!pack) throw new Error(`pack ${packageId} is gone`);
  const [from] = await db.select({ cabinetId: medicines.cabinetId }).from(medicines).where(eq(medicines.id, pack.medicineId));
  if (!from) throw new Error(`medicine ${pack.medicineId} is gone`);
  const into = mergeInto ?? uuidv7();

  await db.transaction(async (tx) => {
    if (!mergeInto) {
      await tx.insert(medicines).values({
        id: into,
        cabinetId: from.cabinetId,
        name: target.name.trim(),
        form: target.form,
        inn: entry?.inn ?? null,
        strength: entry?.strength ?? null,
        manufacturer: entry?.manufacturer ?? null,
        rx: entry?.rx ?? false,
        registerId: entry?.id ?? null,
      });
      const atc = entry ? categoriesForAtc(entry.atc) : [];
      if (atc.length > 0) {
        await tx.insert(medicineCategories).values(atc.map((category) => ({ medicineId: into, category })));
      }
    }
    await tx
      .update(packages)
      .set({ medicineId: into, ...(input.quantity !== undefined ? { quantity: input.quantity } : {}) })
      .where(eq(packages.id, packageId));
  });

  if (pack.gtin) {
    rememberCode(
      pack.gtin,
      entry
        ? { registerId: entry.id, packSize: null }
        : { registerId: null, name: target.name.trim(), form: target.form, packSize: null },
    );
  }
  await rescheduleDoses();
  return into;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Joins one medicine into another of the same cabinet: packs, intakes and tags
 * move there, and `from` is deleted. One reminder per medicine: the one
 * already there wins (in a change it is the one in the right unit).
 */
export async function mergeMedicine(tx: Tx, from: string, into: string): Promise<void> {
  const [reminder] = await tx.select({ id: reminders.id }).from(reminders).where(eq(reminders.medicineId, from));
  const [there] = await tx.select({ id: reminders.id }).from(reminders).where(eq(reminders.medicineId, into));
  if (reminder) {
    if (there) await tx.delete(reminders).where(eq(reminders.id, reminder.id));
    else await tx.update(reminders).set({ medicineId: into }).where(eq(reminders.id, reminder.id));
  }
  await tx.update(packages).set({ medicineId: into }).where(eq(packages.medicineId, from));
  await tx.update(intakes).set({ medicineId: into }).where(eq(intakes.medicineId, from));
  const tags = await tx
    .select({ category: medicineCategories.category })
    .from(medicineCategories)
    .where(eq(medicineCategories.medicineId, from));
  if (tags.length > 0) {
    await tx
      .insert(medicineCategories)
      .values(tags.map(({ category }) => ({ medicineId: into, category })))
      .onConflictDoNothing();
  }
  // Its shopping lines go with it; the medicine it joins has its own.
  await tx.delete(medicines).where(eq(medicines.id, from));
}
