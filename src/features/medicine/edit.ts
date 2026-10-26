import { create } from 'zustand';

import type { MedicineFields } from '@/data/medicines';

/** The rows of «Деталі» answered by typing free text, each on a screen of its own. */
export type DetailsField = 'name' | 'manufacturer';

/**
 * «Деталі» while it is open: the medicine as saved and as edited. The screens
 * it opens write here, and «Деталі» saves each change as it comes (saved).
 */
interface EditState {
  medicineId: string | null;
  saved: MedicineFields | null;
  fields: MedicineFields | null;
  start: (medicineId: string, fields: MedicineFields) => void;
  set: (patch: Partial<MedicineFields>) => void;
  markSaved: (fields: MedicineFields) => void;
  reset: () => void;
}

export const useMedicineEdit = create<EditState>()((set) => ({
  medicineId: null,
  saved: null,
  fields: null,
  start: (medicineId, fields) => set({ medicineId, saved: fields, fields }),
  set: (patch) => set((s) => (s.fields ? { fields: { ...s.fields, ...patch } } : s)),
  markSaved: (fields) => set({ saved: fields }),
  reset: () => set({ medicineId: null, saved: null, fields: null }),
}));

/** The same tags, in any order. */
export const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** Whether the edit differs from what is saved; spaces around text do not count. */
export function fieldsChanged(a: MedicineFields, b: MedicineFields): boolean {
  return (
    a.name.trim() !== b.name.trim() ||
    a.form !== b.form ||
    a.strength.trim() !== b.strength.trim() ||
    a.inn.trim() !== b.inn.trim() ||
    a.manufacturer.trim() !== b.manufacturer.trim() ||
    a.lowStockThreshold !== b.lowStockThreshold ||
    a.rx !== b.rx ||
    !sameSet(a.categories, b.categories)
  );
}
