/**
 * The shopping list (docs/model.md, "Shopping list"): what a medicine is
 * missing, worked out from its packs, together with the lines stored by hand
 * or ticked as bought. Pure, like the rest of domain/.
 */

import type { MedicineForm } from './medicine.ts';

/** Why a line is on the list; `manual` is a line nothing derives. */
export type ShoppingReason = 'expired' | 'out' | 'low' | 'manual';

/** A ticked line is recalled this long after the tick, if its pack is still not added. */
export const ADD_REMINDER_HOURS = 2;
/** Not earlier or later than these hours: a recall at night waits for the morning. */
const DAY_FROM = 9;
const DAY_TO = 21;

export interface ShopMedicine {
  id: string;
  cabinetId: string;
  name: string;
  form: MedicineForm | null;
  rx: boolean;
  lowStockThreshold: number | null;
  createdAt: string;
}

export interface ShopPack {
  medicineId: string;
  /** Null: «Не знаю»; such a pack is not expired and puts nothing on the list. */
  expires: string | null;
  quantity: number | null;
  status: 'active' | 'used_up' | 'disposed';
  createdAt: string;
}

export interface ShopItem {
  id: string;
  cabinetId: string;
  medicineId: string | null;
  name: string;
  boughtAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface ShoppingLine {
  key: string;
  cabinetId: string;
  medicineId: string | null;
  /** The stored row behind the line, if any. */
  itemId: string | null;
  name: string;
  form: MedicineForm | null;
  rx: boolean;
  reason: ShoppingReason;
  /** Counted good stock, for «Залишилось 4 шт». */
  stock: number | null;
  boughtAt: string | null;
}

export interface ShoppingList {
  toBuy: ShoppingLine[];
  bought: ShoppingLine[];
  /** Stored rows whose purchase has arrived: to delete. */
  done: string[];
}

/** What a medicine is missing by its packs alone, or null when nothing. */
export function missing(
  medicine: Pick<ShopMedicine, 'lowStockThreshold'>,
  packs: readonly Pick<ShopPack, 'expires' | 'quantity' | 'status'>[],
  today: string,
): { reason: Exclude<ShoppingReason, 'manual'>; stock: number | null } | null {
  const active = packs.filter((p) => p.status === 'active');
  if (active.length === 0) return packs.some((p) => p.status === 'used_up') ? { reason: 'out', stock: 0 } : null;
  const good = active.filter((p) => p.expires === null || p.expires >= today);
  if (good.length === 0) return { reason: 'expired', stock: null };
  const counted = good.filter((p) => p.quantity !== null);
  if (counted.length === 0 || medicine.lowStockThreshold === null) return null;
  const stock = counted.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
  return stock <= medicine.lowStockThreshold ? { reason: 'low', stock } : null;
}

const RANK: Record<ShoppingReason, number> = { out: 0, low: 1, expired: 2, manual: 3 };

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('uk') === b.trim().toLocaleLowerCase('uk');

/**
 * The whole list: one line per medicine, stored rows
 * merged into the derived ones, «Купити» by reason then name, «Куплено» the
 * latest first.
 */
export function shoppingList(
  medicines: readonly ShopMedicine[],
  packs: readonly ShopPack[],
  items: readonly ShopItem[],
  today: string,
): ShoppingList {
  const packsOf = new Map<string, ShopPack[]>();
  for (const p of packs) {
    const list = packsOf.get(p.medicineId);
    if (list) list.push(p);
    else packsOf.set(p.medicineId, [p]);
  }
  const done: string[] = [];
  const byMedicine = new Map<string, ShopItem>();
  const dismissed = new Set<string>();
  const byHand: ShopItem[] = [];
  for (const item of items) {
    const arrived = item.medicineId
      ? (packsOf.get(item.medicineId) ?? []).some((p) => p.createdAt > item.createdAt)
      : medicines.some((m) => m.cabinetId === item.cabinetId && m.createdAt > item.createdAt && sameName(m.name, item.name));
    if (arrived) done.push(item.id);
    else if (item.medicineId && item.dismissedAt !== null) dismissed.add(item.medicineId);
    else if (item.medicineId && medicines.some((m) => m.id === item.medicineId)) byMedicine.set(item.medicineId, item);
    else if (!item.medicineId) byHand.push(item);
  }

  const lines: ShoppingLine[] = [];
  for (const m of medicines) {
    const need = missing(m, packsOf.get(m.id) ?? [], today);
    const item = byMedicine.get(m.id);
    if (!item && (!need || dismissed.has(m.id))) continue;
    lines.push({
      key: m.id,
      cabinetId: m.cabinetId,
      medicineId: m.id,
      itemId: item?.id ?? null,
      name: m.name,
      form: m.form,
      rx: m.rx,
      reason: need?.reason ?? 'manual',
      stock: need?.stock ?? null,
      boughtAt: item?.boughtAt ?? null,
    });
  }
  for (const item of byHand) {
    lines.push({
      key: item.id,
      cabinetId: item.cabinetId,
      medicineId: null,
      itemId: item.id,
      name: item.name,
      form: null,
      rx: false,
      reason: 'manual',
      stock: null,
      boughtAt: item.boughtAt,
    });
  }

  const toBuy = lines
    .filter((l) => l.boughtAt === null)
    .sort((a, b) => RANK[a.reason] - RANK[b.reason] || a.name.localeCompare(b.name, 'uk'));
  const bought = lines
    .filter((l) => l.boughtAt !== null)
    .sort((a, b) => (b.boughtAt ?? '').localeCompare(a.boughtAt ?? ''));
  return { toBuy, bought, done };
}

/**
 * When to recall a line ticked at `ticked` whose pack is not added yet:
 * a little later the same day, or the next morning if that falls at night.
 */
export function addReminderAt(ticked: Date): Date {
  const at = new Date(ticked.getTime() + ADD_REMINDER_HOURS * 3_600_000);
  if (at.getHours() >= DAY_FROM && at.getHours() < DAY_TO) return at;
  const morning = new Date(at.getFullYear(), at.getMonth(), at.getDate(), DAY_FROM + 1, 0);
  return morning > at ? morning : new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1, DAY_FROM + 1, 0);
}
