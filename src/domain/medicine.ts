/** What a medicine is (docs/model.md, "Medicine"). */

/** The form sets the stock unit: pieces for tablets, ml for liquids. */
export const MEDICINE_FORMS = [
  'tablets',
  'capsules',
  'drops',
  'syrup',
  'ointment',
  'spray',
  'powder',
  'other',
] as const;
export type MedicineForm = (typeof MEDICINE_FORMS)[number];
