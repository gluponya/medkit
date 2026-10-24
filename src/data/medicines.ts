import { and, asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import type { MedicineForm } from '@/domain/medicine';
import type { PackRow } from '@/domain/overview';
import { packOrder, packToTake } from '@/domain/stock';

import { db } from './db/client';
import { intakes, medicineCategories, medicines, packages } from './db/schema';

export type Medicine = typeof medicines.$inferSelect;
export type Package = typeof packages.$inferSelect;

/** A new medicine with its first pack and its tags, all or nothing. */
export async function addMedicine(input: {
  cabinetId: string;
  name: string;
  form: MedicineForm;
  expires: string;
  quantity: number | null;
  categories: readonly string[];
}): Promise<string> {
  const medicineId = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(medicines).values({
      id: medicineId,
      cabinetId: input.cabinetId,
      name: input.name.trim(),
      form: input.form,
    });
    await tx.insert(packages).values({
      id: uuidv7(),
      medicineId,
      expires: input.expires,
      quantity: input.quantity,
    });
    if (input.categories.length > 0) {
      await tx
        .insert(medicineCategories)
        .values(input.categories.map((category) => ({ medicineId, category })));
    }
  });
  return medicineId;
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
      for (const p of own) rows.push({ ...base, expires: p.expires, quantity: p.quantity });
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

export function useMedicineCategories(medicineId: string): string[] {
  const { data } = useLiveQuery(
    db.select().from(medicineCategories).where(eq(medicineCategories.medicineId, medicineId)),
    [medicineId],
  );
  return useMemo(() => data.map((c) => c.category), [data]);
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

export async function disposePack(packageId: string): Promise<void> {
  await db.update(packages).set({ status: 'disposed' }).where(eq(packages.id, packageId));
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
}
