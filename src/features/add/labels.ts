import type { Category } from '@/domain/categories';
import type { MedicineForm } from '@/domain/medicine';
import type { MessageKey } from '@/i18n';
import type { IconName } from '@/ui/Icon';

export const FORM_NAME: Record<MedicineForm, MessageKey> = {
  tablets: 'form.tablets',
  capsules: 'form.capsules',
  drops: 'form.drops',
  syrup: 'form.syrup',
  ointment: 'form.ointment',
  spray: 'form.spray',
  powder: 'form.powder',
  other: 'form.other',
  solution: 'form.solution',
  injection: 'form.injection',
  suspension: 'form.suspension',
  suppositories: 'form.suppositories',
  tincture: 'form.tincture',
  emulsion: 'form.emulsion',
  herbs: 'form.herbs',
  patch: 'form.patch',
};

/** «Скільки капсул в упаковці?»: the question names the form's unit. */
export const QUANTITY_TITLE: Record<MedicineForm, MessageKey> = {
  tablets: 'add.quantityTitle.tablets',
  capsules: 'add.quantityTitle.capsules',
  drops: 'add.quantityTitle.ml',
  syrup: 'add.quantityTitle.ml',
  ointment: 'add.quantityTitle.grams',
  spray: 'add.quantityTitle.ml',
  powder: 'add.quantityTitle.sachets',
  other: 'add.quantityTitle.pieces',
  solution: 'add.quantityTitle.ml',
  injection: 'add.quantityTitle.pieces',
  suspension: 'add.quantityTitle.ml',
  suppositories: 'add.quantityTitle.pieces',
  tincture: 'add.quantityTitle.ml',
  emulsion: 'add.quantityTitle.ml',
  herbs: 'add.quantityTitle.grams',
  patch: 'add.quantityTitle.pieces',
};

/** The short unit inside the quantity field. */
export const UNIT: Record<MedicineForm, MessageKey> = {
  tablets: 'unit.tablets',
  capsules: 'unit.capsules',
  drops: 'unit.ml',
  syrup: 'unit.ml',
  ointment: 'unit.grams',
  spray: 'unit.ml',
  powder: 'unit.sachets',
  other: 'unit.pieces',
  solution: 'unit.ml',
  injection: 'unit.pieces',
  suspension: 'unit.ml',
  suppositories: 'unit.pieces',
  tincture: 'unit.ml',
  emulsion: 'unit.ml',
  herbs: 'unit.grams',
  patch: 'unit.pieces',
};

export const CATEGORY_NAME: Record<Category, MessageKey> = {
  pain: 'category.pain',
  cold: 'category.cold',
  allergy: 'category.allergy',
  vitamins: 'category.vitamins',
  heart: 'category.heart',
  stomach: 'category.stomach',
  antibiotics: 'category.antibiotics',
  skin: 'category.skin',
  eye_ear_nose: 'category.eyeEarNose',
  nerves_sleep: 'category.nervesSleep',
  first_aid: 'category.firstAid',
};

export const CATEGORY_ICON: Record<Category, IconName> = {
  pain: 'bolt',
  cold: 'thermometer',
  allergy: 'flower',
  vitamins: 'lemon',
  heart: 'heart',
  stomach: 'salad',
  antibiotics: 'virus',
  skin: 'droplet',
  eye_ear_nose: 'eye',
  nerves_sleep: 'moon',
  first_aid: 'first-aid-kit',
};

export const MONTH_SHORT: readonly MessageKey[] = [
  'month.short.1', 'month.short.2', 'month.short.3', 'month.short.4', 'month.short.5', 'month.short.6',
  'month.short.7', 'month.short.8', 'month.short.9', 'month.short.10', 'month.short.11', 'month.short.12',
];

/** «до кінця березня 2027»: the month in the genitive. */
export const MONTH_UNTIL: readonly MessageKey[] = [
  'month.until.1', 'month.until.2', 'month.until.3', 'month.until.4', 'month.until.5', 'month.until.6',
  'month.until.7', 'month.until.8', 'month.until.9', 'month.until.10', 'month.until.11', 'month.until.12',
];

/** The form's icon in lists: a pill for tablets, a bottle for syrup. */
export const FORM_ICON: Record<MedicineForm, IconName> = {
  tablets: 'pill',
  capsules: 'capsule',
  drops: 'droplet',
  syrup: 'bottle',
  ointment: 'bottle',
  spray: 'spray',
  powder: 'package',
  other: 'pill',
  solution: 'flask',
  injection: 'vaccine',
  suspension: 'bottle',
  suppositories: 'capsule',
  tincture: 'bottle',
  emulsion: 'flask',
  herbs: 'leaf',
  patch: 'bandage',
};
