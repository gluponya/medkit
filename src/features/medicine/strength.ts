import type { MedicineForm } from '@/domain/medicine';
import type { MessageKey } from '@/i18n';

/**
 * The units a strength is offered in, by form, the likeliest first: the
 * commonest in the State Register for that form, together over 99% of its
 * strengths. The first is picked for a medicine that has no strength yet.
 */
export const STRENGTH_UNITS: Record<MedicineForm, readonly MessageKey[]> = {
  tablets: ['strength.mg', 'strength.g', 'strength.mcg', 'strength.iu'],
  capsules: ['strength.mg', 'strength.iu', 'strength.g', 'strength.mcg'],
  drops: ['strength.mgPerMl', 'strength.ml', 'strength.percent', 'strength.mcgPerMl', 'strength.iuPerMl', 'strength.g'],
  syrup: ['strength.mgPerMl', 'strength.mgPer5Ml', 'strength.ml', 'strength.g', 'strength.percent'],
  ointment: ['strength.percent', 'strength.g', 'strength.mgPerG', 'strength.mcgPerG', 'strength.iuPerG'],
  spray: ['strength.mgPerMl', 'strength.percent', 'strength.ml', 'strength.mcgPerDose', 'strength.mgPerDose', 'strength.g'],
  powder: ['strength.mg', 'strength.g', 'strength.iu', 'strength.ml', 'strength.mgPerMl', 'strength.units'],
  other: [
    'strength.mgPerMl',
    'strength.ml',
    'strength.mg',
    'strength.percent',
    'strength.g',
    'strength.iu',
    'strength.iuPerMl',
    'strength.mcgPerMl',
    'strength.mcg',
    'strength.mgPerG',
    'strength.units',
    'strength.mgPerDose',
  ],
  solution: ['strength.mgPerMl', 'strength.percent', 'strength.ml', 'strength.mcgPerMl', 'strength.g', 'strength.iuPerMl'],
  injection: ['strength.mgPerMl', 'strength.ml', 'strength.mg', 'strength.percent', 'strength.iu', 'strength.mcgPerMl'],
  suspension: ['strength.mgPerMl', 'strength.mgPer5Ml', 'strength.ml', 'strength.iuPerMl', 'strength.mg', 'strength.g'],
  suppositories: ['strength.mg', 'strength.g', 'strength.iu'],
  tincture: ['strength.ml', 'strength.percent'],
  emulsion: ['strength.mgPerMl', 'strength.ml', 'strength.percent', 'strength.mgPerG'],
  herbs: ['strength.g'],
  patch: ['strength.mg', 'strength.mcg', 'strength.mcgPerG'],
};

/** Every unit offered for any form, to tell a real unit from a misspelt one. */
export const ALL_STRENGTH_UNITS: readonly MessageKey[] = [...new Set(Object.values(STRENGTH_UNITS).flat())];

/**
 * A saved strength as its number and unit: «200 мг», «0,05%». A unit not in
 * the list (a combination from the Register, «500 мг/12,5 мг») comes back as
 * it is, to be offered beside the others. Text that is not a number and a
 * unit gives an empty number.
 */
export function parseStrength(text: string): { amount: string; unit: string | null } {
  const m = text.trim().match(/^(\d[\d\s]*(?:[.,]\d+)?)\s*(\S.*)?$/);
  if (!m) return { amount: '', unit: null };
  // The Register writes some units two ways: «мкг/доза» and «мкг/дозу», «мг/ мл».
  const unit = m[2]?.trim().replace(/\/\s+/g, '/').replace(/\/доза$/, '/дозу') ?? null;
  return { amount: m[1].replace(/\s/g, '').replace('.', ','), unit };
}

/** The strength as it is saved: the percent sign without a space. */
export const formatStrength = (amount: string, unit: string): string =>
  unit === '%' ? `${amount}%` : `${amount} ${unit}`;

/**
 * The strength as it is shown: no line ever breaks inside it, so «100» never
 * ends a line with «мг» on the next one (the owner, 2026-10-29).
 */
export const shownStrength = (strength: string | null): string | null => strength?.replace(/\s+/g, ' ') ?? null;

/** What can be typed as the number: digits and one decimal comma. */
export function cleanAmount(text: string): string {
  const [whole, ...rest] = text.replace('.', ',').replace(/[^\d,]/g, '').split(',');
  return (rest.length > 0 ? `${whole},${rest.join('')}` : whole).slice(0, 8);
}
