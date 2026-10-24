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

/** What a pack is counted in, by form, as «Форма випуску» writes it. */
const PACK_UNIT: Record<MedicineForm, RegExp> = {
  tablets: /^(таблет|драже|льодяник|пастил)/,
  capsules: /^капсул/,
  drops: /^мл(?![а-яіїєґ])/,
  syrup: /^мл(?![а-яіїєґ])/,
  spray: /^мл(?![а-яіїєґ])/,
  ointment: /^г(?![а-яіїєґ])/,
  powder: /^(саше|пакет)/,
  other: /^(супозитор|саше|пакет|ампул|песар|пластир)/,
};

/**
 * The pack sizes «Форма випуску» lists, in the form's unit, smallest first:
 * «по 12 таблеток у блістері; по 1 або 2 блістери в коробці» → 12, 24. Each
 * «;» part is one layer; a count of blisters multiplies the count before it.
 * Empty when the text gives none (herbs, many solutions).
 */
export function packSizes(formText: string, form: MedicineForm): number[] {
  const sizes: number[] = [];
  for (const part of formText.toLowerCase().split(';')) {
    let inner: number | null = null;
    for (const m of part.matchAll(/по (\d+(?:,\d+)?) ?(\S+)/g)) {
      if (PACK_UNIT[form].test(m[2])) inner = Number(m[1].replace(',', '.'));
    }
    if (inner !== null) {
      sizes.push(inner);
      continue;
    }
    const outer = part.match(/по (\d+)(?: або (?:по )?(\d+))? (блістер|стрип|контурн)/);
    const last = sizes.pop();
    if (last === undefined) continue;
    if (outer) for (const k of [outer[1], outer[2]].filter(Boolean)) sizes.push(last * Number(k));
    else sizes.push(last);
  }
  return [...new Set(sizes.filter((n) => n > 0 && Number.isInteger(n)))].sort((a, b) => a - b);
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

/** Latin spellings, longest first, already in searchText() form. */
const LATIN_LETTERS: readonly [string, string][] = [
  ['shch', 'щ'],
  ['sch', 'щ'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['ts', 'ц'],
  ['tz', 'ц'],
  ['ph', 'ф'],
  ['th', 'т'],
  ['ck', 'к'],
  ['qu', 'кв'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['ye', 'е'],
  ['yo', 'е'],
  ['ce', 'це'],
  ['ci', 'ци'],
  ['cy', 'ци'],
  ['a', 'а'],
  ['b', 'б'],
  ['c', 'к'],
  ['d', 'д'],
  ['e', 'е'],
  ['f', 'ф'],
  ['g', 'г'],
  ['h', 'х'],
  ['i', 'и'],
  ['j', 'и'],
  ['k', 'к'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['q', 'к'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['v', 'в'],
  ['w', 'в'],
  ['x', 'кс'],
  ['y', 'и'],
  ['z', 'з'],
];

/**
 * A word typed in Latin, as it would be in Cyrillic: «nurofen» → «нурофен».
 * The Register writes trade names only in Cyrillic, and people often type on an
 * English keyboard. Null for a word with no Latin letters.
 */
export function latinToCyrillic(word: string): string | null {
  if (!/[a-z]/.test(word)) return null;
  let out = '';
  for (let i = 0; i < word.length; ) {
    const pair = LATIN_LETTERS.find(([latin]) => word.startsWith(latin, i));
    if (pair) {
      out += pair[1];
      i += pair[0].length;
    } else out += word[i++];
  }
  return out;
}

/** The typed words, each with its Cyrillic reading when typed in Latin. */
function searchWords(text: string): string[][] {
  return searchText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => {
      const cyrillic = latinToCyrillic(w);
      return cyrillic && cyrillic !== w ? [w, cyrillic] : [w];
    });
}

/**
 * A typed query → an FTS5 match expression. Every word is a prefix, and all of
 * them must match: «ібупрофен» finds «ібупрофену» in a composition, «нуро 200»
 * finds «Нурофєн 200 мг». A Latin word also matches its Cyrillic reading, so
 * «nurofen» finds «Нурофєн» and «ibuprofen» still finds the Latin INN. Null when
 * nothing searchable is left.
 */
export function searchQuery(text: string): string | null {
  const words = searchWords(text);
  if (words.length === 0) return null;
  return words
    .map((ways) => (ways.length === 1 ? `"${ways[0]}"*` : `(${ways.map((w) => `"${w}"*`).join(' OR ')})`))
    .join(' AND ');
}

/**
 * The Register writes names in capitals with marks: «НУРОФЄН® ДЛЯ ДІТЕЙ». The
 * app shows them as a sentence, «Нурофєн для дітей», as the box reads.
 */
export function displayName(name: string): string {
  const text = name.replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('uk');
  return text.charAt(0).toLocaleUpperCase('uk') + text.slice(1);
}

/**
 * The first word of «Форма випуску», for a form the app has no name of its own
 * for: «суспензія», «супозиторії», «розчин».
 */
export function formWord(formText: string): string | null {
  return formText.trim().match(/^\p{L}+/u)?.[0].toLocaleLowerCase('uk') ?? null;
}

type Listed = { name: string; form: MedicineForm; strength: string | null; formText: string };

/**
 * The Register lists a medicine once per maker and per flavour; for a cabinet
 * they are the same thing. Keeps the first (best) entry of each name, form and
 * strength.
 */
export function distinctEntries<T extends Listed>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const form = e.form === 'other' ? formWord(e.formText) : e.form;
    const key = [searchText(displayName(e.name)), form, e.strength].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The international name, or null for a medicine of several substances: the
 * Register writes those as «Comb drug» or «Ibuprofen, combinations».
 */
export function singleInn(inn: string | null): string | null {
  return inn && !/comb/i.test(inn) ? inn : null;
}

/** The brand of a trade name, its first word: «Нурофєн» for «Нурофєн для дітей». */
export function brandOf(name: string): string {
  return displayName(name).split(' ')[0];
}

/** Edits between two words; a swap of two neighbours counts as one («нуорфен»). */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

/**
 * Brands spelled close to a query that found nothing: «нуррфен» → «Нурофєн».
 * The longest typed word is compared with the start of each brand, so a word
 * typed halfway («нуррф») also finds it. Up to `max`, closest first.
 */
export function closeBrands(query: string, brands: readonly string[], max = 3): string[] {
  const word = searchWords(query)
    .map((ways) => ways[ways.length - 1])
    .sort((a, b) => b.length - a.length)[0];
  if (!word || word.length < 4) return [];
  const allowed = word.length < 7 ? 1 : 2;
  const scored: { brand: string; distance: number }[] = [];
  for (const brand of brands) {
    const normal = searchText(brand);
    let distance = Infinity;
    for (let n = word.length - allowed; n <= word.length + allowed; n++)
      if (n > 0 && n <= normal.length) distance = Math.min(distance, editDistance(word, normal.slice(0, n)));
    if (distance <= allowed) scored.push({ brand, distance });
  }
  // «Парацетамол-дарниця» adds nothing next to «Парацетамол»: its search lists both.
  const picked: string[] = [];
  for (const { brand } of scored.sort((a, b) => a.distance - b.distance)) {
    const normal = searchText(brand);
    if (picked.some((p) => normal.startsWith(searchText(p) + '-'))) continue;
    picked.push(brand);
    if (picked.length === max) break;
  }
  return picked;
}

/**
 * Search results in two parts. `named`: what was typed is in the name, best
 * first. `alsoContain`: the rest, found by the substance, one entry per brand,
 * so «ібупрофен» lists «Нурофєн» once and not its twenty forms.
 */
export function splitResults<T extends { name: string }>(
  entries: readonly T[],
  query: string,
): { named: T[]; alsoContain: T[] } {
  const named: T[] = [];
  const alsoContain: T[] = [];
  const brands = new Set<string>();
  for (const e of entries) {
    if (matchParts(displayName(e.name), query).some((p) => p.match)) named.push(e);
    else {
      const brand = searchText(brandOf(e.name));
      if (brands.has(brand)) continue;
      brands.add(brand);
      alsoContain.push(e);
    }
  }
  return { named, alsoContain };
}

/**
 * The name cut where the typed words match, so the matched part can be bold:
 * «нуро» over «Нурофєн форте» → «Нуро» bold, «фєн форте» plain.
 */
export function matchParts(name: string, query: string): { text: string; match: boolean }[] {
  const words = searchWords(query).flat();
  const parts: { text: string; match: boolean }[] = [];
  const push = (text: string, match: boolean) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last && last.match === match) last.text += text;
    else parts.push({ text, match });
  };
  for (const piece of name.split(/([\p{L}\p{N}]+)/u)) {
    const normal = searchText(piece);
    const word = words.filter((w) => normal.startsWith(w)).sort((a, b) => b.length - a.length)[0];
    if (!word) {
      push(piece, false);
      continue;
    }
    // ь and ъ drop out of the normal form, so the cut is found letter by letter.
    let end = 0;
    while (searchText(piece.slice(0, end)).length < word.length) end++;
    push(piece.slice(0, end), true);
    push(piece.slice(end), false);
  }
  return parts;
}
