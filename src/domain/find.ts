/**
 * Search over the person's own cabinets (docs/journeys.md J6, docs/screens.md
 * "Search results"): by name and substance, or by a category, across every
 * cabinet, the current one first, expired ones greyed. Pure, so it is tested
 * without the database.
 */

import { expiryStatus, type ExpiryStatus } from './expiry.ts';
import type { MedicineForm } from './medicine.ts';
import { searchText, searchWords } from './register.ts';

/** A medicine as search sees it: what it is, its tags and its active packs. */
export interface Findable {
  id: string;
  cabinetId: string;
  name: string;
  inn: string | null;
  form: MedicineForm | null;
  strength: string | null;
  categories: readonly string[];
  /** The expiry of each active pack; null is «Не знаю». */
  packs: readonly (string | null)[];
}

export interface Found extends Findable {
  /** Expired when every pack it has is past its date. */
  status: ExpiryStatus | null;
  /** The soonest date still good, or the last one when all expired. */
  expires: string | null;
}

export interface CabinetResults {
  cabinetId: string;
  medicines: Found[];
}

/** Every typed word starts some word of the name or the substance. */
export function matchesQuery(m: Pick<Findable, 'name' | 'inn'>, query: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return false;
  const own = searchText(`${m.name} ${m.inn ?? ''}`).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.every((ways) => ways.some((w) => own.some((o) => o.startsWith(w))));
}

/** How a medicine's packs read in a result row. */
export function foundStatus(packs: readonly (string | null)[], today: string, warningDays: number): Pick<Found, 'status' | 'expires'> {
  if (packs.length === 0) return { status: null, expires: null };
  const dated = packs.filter((p): p is string => p !== null).sort();
  const good = dated.filter((d) => d >= today);
  if (good.length > 0) return { status: expiryStatus(good[0], today, warningDays), expires: good[0] };
  if (dated.length === packs.length) return { status: 'expired', expires: dated[dated.length - 1] };
  return { status: 'unknown', expires: null };
}

/**
 * The results grouped by cabinet: the current one first, then the others in
 * their own order; inside each, by name. Nothing is asked for, nothing is found.
 */
export function findMedicines(
  items: readonly Findable[],
  ask: { query: string; category: string | null },
  cabinetOrder: readonly string[],
  currentId: string | null,
  today: string,
  warningDays: (cabinetId: string) => number,
): CabinetResults[] {
  const query = ask.query.trim();
  if (!query && !ask.category) return [];
  const hits = items.filter(
    (m) => (!ask.category || m.categories.includes(ask.category)) && (!query || matchesQuery(m, query)),
  );
  const order = [...cabinetOrder].sort((a, b) => Number(b === currentId) - Number(a === currentId));
  const groups: CabinetResults[] = [];
  for (const cabinetId of order) {
    const medicines = hits
      .filter((m) => m.cabinetId === cabinetId)
      .map((m) => ({ ...m, ...foundStatus(m.packs, today, warningDays(cabinetId)) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    if (medicines.length > 0) groups.push({ cabinetId, medicines });
  }
  return groups;
}

/** How many medicines carry each tag, over every cabinet. */
export function categoryCounts(items: readonly Findable[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of items) for (const c of m.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}
