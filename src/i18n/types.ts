/**
 * Types of the message catalogues.
 *
 * Pure: no imports, so the plural rules next to them can be tested in a plain
 * Node test, the same way the domain layer is.
 */

/** Ukrainian is the source language, English the second one. */
export type Language = 'uk' | 'en';

/**
 * CLDR plural categories, only the ones our two languages use. Ukrainian needs
 * one / few / many, English only one / other.
 */
export type PluralCategory = 'one' | 'few' | 'many' | 'other';

/**
 * A message that changes with a count. `other` is mandatory: it is what a
 * category with no form of its own falls back to, so a catalogue can never end
 * up with nothing to show.
 */
export type PluralForms = { other: string } & Partial<Record<PluralCategory, string>>;

/** A catalogue entry: plain text, or a set of forms if it counts something. */
export type Message = string | PluralForms;

/** Values substituted into `{placeholders}`. `count` also picks the plural form. */
export type MessageParams = Record<string, string | number>;
