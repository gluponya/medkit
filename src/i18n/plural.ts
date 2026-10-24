import type { Language, PluralCategory } from './types.ts';

/**
 * Plural category selection, by hand rather than through `Intl.PluralRules`.
 *
 * Hermes ships an Intl implementation, but it covers `DateTimeFormat`,
 * `NumberFormat` and `Collator` — `PluralRules` is not something to count on
 * across both platforms. Dates and numbers therefore go through `Intl`
 * while plurals do not.
 *
 * The rules below are the CLDR ones for our two languages. Ukrainian is the
 * reason this exists at all: "1 позиція / 2 позиції / 5 позицій" cannot be done
 * by appending a letter, and getting it wrong is visible in the very first
 * sentence the app shows.
 *
 * Pure and exhaustively tested: see plural.test.ts.
 */
export function pluralCategory(language: Language, count: number): PluralCategory {
  // A fraction has no plural form of its own in either language, and we never
  // count halves of anything anyway — 'other' reads correctly for both.
  if (!Number.isInteger(count)) return 'other';

  const n = Math.abs(count);

  if (language === 'en') return n === 1 ? 'one' : 'other';

  const mod10 = n % 10;
  const mod100 = n % 100;

  // The teens are the exception in every Slavic rule: 11 behaves like 5, not
  // like 1, and 12–14 like 5, not like 2.
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}
