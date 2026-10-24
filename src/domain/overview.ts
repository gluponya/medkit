/**
 * What Home shows for a cabinet (docs/screens.md, "Home"): «Потребує уваги»
 * first, expired, then expiring, then low on stock; every other medicine
 * below it. Pure, so it is tested without the database.
 */

import { daysBetween, expiryStatus, type ExpiryStatus } from './expiry.ts';
import type { MedicineForm } from './medicine.ts';

/** One active pack of a medicine, or the medicine alone when it has none. */
export interface PackRow {
  medicineId: string;
  name: string;
  form: MedicineForm | null;
  lowStockThreshold: number | null;
  expires: string | null;
  quantity: number | null;
}

export interface MedicineSummary {
  id: string;
  name: string;
  form: MedicineForm | null;
  /** The soonest expiry of its active packs. */
  expires: string | null;
  status: ExpiryStatus;
  daysLeft: number | null;
  /** Counted stock over the active packs; null when no pack is counted. */
  stock: number | null;
  low: boolean;
}

export type AttentionReason = 'expired' | 'expiring' | 'low';

export interface Overview {
  attention: (MedicineSummary & { reason: AttentionReason })[];
  rest: MedicineSummary[];
  total: number;
}

const REASON_RANK: Record<AttentionReason, number> = { expired: 0, expiring: 1, low: 2 };

export function overview(rows: readonly PackRow[], today: string, warningDays: number): Overview {
  const byMedicine = new Map<string, PackRow[]>();
  for (const row of rows) {
    const list = byMedicine.get(row.medicineId);
    if (list) list.push(row);
    else byMedicine.set(row.medicineId, [row]);
  }

  const attention: Overview['attention'] = [];
  const rest: MedicineSummary[] = [];
  for (const [id, packs] of byMedicine) {
    const first = packs[0];
    const dated = packs.filter((p) => p.expires !== null).map((p) => p.expires as string);
    const expires = dated.length > 0 ? dated.reduce((a, b) => (a < b ? a : b)) : null;
    const counted = packs.filter((p) => p.expires !== null && p.quantity !== null);
    const stock = counted.length > 0 ? counted.reduce((sum, p) => sum + (p.quantity ?? 0), 0) : null;
    const status = expires ? expiryStatus(expires, today, warningDays) : 'good';
    const low = stock !== null && first.lowStockThreshold !== null && stock <= first.lowStockThreshold;
    const summary: MedicineSummary = {
      id,
      name: first.name,
      form: first.form,
      expires,
      status,
      daysLeft: expires ? daysBetween(today, expires) : null,
      stock,
      low,
    };
    const reason: AttentionReason | null = status !== 'good' ? status : low ? 'low' : null;
    if (reason) attention.push({ ...summary, reason });
    else rest.push(summary);
  }

  attention.sort(
    (a, b) => REASON_RANK[a.reason] - REASON_RANK[b.reason] || (a.expires ?? '').localeCompare(b.expires ?? ''),
  );
  rest.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  return { attention, rest, total: byMedicine.size };
}
