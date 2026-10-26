import { create } from 'zustand';

import type { RegisterEntry } from '@/data/register';
import { expiryFromMonth } from '@/domain/expiry';
import type { MedicineForm } from '@/domain/medicine';

/**
 * The medicine being added, one answer per step (docs/screens.md, "Add by
 * hand"), or the Register entry it was picked from and the pack's expiry and
 * quantity ("Confirm medicine"). Kept in memory only: «Скасувати» or a
 * finished add drops it.
 */
export type AfterAdd = 'medicine' | 'reminder';

interface DraftState {
  register: RegisterEntry | null;
  name: string;
  form: MedicineForm | null;
  year: number | null;
  month: number | null;
  /** «Не знаю»: the date went with the box; year and month stay null. */
  expiryUnknown: boolean;
  /** In the form's unit; null with `counted` false means «Не рахувати, просто є». */
  quantity: number | null;
  counted: boolean;
  /** Built-in category keys or own category ids. */
  categories: string[];
  /** Where a finished add goes: the medicine, or straight to its new reminder (J3). */
  then: AfterAdd;
  /**
   * «Додати» by «Упаковки»: another pack of this medicine. Only the expiry
   * and quantity steps are asked, and the last one adds the pack.
   */
  packFor: string | null;
  set: (patch: Partial<Omit<DraftState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY = {
  register: null,
  name: '',
  form: null,
  year: null,
  month: null,
  expiryUnknown: false,
  quantity: null,
  counted: true,
  categories: [],
  then: 'medicine' as AfterAdd,
  packFor: null as string | null,
};

export const useDraft = create<DraftState>()((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));

type Expiry = Pick<DraftState, 'year' | 'month' | 'expiryUnknown'>;

/** A date is picked, or «Не знаю». */
export function expiryAnswered(d: Expiry): boolean {
  return d.expiryUnknown || (d.year !== null && d.month !== null);
}

/** What goes into Package.expires; undefined while not answered. */
export function draftExpires(d: Expiry): string | null | undefined {
  if (d.year !== null && d.month !== null) return expiryFromMonth(d.year, d.month);
  return d.expiryUnknown ? null : undefined;
}
