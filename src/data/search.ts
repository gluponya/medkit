import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { Findable } from '@/domain/find';

import { db } from './db/client';
import { medicineCategories, medicines, packages } from './db/schema';

/**
 * Every medicine of every cabinet with its tags and active packs, for Search.
 * Three live queries, as each follows only its own table.
 */
export function useFindables(): Findable[] {
  const { data: meds } = useLiveQuery(db.select().from(medicines));
  const { data: packs } = useLiveQuery(
    db
      .select({ medicineId: packages.medicineId, expires: packages.expires })
      .from(packages)
      .where(eq(packages.status, 'active')),
  );
  const { data: tags } = useLiveQuery(db.select().from(medicineCategories));
  return useMemo(() => {
    const packsOf = new Map<string, (string | null)[]>();
    for (const p of packs) packsOf.set(p.medicineId, [...(packsOf.get(p.medicineId) ?? []), p.expires]);
    const tagsOf = new Map<string, string[]>();
    for (const t of tags) tagsOf.set(t.medicineId, [...(tagsOf.get(t.medicineId) ?? []), t.category]);
    return meds.map((m) => ({
      id: m.id,
      cabinetId: m.cabinetId,
      name: m.name,
      inn: m.inn,
      form: m.form,
      strength: m.strength,
      categories: tagsOf.get(m.id) ?? [],
      packs: packsOf.get(m.id) ?? [],
    }));
  }, [meds, packs, tags]);
}
