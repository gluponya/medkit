import { MEDICINE_FORMS, type MedicineForm } from './medicine.ts';
import { brandOf, searchText } from './register.ts';

/**
 * What a photo of a box says (docs/model.md, "A photo of the box"): the
 * model's answer from recognise-box, checked key by key. It is never the
 * medicine itself, only the query for the Register search and the expiry to
 * fill in, which the person confirms.
 */
export interface BoxReading {
  name: string | null;
  inn: string | null;
  strength: string | null;
  form: MedicineForm | null;
  packSize: number | null;
  manufacturer: string | null;
  expires: { year: number; month: number } | null;
}

/** The answer when the photo is of something else. */
export const NOT_A_BOX = 'not-a-box';

const text = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed && trimmed.length <= 120 ? trimmed : null;
};

/** "YYYY-MM", as the prompt asks; anything else is no date at all. */
export function expiryFromAnswer(value: unknown): BoxReading['expires'] {
  if (typeof value !== 'string') return null;
  const match = /^(20\d\d)-(0[1-9]|1[0-2])$/.exec(value.trim());
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
}

const isAnswer = (answer: unknown): answer is Record<string, unknown> =>
  typeof answer === 'object' && answer !== null && !Array.isArray(answer);

/** The front's answer; NOT_A_BOX when the model saw no medicine box. */
export function readFront(answer: unknown): BoxReading | typeof NOT_A_BOX {
  if (!isAnswer(answer)) return { name: null, inn: null, strength: null, form: null, packSize: null, manufacturer: null, expires: null };
  if (answer.notABox === true) return NOT_A_BOX;
  const form = MEDICINE_FORMS.find((f) => f === answer.form) ?? null;
  const size = answer.packSize;
  return {
    name: text(answer.name),
    inn: text(answer.inn),
    strength: text(answer.strength),
    form,
    packSize: typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= 1000 ? size : null,
    manufacturer: text(answer.manufacturer),
    expires: expiryFromAnswer(answer.expires),
  };
}

/** The flap's answer: only its expiry. */
export function readFlap(answer: unknown): BoxReading['expires'] {
  return isAnswer(answer) ? expiryFromAnswer(answer.expires) : null;
}

/** What the Register is searched for: the name, or the substance when no name was read. */
export function boxQuery(reading: BoxReading): string | null {
  return reading.name ?? reading.inn;
}

/** The numbers of a strength, so «75 мг» and «75мг» and «0,5 %» and «0.5%» are one. */
export function strengthKey(strength: string | null): string | null {
  const numbers = strength?.match(/\d+(?:[.,]\d+)?/g);
  return numbers ? numbers.map((n) => n.replace(',', '.')).join('/') : null;
}

type Candidate = { name: string; form: MedicineForm; strength: string | null };

/**
 * The Register's entries for the box, the likeliest first: the same name
 * counts most, then the same strength, then the same form. Ties keep the
 * search's order. `best` is the first when its name is the box's: only then
 * is it «Найкращий збіг»; otherwise every entry is merely like it.
 */
export function rankForBox<T extends Candidate>(entries: readonly T[], reading: BoxReading): { best: T | null; others: T[] } {
  const name = reading.name ? searchText(reading.name) : null;
  const strength = strengthKey(reading.strength);
  const sameName = (e: T) => name !== null && searchText(brandOf(e.name)) === searchText(brandOf(name));
  const score = (e: T) =>
    (sameName(e) ? 4 : 0) +
    (strength !== null && strengthKey(e.strength) === strength ? 2 : 0) +
    (reading.form !== null && e.form === reading.form ? 1 : 0);
  const ranked = entries
    .map((e, i) => ({ e, i, s: score(e) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(({ e }) => e);
  const first = ranked[0];
  return first && sameName(first) ? { best: first, others: ranked.slice(1) } : { best: null, others: ranked };
}
