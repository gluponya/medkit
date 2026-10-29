import { and, asc, count, eq, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import type { MedicineForm } from '@/domain/medicine';
import type { PackRow } from '@/domain/overview';
import { searchText } from '@/domain/register';
import { packOrder, packToTake } from '@/domain/stock';

import { db } from './db/client';
import { intakes, medicineCategories, medicines, packages } from './db/schema';
import { forgetRepeat, rescheduleDoses } from './notifications';

export type Medicine = typeof medicines.$inferSelect;
export type Package = typeof packages.$inferSelect;

/** What an add made, for the «Додано» toast and its «Скасувати». */
export interface Added {
  medicineId: string;
  packageId: string;
  /** The medicine was made by this add, so «Скасувати» removes it too. */
  isNew: boolean;
}

/**
 * A new medicine with its first pack and its tags, all or nothing. One picked
 * from the Register also keeps what the Register says about it.
 */
export async function addMedicine(input: {
  cabinetId: string;
  name: string;
  form: MedicineForm;
  /** Null: «Не знаю». */
  expires: string | null;
  quantity: number | null;
  /** The code scanned off the pack, if it was. */
  gtin?: string | null;
  categories: readonly string[];
  register?: {
    id: string;
    inn: string | null;
    strength: string | null;
    manufacturer: string | null;
    rx: boolean;
  };
}): Promise<Added> {
  const medicineId = uuidv7();
  const packageId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(medicines).values({
      id: medicineId,
      cabinetId: input.cabinetId,
      name: input.name.trim(),
      form: input.form,
      inn: input.register?.inn ?? null,
      strength: input.register?.strength ?? null,
      manufacturer: input.register?.manufacturer ?? null,
      rx: input.register?.rx ?? false,
      registerId: input.register?.id ?? null,
    });
    await tx.insert(packages).values({
      id: packageId,
      medicineId,
      expires: input.expires,
      quantity: input.quantity,
      gtin: input.gtin ?? null,
    });
    if (input.categories.length > 0) {
      await tx
        .insert(medicineCategories)
        .values(input.categories.map((category) => ({ medicineId, category })));
    }
  });
  return { medicineId, packageId, isNew: true };
}

/** Another pack of a medicine the cabinet already has. */
export async function addPackage(input: {
  medicineId: string;
  expires: string | null;
  quantity: number | null;
  gtin?: string | null;
}): Promise<Added> {
  const packageId = uuidv7();
  await db.insert(packages).values({
    id: packageId,
    medicineId: input.medicineId,
    expires: input.expires,
    quantity: input.quantity,
    gtin: input.gtin ?? null,
  });
  return { medicineId: input.medicineId, packageId, isNew: false };
}

/**
 * «Скасувати» in the «Додано» toast: the pack goes, and the medicine with it
 * when the add made it (its tags go by cascade).
 */
export async function undoAdd(added: Added): Promise<void> {
  if (added.isNew) await db.delete(medicines).where(eq(medicines.id, added.medicineId));
  else await db.delete(packages).where(eq(packages.id, added.packageId));
}

/** A cabinet's medicines by name, for «Що нагадати прийняти?». */
export function useCabinetMedicines(cabinetId: string | undefined): Medicine[] | undefined {
  const id = cabinetId ?? '';
  const { data, updatedAt } = useLiveQuery(
    db.select().from(medicines).where(eq(medicines.cabinetId, id)).orderBy(asc(medicines.name)),
    [id],
  );
  return updatedAt ? data : undefined;
}

type Known = { id: string; name: string; registerId: string | null };

/**
 * The cabinet's medicine that a Register entry is: picked from the same entry,
 * or typed by hand under the same name. Null when the cabinet does not have it.
 */
export function sameMedicine<T extends Known>(known: readonly T[], registerId: string, name: string): T | null {
  const key = searchText(name.trim());
  return (
    known.find((m) => m.registerId === registerId) ??
    known.find((m) => searchText(m.name.trim()) === key) ??
    null
  );
}

/** Every medicine of a cabinet, only what tells them apart: for «Є в «Дім»». */
export function useKnownMedicines(cabinetId: string | undefined): Known[] {
  const id = cabinetId ?? '';
  const { data } = useLiveQuery(
    db
      .select({ id: medicines.id, name: medicines.name, registerId: medicines.registerId })
      .from(medicines)
      .where(eq(medicines.cabinetId, id)),
    [id],
  );
  return data;
}

