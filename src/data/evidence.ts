import { useEffect, useState } from 'react';

import { evidenceNote, type EvidenceNote } from '@/domain/evidence';

import { usePrefs } from './prefs';
import { getRegisterEntries, getRegisterEntry, type RegisterEntry } from './register';

/**
 * The «Дію не доведено» marks (docs/model.md, "No proven effect"), read from the
 * Register entry a medicine was added from. Nothing at all while the person
 * has the marking off.
 */

const NONE: ReadonlySet<string> = new Set();

const noteOf = (e: RegisterEntry) =>
  evidenceNote({ name: e.name, inn: e.inn, composition: e.composition, formText: e.formText, atc: e.atc });

/** The note for one medicine, or null. */
export function useEvidenceNote(registerId: string | null): EvidenceNote | null {
  const on = usePrefs((s) => s.markNoEvidence === true);
  // Kept with the id it was read for, so another medicine never shows this one's.
  const [found, setFound] = useState<{ id: string; note: EvidenceNote | null } | null>(null);
  useEffect(() => {
    if (!on || !registerId) return;
    let live = true;
    void getRegisterEntry(registerId).then((e) => {
      if (live) setFound({ id: registerId, note: e ? noteOf(e) : null });
    });
    return () => {
      live = false;
    };
  }, [on, registerId]);
  return on && found?.id === registerId ? found.note : null;
}

/** The Register ids, of those given, that have a note. Empty while off. */
export function useNoEvidenceIds(registerIds: readonly string[]): ReadonlySet<string> {
  const on = usePrefs((s) => s.markNoEvidence === true);
  const [found, setFound] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: '', ids: NONE });
  // One string, so a new array with the same ids does not ask again.
  const key = on ? [...new Set(registerIds)].sort().join('\n') : '';
  useEffect(() => {
    if (!key) return;
    let live = true;
    void getRegisterEntries(key.split('\n')).then((entries) => {
      if (live) setFound({ key, ids: new Set(entries.filter((e) => noteOf(e) !== null).map((e) => e.id)) });
    });
    return () => {
      live = false;
    };
  }, [key]);
  return key && found.key === key ? found.ids : NONE;
}
