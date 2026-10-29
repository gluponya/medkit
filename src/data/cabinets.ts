import { asc, count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import { localDay } from '@/domain/expiry';
import { type CabinetIcon, type CabinetMode, type Place } from '@/domain/places';

import { db } from './db/client';
import { cabinets, medicines, packages } from './db/schema';
import { rescheduleDoses } from './notifications';
import { useSession } from './session';
import { requestSync } from './sync';

export type Cabinet = typeof cabinets.$inferSelect;

/**
 * A new cabinet, made the current one. A cabinet beside others brings the
 * switcher hint on Home, unless it was seen before.
 */
export async function createCabinet(input: {
  name: string;
  place: Place;
  icon: CabinetIcon;
  mode: CabinetMode;
}): Promise<string> {
  const id = uuidv7();
  const [{ n: existing }] = await db.select({ n: count() }).from(cabinets);
  await db.insert(cabinets).values({
    id,
    name: input.name.trim(),
    place: input.place,
    icon: input.icon,
    mode: input.mode,
  });
  // A signed-in account keeps it on the server too.
  requestSync();
  const session = useSession.getState();
  session.setCurrentCabinet(id);
  if (existing > 0 && session.switcherHint === 'unseen') useSession.setState({ switcherHint: 'due' });
  return id;
}

export function useCabinets(): Cabinet[] | undefined {
  const { data, updatedAt } = useLiveQuery(db.select().from(cabinets).orderBy(asc(cabinets.createdAt)));
  // Before the first answer the list is unknown, not empty.
  return updatedAt ? data : undefined;
}

/**
 * The cabinet on screen: the one picked last, or the first one there is when
 * that one is gone. Undefined while loading, null when there are none.
 */
export function useCurrentCabinet(): Cabinet | null | undefined {
  const list = useCabinets();
  const currentId = useSession((s) => s.currentCabinetId);
  if (list === undefined) return undefined;
  return list.find((c) => c.id === currentId) ?? list[0] ?? null;
}

export function useMedicineCount(cabinetId: string | undefined): number {
  const { data } = useLiveQuery(
    db
      .select({ n: count() })
      .from(medicines)
      .where(eq(medicines.cabinetId, cabinetId ?? '')),
    [cabinetId],
  );
  return data[0]?.n ?? 0;
}

/** Cabinet settings: name, icon, warning days, expiry pushes, what it tracks. */
export async function updateCabinet(
  id: string,
  patch: Partial<{ name: string; icon: CabinetIcon; expiryWarningDays: number; expiryPush: boolean; mode: CabinetMode }>,
): Promise<void> {
  await db
    .update(cabinets)
    .set({ ...patch, ...(patch.name === undefined ? {} : { name: patch.name.trim() }) })
    .where(eq(cabinets.id, id));
  // The mode turns its doses on or off, the switch its expiry notices; the name is in them.
  await rescheduleDoses();
}

/** «Видалити аптечку»: the cabinet and everything in it (by cascade). */
export async function deleteCabinet(id: string): Promise<void> {
  await db.delete(cabinets).where(eq(cabinets.id, id));
  await rescheduleDoses();
  const { currentCabinetId, setCurrentCabinet } = useSession.getState();
  if (currentCabinetId !== id) return;
  const next = await db.select({ id: cabinets.id }).from(cabinets).orderBy(asc(cabinets.createdAt)).limit(1);
  if (next[0]) setCurrentCabinet(next[0].id);
}

export interface CabinetCounts {
  medicines: number;
  /** Medicines with at least one pack past its date. */
  expired: number;
}

/** For each cabinet, how many medicines and how many of them expired: the line under its name. */
export function useCabinetCounts(): Map<string, CabinetCounts> {
  const { data: meds } = useLiveQuery(
    db.select({ cabinetId: medicines.cabinetId, n: count() }).from(medicines).groupBy(medicines.cabinetId),
  );
  const { data: packs } = useLiveQuery(
    db
      .select({ cabinetId: medicines.cabinetId, medicineId: packages.medicineId, expires: packages.expires })
      .from(packages)
      .innerJoin(medicines, eq(medicines.id, packages.medicineId))
      .where(eq(packages.status, 'active')),
  );
  return useMemo(() => {
    const today = localDay(new Date());
    const counts = new Map<string, CabinetCounts>();
    for (const m of meds) counts.set(m.cabinetId, { medicines: m.n, expired: 0 });
    const expired = new Map<string, Set<string>>();
    for (const p of packs) {
      if (p.expires === null || p.expires >= today) continue;
      const set = expired.get(p.cabinetId) ?? new Set<string>();
      set.add(p.medicineId);
      expired.set(p.cabinetId, set);
    }
    for (const [cabinetId, set] of expired) {
      const c = counts.get(cabinetId);
      if (c) c.expired = set.size;
    }
    return counts;
  }, [meds, packs]);
}