/** How many active packs a medicine has. */
export function usePackCount(medicineId: string | undefined): number {
  const id = medicineId ?? '';
  const { data } = useLiveQuery(
    db
      .select({ n: count() })
      .from(packages)
      .where(and(eq(packages.medicineId, id), eq(packages.status, 'active'))),
    [id],
  );
  return data[0]?.n ?? 0;
}

/**
 * Every medicine of a cabinet with its active packs, one row per pack. A live
 * query follows only its own table, so medicines and packs are two queries:
 * an add changes the first, a dose or a disposed pack the second.
 */
export function usePackRows(cabinetId: string | undefined): PackRow[] {
  const id = cabinetId ?? '';
  const { data: meds } = useLiveQuery(db.select().from(medicines).where(eq(medicines.cabinetId, id)), [id]);
  const { data: packs } = useLiveQuery(
    db
      .select({ medicineId: packages.medicineId, expires: packages.expires, quantity: packages.quantity })
      .from(packages)
      .innerJoin(medicines, eq(medicines.id, packages.medicineId))
      .where(and(eq(medicines.cabinetId, id), eq(packages.status, 'active'))),
    [id],
  );
  return useMemo(() => {
    const rows: PackRow[] = [];
    for (const m of meds) {
      const own = packs.filter((p) => p.medicineId === m.id);
      const base = { medicineId: m.id, name: m.name, form: m.form, lowStockThreshold: m.lowStockThreshold };
      if (own.length === 0) rows.push({ ...base, expires: null, quantity: null });
      for (const p of own) rows.push({ ...base, expires: p.expires, expiryUnknown: p.expires === null, quantity: p.quantity });
    }
    return rows;
  }, [meds, packs]);
}

/** Undefined while loading, null when it is gone (deleted from another screen). */
export function useMedicine(id: string): Medicine | null | undefined {
  const { data, updatedAt } = useLiveQuery(db.select().from(medicines).where(eq(medicines.id, id)), [id]);
  return updatedAt ? (data[0] ?? null) : undefined;
}

/** The active packs, the one in use first. */
export function usePacks(medicineId: string): Package[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(packages)
      .where(and(eq(packages.medicineId, medicineId), eq(packages.status, 'active')))
      .orderBy(asc(packages.expires)),
    [medicineId],
  );
  return useMemo(() => packOrder(data), [data]);
}

/** Undefined while loading, so an edit does not start from an empty set. */
export function useMedicineCategories(medicineId: string): string[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(medicineCategories).where(eq(medicineCategories.medicineId, medicineId)),
    [medicineId],
  );
  return useMemo(() => (updatedAt ? data.map((c) => c.category) : undefined), [data, updatedAt]);
}

/** What «Деталі» edits (docs/screens.md, "Medicine details"). Empty text is «не вказано». */
export interface MedicineFields {
  name: string;
  form: MedicineForm | null;
  strength: string;
  inn: string;
  manufacturer: string;
  lowStockThreshold: number | null;
  rx: boolean;
  categories: string[];
}

export function medicineFields(m: Medicine, categories: readonly string[]): MedicineFields {
  return {
    name: m.name,
    form: m.form,
    strength: m.strength ?? '',
    inn: m.inn ?? '',
    manufacturer: m.manufacturer ?? '',
    lowStockThreshold: m.lowStockThreshold,
    rx: m.rx,
    categories: [...categories],
  };
}

/** «Зберегти» on «Деталі»: the medicine and its tags, all or nothing. */
export async function updateMedicine(id: string, fields: MedicineFields): Promise<void> {
  const text = (value: string) => value.trim() || null;
  await db.transaction(async (tx) => {
    await tx
      .update(medicines)
      .set({
        name: fields.name.trim(),
        form: fields.form,
        strength: text(fields.strength),
        inn: text(fields.inn),
        manufacturer: text(fields.manufacturer),
        lowStockThreshold: fields.lowStockThreshold,
        rx: fields.rx,
      })
      .where(eq(medicines.id, id));
    await writeCategories(tx, id, fields.categories);
  });
}

