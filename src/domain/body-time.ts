/**
 * Time in the body and alcohol (docs/model.md): when a medicine is gone, whether
 * a course builds it up, and what its instruction says about alcohol. Pure; the
 * facts come from SUBSTANCE_FACTS, the doses from the person's own marks.
 */

export type AlcoholRule = 'forbidden' | 'avoid' | 'caution' | 'not_mentioned';

export interface Hours {
  min: number;
  max: number;
}

export interface SubstanceFacts {
  /** The INN as the Register spells it. */
  inn: string;
  halfLifeHours: Hours;
  /** An active metabolite that stays longer than the drug. */
  metaboliteHalfLifeHours?: Hours;
  alcohol: AlcoholRule;
  /** Only when the instruction names a wait after the last dose. */
  alcoholWaitHours?: number;
  /** The instruction's own sentence about alcohol; none for `not_mentioned`. */
  alcoholQuote?: string;
  /** The instruction the facts were read from. */
  source: string;
  /** A person has checked the row against the source; unreviewed rows are not used. */
  reviewed: boolean;
}

/** After this many half-lives about 97% is gone. */
export const HALF_LIVES_TO_CLEAR = 5;

const STRICTNESS: readonly AlcoholRule[] = ['not_mentioned', 'caution', 'avoid', 'forbidden'];

/** The longest half-life of a row: drug or metabolite, top of the range. */
export function longestHalfLife(f: SubstanceFacts): number {
  return Math.max(f.halfLifeHours.max, f.metaboliteHalfLifeHours?.max ?? 0);
}

/**
 * The facts for a medicine's substances, or null when one of them has no
 * reviewed row: a number for part of a medicine would be a guess. Several
 * substances take the longest half-life and the strictest alcohol rule.
 */
export function factsFor(inns: readonly string[], list: readonly SubstanceFacts[]): SubstanceFacts | null {
  if (inns.length === 0) return null;
  const rows: SubstanceFacts[] = [];
  for (const inn of inns) {
    const key = inn.trim().toLowerCase();
    const row = list.find((f) => f.reviewed && f.inn.toLowerCase() === key);
    if (!row) return null;
    rows.push(row);
  }
  return rows.reduce((a, b) => {
    const longer = longestHalfLife(b) > longestHalfLife(a) ? b : a;
    const stricter = STRICTNESS.indexOf(b.alcohol) > STRICTNESS.indexOf(a.alcohol) ? b : a;
    return {
      ...longer,
      alcohol: stricter.alcohol,
      alcoholQuote: stricter.alcoholQuote,
      alcoholWaitHours: Math.max(a.alcoholWaitHours ?? 0, b.alcoholWaitHours ?? 0) || undefined,
    };
  });
}

export interface BodyTime {
  /** How long it takes to go, in hours, from one dose. */
  clearHours: number;
  /** The latest marked dose; null when none is marked. */
  lastDose: Date | null;
  /** Last dose + 5 half-lives, rounded up to the hour. */
  goneBy: Date | null;
  /** Taken as a course with doses closer than the half-life. */
  buildsUp: boolean;
  /** The later of «gone by» and the wait the instruction names; null without a wait. */
  alcoholFrom: Date | null;
}

const HOUR = 3_600_000;

function ceilHour(ms: number): Date {
  return new Date(Math.ceil(ms / HOUR) * HOUR);
}

/**
 * From the marked doses (any order). A course builds up when at least three
 * doses fall within the last 5 half-lives and their mean gap is shorter than
 * the half-life.
 */
export function bodyTime(facts: SubstanceFacts, taken: readonly Date[]): BodyTime {
  const half = longestHalfLife(facts);
  const clearHours = HALF_LIVES_TO_CLEAR * half;
  if (taken.length === 0) return { clearHours, lastDose: null, goneBy: null, buildsUp: false, alcoholFrom: null };
  const times = taken.map((d) => d.getTime()).sort((a, b) => a - b);
  const last = times[times.length - 1];
  const course = times.filter((t) => t >= last - clearHours * HOUR);
  const meanGap = course.length > 1 ? (last - course[0]) / (course.length - 1) / HOUR : Infinity;
  const goneBy = ceilHour(last + clearHours * HOUR);
  const alcoholFrom =
    facts.alcoholWaitHours === undefined
      ? null
      : ceilHour(Math.max(goneBy.getTime(), last + facts.alcoholWaitHours * HOUR));
  return {
    clearHours,
    lastDose: new Date(last),
    goneBy,
    buildsUp: course.length >= 3 && meanGap < half,
    alcoholFrom,
  };
}
