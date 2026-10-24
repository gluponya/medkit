/**
 * The State Register of Medicinal Products (docs/model.md, "Barcodes"): how its
 * free-text fields become our fields, and how a typed query becomes a search.
 *
 * Used both by tools/build-register.mjs, which makes assets/register.db from
 * the Register's CSV, and by the app, so this file imports nothing at runtime.
 */

import type { MedicineForm } from './medicine.ts';

/** Every instruction link starts with this; register.db keeps only the rest. */
export const INSTRUCTION_BASE = 'http://www.drlz.com.ua/ibp/lz_www.nsf/id/';

/** First words of «Форма випуску» → our form. Checked in this order. */
const FORM_WORDS: readonly [RegExp, MedicineForm][] = [
  [/^(таблетк|драже|льодяник|пастилк)/, 'tablets'],
  [/^капсул/, 'capsules'],
  [/^крапл/, 'drops'],
  [/^сироп/, 'syrup'],
  [/^(мазь|крем|гель|паста|лінімент)/, 'ointment'],
  [/^(спрей|аерозоль)/, 'spray'],
  [/^(порошок|гранули)/, 'powder'],
];

export function formFromRegister(formText: string): MedicineForm {
  const text = formText.trim().toLowerCase();
  return FORM_WORDS.find(([re]) => re.test(text))?.[1] ?? 'other';
}

// «10 000 МО» keeps its thousands.
const NUMBER = String.raw`(?:\d{1,3}(?: \d{3})+|\d+)(?:[.,]\d+)?`;
const UNIT = String.raw`(?:мг|мкг|г|МО|ОД|%|мл)`;
const STRENGTH = new RegExp(
  String.raw`${NUMBER}\s?${UNIT}(?:\s?\/\s?(?:${NUMBER}\s?)?(?:${UNIT}|доза|дозу|таблетку))?`,
);

/**
 * The strength as printed, from «Форма випуску»: «200 мг», «0,5 мг/0,4 мг»,
 * «100 мг/5 мл». Null when the text has none (herbs, many solutions).
 */
export function strengthFromRegister(formText: string): string | null {
  return formText.match(STRENGTH)?.[0].replace(/\s+/g, ' ') ?? null;
}

/**
 * «Умови відпуску». Some medicines are Rx only above a pack size («за рецептом:
 * № 100/без рецепта: № 10»); the smaller pack is what people keep at home, so
 * those count as without a prescription.
 */
export function rxFromRegister(conditions: string): boolean {
  const text = conditions.toLowerCase();
  return text.includes('за рецептом') && !text.includes('без рецепта');
}

/** «Термін придатності: значення» and «…: одиниця вимірювання» → months. */
export function shelfLifeMonths(value: string, unit: string): number | null {
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit.trim();
  if (u === 'рік') return Math.round(n * 12);
  if (u === 'місяць') return Math.round(n);
  return null; // days: too short to warn about a typo with
}

/** Letters people type either way: «нурофен» for «Нурофєн», Russian «ибупрофен». */
const SEARCH_LETTERS: Record<string, string> = {
  є: 'е',
  і: 'и',
  ї: 'и',
  й: 'и',
  ґ: 'г',
  ё: 'е',
  э: 'е',
  ы: 'и',
  ъ: '',
  ь: '',
};

/**
 * The form both the index and a query are written in, so the difference
 * between those letters never stops a match. The index keeps only these words,
 * never shown.
 */
export function searchText(text: string): string {
  return text.toLowerCase().replace(/[єіїйґёэыъь]/g, (c) => SEARCH_LETTERS[c]);
}

/**
 * A typed query → an FTS5 match expression. Every word is a prefix, and all of
 * them must match: «ібупрофен» finds «ібупрофену» in a composition, «нуро 200»
 * finds «Нурофєн 200 мг». Null when nothing searchable is left.
 */
export function searchQuery(text: string): string | null {
  const words = searchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) return null;
  return words.map((w) => `"${w}"*`).join(' ');
}