/** «Зберегти» on Categories opened from a chip on the medicine. */
export async function setMedicineCategories(id: string, categories: readonly string[]): Promise<void> {
  await db.transaction((tx) => writeCategories(tx, id, categories));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function writeCategories(tx: Tx, medicineId: string, categories: readonly string[]): Promise<void> {
  await tx.delete(medicineCategories).where(eq(medicineCategories.medicineId, medicineId));
  if (categories.length > 0) {
    await tx.insert(medicineCategories).values(categories.map((category) => ({ medicineId, category })));
  }
}

const now = () => new Date().toISOString();

async function activePacks(medicineId: string): Promise<Package[]> {
  return db
    .select()
    .from(packages)
    .where(and(eq(packages.medicineId, medicineId), eq(packages.status, 'active')));
}

/**
 * «−» and «+» on the stock card: the pack in use gives one or gets one back.
 * A pack that reaches zero is used up and leaves the list.
 */
export async function changeStock(medicineId: string, delta: 1 | -1): Promise<void> {
  const packs = await activePacks(medicineId);
  const pack = delta < 0 ? packToTake(packs) : packOrder(packs).find((p) => p.quantity !== null);
  if (!pack || pack.quantity === null) return;
  const quantity = Math.max(0, pack.quantity + delta);
  await db
    .update(packages)
    .set({
      quantity,
      openedAt: pack.openedAt ?? (delta < 0 ? now() : null),
      status: quantity === 0 ? 'used_up' : 'active',
    })
    .where(eq(packages.id, pack.id));
}

/** «Вказати термін» on a pack that was added with «Не знаю». */
export async function setPackExpiry(packageId: string, expires: string): Promise<void> {
  await db.update(packages).set({ expires }).where(eq(packages.id, packageId));
}

/**
 * Whether disposing this pack takes the medicine out of the cabinet: it is the
 * last active one and none was used up. A used-up one keeps it as «Закінчилось».
 */
export async function disposeRemovesMedicine(medicineId: string, packageId: string): Promise<boolean> {
  const kept = await db
    .select({ id: packages.id })
    .from(packages)
    .where(and(eq(packages.medicineId, medicineId), ne(packages.status, 'disposed')));
  return kept.every((p) => p.id === packageId);
}

/** «Утилізувати» on a pack; the last one takes the medicine with it (see above). */
export async function disposePack(medicineId: string, packageId: string): Promise<void> {
  if (await disposeRemovesMedicine(medicineId, packageId)) return deleteMedicine(medicineId);
  await db.update(packages).set({ status: 'disposed' }).where(eq(packages.id, packageId));
  await rescheduleDoses();
}

/** The medicine with its packs, tags, reminders and intakes (by cascade); notifications are laid out again. */
export async function deleteMedicine(id: string): Promise<void> {
  await db.delete(medicines).where(eq(medicines.id, id));
  await rescheduleDoses();
}

/**
 * A dose taken: an Intake, and the dose comes out of the pack in use (opened
 * first, then the one expiring soonest). An uncounted medicine only records it.
 */
export async function takeDose(input: {
  medicineId: string;
  dose: number;
  reminderId?: string | null;
  due?: string | null;
}): Promise<void> {
  await db.transaction(async (tx) => {
    const packs = await tx
      .select()
      .from(packages)
      .where(and(eq(packages.medicineId, input.medicineId), eq(packages.status, 'active')));
    const pack = packToTake(packs);
    if (pack && pack.quantity !== null) {
      const quantity = Math.max(0, pack.quantity - input.dose);
      await tx
        .update(packages)
        .set({ quantity, openedAt: pack.openedAt ?? now(), status: quantity === 0 ? 'used_up' : 'active' })
        .where(eq(packages.id, pack.id));
    }
    await tx.insert(intakes).values({
      id: uuidv7(),
      medicineId: input.medicineId,
      reminderId: input.reminderId ?? null,
      packageId: pack?.id ?? null,
      dose: input.dose,
      status: 'taken',
      due: input.due ?? null,
      at: now(),
    });
  });
  if (input.reminderId && input.due) await forgetRepeat(input.reminderId, input.due);
}

/**
 * A dose marked taken by mistake: the mark goes and its pills go back into
 * the pack they came from, which is active again if that emptied it.
 */
export async function untakeDose(input: { reminderId: string; due: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const marks = await tx
      .select()
      .from(intakes)
      .where(and(eq(intakes.reminderId, input.reminderId), eq(intakes.due, input.due), eq(intakes.status, 'taken')));
    for (const mark of marks) {
      if (mark.packageId) {
        const [pack] = await tx.select().from(packages).where(eq(packages.id, mark.packageId));
        if (pack && pack.quantity !== null && pack.status !== 'disposed') {
          await tx
            .update(packages)
            .set({ quantity: pack.quantity + mark.dose, status: 'active' })
            .where(eq(packages.id, pack.id));
        }
      }
      await tx.delete(intakes).where(eq(intakes.id, mark.id));
    }
  });
  await rescheduleDoses();
}
