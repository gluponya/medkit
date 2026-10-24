import { asc, count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { uuidv7 } from 'uuidv7';

import { defaultMode, type CabinetIcon, type Place } from '@/domain/places';

import { db } from './db/client';
import { cabinets, medicines } from './db/schema';
import { useSession } from './session';

export type Cabinet = typeof cabinets.$inferSelect;

/** A new cabinet, made the current one. */
export async function createCabinet(input: { name: string; place: Place; icon: CabinetIcon }): Promise<string> {
  const id = uuidv7();
  await db.insert(cabinets).values({
    id,
    name: input.name.trim(),
    place: input.place,
    icon: input.icon,
    mode: defaultMode(input.place),
  });
  useSession.getState().setCurrentCabinet(id);
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
