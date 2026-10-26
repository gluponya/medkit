/** What a medicine is (docs/model.md, "Medicine"). */

/** The forms offered first, as tiles; «Інше» opens OTHER_FORMS under them. */
export const MAIN_FORMS = ['tablets', 'capsules', 'drops', 'syrup', 'ointment', 'spray', 'powder', 'other'] as const;

/**
 * The commoner of the Register's other forms, offered once «Інше» is picked.
 * Plain «Інше» stays for anything else.
 */
export const OTHER_FORMS = [
  'solution',
  'injection',
  'suspension',
  'suppositories',
  'tincture',
  'emulsion',
  'herbs',
  'patch',
] as const;

/** The form sets the stock unit: pieces for tablets, ml for liquids. */
export const MEDICINE_FORMS = [...MAIN_FORMS, ...OTHER_FORMS] as const;
export type MedicineForm = (typeof MEDICINE_FORMS)[number];

/** One of the forms under «Інше», shown with «Інше» picked too. */
export const isOtherForm = (form: MedicineForm | null): boolean =>
  form !== null && (OTHER_FORMS as readonly string[]).includes(form);
