import { and, asc, count, eq, ne } from 'drizzle-orm';
import { useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import type { MedicineForm } from '@/domain/medicine';
import type { PackRow } from '@/domain/overview';
import { searchText } from '@/domain/register';
import { canEdit } from '@/domain/sharing';
import { packOrder, packToTake, takeFrom } from '@/domain/stock';

import { db } from './db/client';
import { cabinets, intakes, medicineCategories, medicines, packages } from './db/schema';
import { useLiveRows } from './live';
import { forgetDose, rescheduleDoses } from './notifications';

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
 * The person is only a member of this shared cabinet: the server refuses
 * their new medicines and packs, so the phone does not make them either.
 */
export class NotAllowedError extends Error {}

/** A member adds nothing: the server would refuse it and leave it on this phone alone. */
function assertCanAdd(cabinetId: string): void {
  const cabinet = db.select({ role: cabinets.role }).from(cabinets).where(eq(cabinets.id, cabinetId)).get();
  if (cabinet && !canEdit(cabinet.role)) throw new NotAllowedError('a member cannot add to ' + cabinetId);
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
  assertCanAdd(input.cabinetId);
  const medicineId = uuidv7();
  const packageId = uuidv7();
  db.transaction((tx) => {
    tx.insert(medicines)
      .values({
        id: medicineId,
        cabinetId: input.cabinetId,
        name: input.name.trim(),
        form: input.form,
        inn: input.register?.inn ?? null,
        strength: input.register?.strength ?? null,
        manufacturer: input.register?.manufacturer ?? null,
        rx: input.register?.rx ?? false,
        registerId: input.register?.id ?? null,
      })
      .run();
    tx.insert(packages)
      .values({
        id: packageId,
        medicineId,
        expires: input.expires,
        quantity: input.quantity,
        gtin: input.gtin ?? null,
      })
      .run();
    if (input.categories.length > 0) {
      tx.insert(medicineCategories)
        .values(input.categories.map((category) => ({ medicineId, category })))
        .run();
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
  const medicine = db
    .select({ cabinetId: medicines.cabinetId })
    .from(medicines)
    .where(eq(medicines.id, input.medicineId))
    .get();
  if (medicine) assertCanAdd(medicine.cabinetId);
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
  const { data, updatedAt } = useLiveRows(
    db.select().from(medicines).where(eq(medicines.cabinetId, id)).orderBy(asc(medicines.name)),
    [id],
    ['medicines'],
  );
  return updatedAt ? data : undefined;
}

type Known = { id: string; name: string; registerId: string | null; form: MedicineForm | null };

/**
 * The cabinet's medicine that a Register entry is: picked from the same entry,
 * or typed by hand under the same name. Null when the cabinet does not have it.
 * With `form`, only one of that form counts: moving joins «Нурофен» tablets
 * with «Нурофен» tablets, never with the syrup, whose numbers are in ml.
 */
export function sameMedicine<T extends Known>(
  known: readonly T[],
  registerId: string,
  name: string,
  form?: MedicineForm | null,
): T | null {
  const key = searchText(name.trim());
  const candidates = form === undefined ? known : known.filter((m) => m.form === form);
  return (
    candidates.find((m) => m.registerId === registerId) ??
    candidates.find((m) => searchText(m.name.trim()) === key) ??
    null
  );
}

/** Every medicine of a cabinet, only what tells them apart: for «Є в «Дім»». */
export function useKnownMedicines(cabinetId: string | undefined): Known[] {
  const id = cabinetId ?? '';
  const { data } = useLiveRows(
    db
      .select({ id: medicines.id, name: medicines.name, registerId: medicines.registerId, form: medicines.form })
      .from(medicines)
      .where(eq(medicines.cabinetId, id)),
    [id],
    ['medicines'],
  );
  return data;
}

/** How many active packs a medicine has. */
export function usePackCount(medicineId: string | undefined): number {
  const id = medicineId ?? '';
  const { data } = useLiveRows(
    db
      .select({ n: count() })
      .from(packages)
      .where(and(eq(packages.medicineId, id), eq(packages.status, 'active'))),
    [id],
    ['packages'],
  );
  return data[0]?.n ?? 0;
}

/**
 * Every medicine of a cabinet with its active packs, one row per pack. The
 * packs follow the medicines too: one moved to another cabinet takes its packs.
 */
export function usePackRows(cabinetId: string | undefined): PackRow[] {
  const id = cabinetId ?? '';
  const { data: meds } = useLiveRows(db.select().from(medicines).where(eq(medicines.cabinetId, id)), [id], ['medicines']);
  const { data: packs } = useLiveRows(
    db
      .select({ medicineId: packages.medicineId, expires: packages.expires, quantity: packages.quantity })
      .from(packages)
      .innerJoin(medicines, eq(medicines.id, packages.medicineId))
      .where(and(eq(medicines.cabinetId, id), eq(packages.status, 'active'))),
    [id],
    ['packages', 'medicines'],
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
  const { data, updatedAt } = useLiveRows(db.select().from(medicines).where(eq(medicines.id, id)), [id], ['medicines']);
  return updatedAt ? (data[0] ?? null) : undefined;
}

/** The active packs, the one in use first. */
export function usePacks(medicineId: string): Package[] {
  const { data } = useLiveRows(
    db
      .select()
      .from(packages)
      .where(and(eq(packages.medicineId, medicineId), eq(packages.status, 'active')))
      .orderBy(asc(packages.expires)),
    [medicineId],
    ['packages'],
  );
  return useMemo(() => packOrder(data), [data]);
}

/** Undefined while loading, so an edit does not start from an empty set. */
export function useMedicineCategories(medicineId: string): string[] | undefined {
  const { data, updatedAt } = useLiveRows(
    db.select().from(medicineCategories).where(eq(medicineCategories.medicineId, medicineId)),
    [medicineId],
    ['medicine_categories'],
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
  db.transaction((tx) => {
    tx.update(medicines)
      .set({
        name: fields.name.trim(),
        form: fields.form,
        strength: text(fields.strength),
        inn: text(fields.inn),
        manufacturer: text(fields.manufacturer),
        lowStockThreshold: fields.lowStockThreshold,
        rx: fields.rx,
      })
      .where(eq(medicines.id, id))
      .run();
    writeCategories(tx, id, fields.categories);
  });
}

/** «Зберегти» on Categories opened from a chip on the medicine. */
export async function setMedicineCategories(id: string, categories: readonly string[]): Promise<void> {
  db.transaction((tx) => writeCategories(tx, id, categories));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function writeCategories(tx: Tx, medicineId: string, categories: readonly string[]): void {
  tx.delete(medicineCategories).where(eq(medicineCategories.medicineId, medicineId)).run();
  if (categories.length > 0) {
    tx.insert(medicineCategories).values(categories.map((category) => ({ medicineId, category }))).run();
  }
}

const now = () => new Date().toISOString();

/**
 * «−» and «+» on the stock card: the pack in use gives one or gets one back.
 * A pack that reaches zero is used up and leaves the list; its id is returned,
 * so a «+» right after can pass it as `emptied` and bring it back when no
 * counted pack is left to take the one.
 */
export async function changeStock(medicineId: string, delta: 1 | -1, emptied?: string | null): Promise<string | null> {
  // Sync: drizzle's expo-sqlite transaction commits when the callback returns.
  return db.transaction((tx) => {
    const packs = tx
      .select()
      .from(packages)
      .where(and(eq(packages.medicineId, medicineId), eq(packages.status, 'active')))
      .all();
    let pack = delta < 0 ? packToTake(packs) : packOrder(packs).find((p) => p.quantity !== null);
    if (!pack && delta > 0 && emptied) {
      pack = tx
        .select()
        .from(packages)
        .where(and(eq(packages.id, emptied), eq(packages.medicineId, medicineId), eq(packages.status, 'used_up')))
        .get();
    }
    if (!pack || pack.quantity === null) return null;
    const quantity = Math.max(0, pack.quantity + delta);
    tx.update(packages)
      .set({
        quantity,
        openedAt: pack.openedAt ?? (delta < 0 ? now() : null),
        status: quantity === 0 ? 'used_up' : 'active',
      })
      .where(eq(packages.id, pack.id))
      .run();
    return quantity === 0 ? pack.id : null;
  });
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
 * first, then the one expiring soonest), what that pack lacks from the next.
 * Each pack it came out of gets an Intake row of its own with the amount, all
 * with the same time, reminder and due, so undo puts back exactly that; a
 * dose counts once however many rows it has. An uncounted medicine only
 * records it. A dose already answered is left as it is (a second tap).
 */
export async function takeDose(input: {
  medicineId: string;
  dose: number;
  reminderId?: string | null;
  due?: string | null;
}): Promise<void> {
  const at = now();
  const due = input.due ?? null;
  // Sync: drizzle's expo-sqlite transaction commits when the callback returns.
  const done = db.transaction((tx) => {
    if (due !== null) {
      const answered = tx
        .select({ id: intakes.id })
        .from(intakes)
        .where(and(eq(intakes.medicineId, input.medicineId), eq(intakes.due, due)))
        .get();
      if (answered) return false;
    }
    const packs = tx
      .select()
      .from(packages)
      .where(and(eq(packages.medicineId, input.medicineId), eq(packages.status, 'active')))
      .all();
    const parts = takeFrom(packs, input.dose);
    for (const { pack, amount } of parts) {
      const quantity = (pack.quantity ?? 0) - amount;
      tx.update(packages)
        .set({ quantity, openedAt: pack.openedAt ?? at, status: quantity === 0 ? 'used_up' : 'active' })
        .where(eq(packages.id, pack.id))
        .run();
    }
    const mark = { medicineId: input.medicineId, reminderId: input.reminderId ?? null, status: 'taken' as const, due, at };
    tx.insert(intakes)
      .values(
        parts.length > 0
          ? parts.map(({ pack, amount }) => ({ ...mark, id: uuidv7(), packageId: pack.id, dose: amount }))
          : [{ ...mark, id: uuidv7(), packageId: null, dose: input.dose }],
      )
      .run();
    return true;
  });
  if (done && input.reminderId && due) await forgetDose(input.reminderId, due);
}

/**
 * A dose marked taken by mistake: its marks go (matched by medicine and due,
 * as Today matches them) and each puts its amount back into the pack it came
 * out of, which is active again if that emptied it.
 */
export async function untakeDose(input: { medicineId: string; due: string }): Promise<void> {
  // Sync: drizzle's expo-sqlite transaction commits when the callback returns.
  db.transaction((tx) => {
    const marks = tx
      .select()
      .from(intakes)
      .where(and(eq(intakes.medicineId, input.medicineId), eq(intakes.due, input.due), eq(intakes.status, 'taken')))
      .all();
    for (const mark of marks) {
      if (mark.packageId) {
        const pack = tx.select().from(packages).where(eq(packages.id, mark.packageId)).get();
        if (pack && pack.quantity !== null && pack.status !== 'disposed') {
          tx.update(packages)
            .set({ quantity: pack.quantity + mark.dose, status: 'active' })
            .where(eq(packages.id, pack.id))
            .run();
        }
      }
      tx.delete(intakes).where(eq(intakes.id, mark.id)).run();
    }
  });
  await rescheduleDoses();
}
