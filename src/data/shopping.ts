import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import { localDay } from '@/domain/expiry';
import { shoppingList, type ShoppingLine, type ShoppingList } from '@/domain/shopping';

import { db } from './db/client';
import { cabinets, medicines, packages, shoppingItems } from './db/schema';
import { forgetToAdd, remindToAdd } from './notifications';

/**
 * The list over every cabinet; undefined while loading. Rows whose purchase
 * has arrived are deleted as the list is read.
 */
export function useShoppingList(): ShoppingList | undefined {
  const { data: meds, updatedAt } = useLiveQuery(
    db
      .select({
        id: medicines.id,
        cabinetId: medicines.cabinetId,
        name: medicines.name,
        form: medicines.form,
        rx: medicines.rx,
        lowStockThreshold: medicines.lowStockThreshold,
        createdAt: medicines.createdAt,
      })
      .from(medicines),
  );
  const { data: packs } = useLiveQuery(
    db
      .select({
        medicineId: packages.medicineId,
        expires: packages.expires,
        quantity: packages.quantity,
        status: packages.status,
        createdAt: packages.createdAt,
      })
      .from(packages),
  );
  const { data: items, updatedAt: itemsAt } = useLiveQuery(db.select().from(shoppingItems));
  const list = useMemo(
    () => (updatedAt && itemsAt ? shoppingList(meds, packs, items, localDay(new Date())) : undefined),
    [meds, packs, items, updatedAt, itemsAt],
  );
  const done = list?.done.join() ?? '';
  useEffect(() => {
    if (!done) return;
    const ids = done.split(',');
    void db.delete(shoppingItems).where(inArray(shoppingItems.id, ids));
    void forgetToAdd(ids);
  }, [done]);
  return list;
}

/** Cabinet names by id, for «Дім» on each line. */
export function useCabinetNames(): Map<string, string> {
  const { data } = useLiveQuery(db.select({ id: cabinets.id, name: cabinets.name }).from(cabinets));
  return useMemo(() => new Map(data.map((c) => [c.id, c.name])), [data]);
}

const now = () => new Date().toISOString();

/** The round check: the line moves on to be added, and is recalled if it is not. */
export async function markBought(line: ShoppingLine, cabinet: string): Promise<void> {
  const id = line.itemId ?? uuidv7();
  if (line.itemId) {
    await db.update(shoppingItems).set({ boughtAt: now() }).where(eq(shoppingItems.id, id));
  } else {
    await db.insert(shoppingItems).values({
      id,
      cabinetId: line.cabinetId,
      medicineId: line.medicineId,
      name: line.name,
      boughtAt: now(),
    });
  }
  await remindToAdd({ id, name: line.name, cabinet });
}

/** Back to «Купити»; a derived line needs no row of its own there. */
export async function unmarkBought(line: ShoppingLine): Promise<void> {
  if (!line.itemId) return;
  await forgetToAdd([line.itemId]);
  if (line.medicineId && line.reason !== 'manual') {
    await db.delete(shoppingItems).where(eq(shoppingItems.id, line.itemId));
    return;
  }
  await db.update(shoppingItems).set({ boughtAt: null }).where(eq(shoppingItems.id, line.itemId));
}

/**
 * ×: a line by hand is deleted; a medicine's stays off the list until a new
 * pack of it is added, or «Купити нову» puts it back.
 */
export async function removeLine(line: ShoppingLine): Promise<void> {
  if (line.itemId) await forgetToAdd([line.itemId]);
  if (!line.medicineId) {
    if (line.itemId) await db.delete(shoppingItems).where(eq(shoppingItems.id, line.itemId));
    return;
  }
  if (line.itemId) {
    await db.update(shoppingItems).set({ boughtAt: null, dismissedAt: now() }).where(eq(shoppingItems.id, line.itemId));
    return;
  }
  await db.insert(shoppingItems).values({
    id: uuidv7(),
    cabinetId: line.cabinetId,
    medicineId: line.medicineId,
    name: line.name,
    dismissedAt: now(),
  });
}

/** «+» on the list: a line by hand for a cabinet. */
export async function addByHand(cabinetId: string, name: string): Promise<void> {
  await db.insert(shoppingItems).values({ id: uuidv7(), cabinetId, medicineId: null, name: name.trim() });
}

/** «Купити нову» on a pack; once is enough while the line is still open. */
export async function buyNew(medicine: { id: string; cabinetId: string; name: string }): Promise<void> {
  await db
    .delete(shoppingItems)
    .where(and(eq(shoppingItems.medicineId, medicine.id), isNotNull(shoppingItems.dismissedAt)));
  const open = await db
    .select({ id: shoppingItems.id })
    .from(shoppingItems)
    .where(and(eq(shoppingItems.medicineId, medicine.id), isNull(shoppingItems.boughtAt), isNull(shoppingItems.dismissedAt)));
  if (open.length > 0) return;
  await db
    .insert(shoppingItems)
    .values({ id: uuidv7(), cabinetId: medicine.cabinetId, medicineId: medicine.id, name: medicine.name });
}

/** Whether «Купити нову» already put the medicine on the list, still to buy. */
export function useInShopping(medicineId: string): boolean {
  const { data } = useLiveQuery(
    db
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(and(eq(shoppingItems.medicineId, medicineId), isNull(shoppingItems.boughtAt), isNull(shoppingItems.dismissedAt))),
    [medicineId],
  );
  return data.length > 0;
}
