import { and, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';

import { factsFor, type SubstanceFacts } from '@/domain/body-time';
import { SUBSTANCE_FACTS } from '@/domain/substances';

import { db } from './db/client';
import { intakes } from './db/schema';
import { usePrefs } from './prefs';
import { getRegisterEntry } from './register';

/** Enough marks to see a course; older ones change nothing. */
const RECENT_DOSES = 60;

/**
 * «В організмі» on the medicine screen (docs/model.md, "Time in the body and
 * alcohol"): the substance's facts and the medicine's marked doses. Null while
 * the person has it off, or when the substance has no reviewed row.
 */
export function useBodyTime(medicineId: string, registerId: string | null): { facts: SubstanceFacts; taken: Date[] } | null {
  const on = usePrefs((s) => s.showBodyTime);
  // Kept with the id it was read for, so another medicine never shows this one's.
  const [found, setFound] = useState<{ id: string; facts: SubstanceFacts | null } | null>(null);
  useEffect(() => {
    if (!on || !registerId) return;
    let live = true;
    void getRegisterEntry(registerId).then((e) => {
      if (live) setFound({ id: registerId, facts: e?.inn ? factsFor([e.inn], SUBSTANCE_FACTS) : null });
    });
    return () => {
      live = false;
    };
  }, [on, registerId]);
  // Distinct: a dose taken out of two packs has a row for each, at one time.
  const { data } = useLiveQuery(
    db
      .selectDistinct({ at: intakes.at })
      .from(intakes)
      .where(and(eq(intakes.medicineId, medicineId), eq(intakes.status, 'taken')))
      .orderBy(desc(intakes.at))
      .limit(RECENT_DOSES),
    [medicineId],
  );
  const facts = on && found?.id === registerId ? found.facts : null;
  return facts ? { facts, taken: data.map((r) => new Date(r.at)) } : null;
}
