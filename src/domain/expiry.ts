/**
 * Expiry dates and the statuses derived from them (docs/model.md, "Package" and
 * "Derived statuses").
 *
 * Dates are calendar days written as `YYYY-MM-DD` strings, never `Date`s: a pack
 * expires on a day, not at an instant, and a string compares correctly whatever
 * the phone's time zone is.
 */

/** `unknown`: no date, she picked «Не знаю» (the box is gone, a loose blister). */
export type ExpiryStatus = 'expired' | 'expiring' | 'unknown' | 'good';

/** Default for `Cabinet.expiry_warning_days`. */
export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

/**
 * The day a pack stops being good, from the month and year printed on it.
 * Packs print «03.2027»; the medicine is good to the end of that month.
 */
export function expiryFromMonth(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(last)}`;
}

/** The month and year to show, as on the pack: `{ year: 2027, month: 3 }`. */
export function expiryMonth(expires: string): { year: number; month: number } {
  const [year, month] = expires.split('-').map(Number);
  return { year, month };
}

/** Today in the phone's own calendar, as `YYYY-MM-DD`. */
export function localDay(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A calendar day moved by whole days. */
export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + days));
  return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}

/** One pack has exactly one status. */
export function expiryStatus(expires: string | null, today: string, warningDays: number): ExpiryStatus {
  if (expires === null) return 'unknown';
  if (expires < today) return 'expired';
  if (expires <= addDays(today, warningDays)) return 'expiring';
  return 'good';
}

const RANK: Record<ExpiryStatus, number> = { expired: 0, expiring: 1, unknown: 2, good: 3 };

/** A medicine shows the worst of its active packs; none at all reads as good. */
export function worstStatus(statuses: readonly ExpiryStatus[]): ExpiryStatus {
  let worst: ExpiryStatus = 'good';
  for (const status of statuses) if (RANK[status] < RANK[worst]) worst = status;
  return worst;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Whole months from this month to the printed one: «Ще 17 міс.». Zero is the
 * current month, below zero the pack is already out of date.
 */
export function monthsLeft(today: string, year: number, month: number): number {
  const [y, m] = today.split('-').map(Number);
  return year * 12 + month - (y * 12 + m);
}

/** Whole days from one calendar day to another: «Термін: 17 днів». */
export function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * Whole years a pack with an unknown expiry has been in the cabinet, once that
 * is longer than the Register's shelf life: «Термін невідомий, додано 3 роки
 * тому». Null while it may still be good, or when the shelf life is not known.
 */
export function unknownForYears(addedOn: string, today: string, shelfLifeMonths: number | null): number | null {
  if (shelfLifeMonths === null) return null;
  const [y, m, d] = addedOn.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  if (months <= shelfLifeMonths) return null;
  return Math.max(1, Math.floor(months / 12));
}
