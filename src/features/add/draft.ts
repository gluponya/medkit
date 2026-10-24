import { create } from 'zustand';

import type { MedicineForm } from '@/domain/medicine';

/**
 * The medicine being added by hand, one answer per step (docs/screens.md, "Add
 * by hand"). Kept in memory only: «Скасувати» or a finished add drops it.
 */
interface DraftState {
  name: string;
  form: MedicineForm | null;
  year: number | null;
  month: number | null;
  /** In the form's unit; null with `counted` false means «Не рахувати, просто є». */
  quantity: number | null;
  counted: boolean;
  /** Built-in category keys or own category ids. */
  categories: string[];
  set: (patch: Partial<Omit<DraftState, 'set' | 'reset'>>) => void;
  reset: () => void;
}

const EMPTY = {
  name: '',
  form: null,
  year: null,
  month: null,
  quantity: null,
  counted: true,
  categories: [],
};

export const useDraft = create<DraftState>()((set) => ({
  ...EMPTY,
  set: (patch) => set(patch),
  reset: () => set(EMPTY),
}));
