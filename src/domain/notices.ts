/**
 * The notifications besides doses (docs/model.md, "Notifications"): one per
 * pack before its date, a repeat of a dose not marked taken, and the weekly
 * summary. Plain planning here; data/notifications.ts schedules them.
 */

import { addDays } from './expiry.ts';

/** Expiry notices and the summary come in the morning, not at midnight. */
export const MORNING = '09:00';

export interface ExpiringPack {
  packageId: string;
  name: string;
  cabinet: string;
  expires: string;
}

/**
 * The day each pack's notice comes: `noticeDays` before its date. A notice
 * whose day is already past is not sent late; the pack shows on Home anyway.
 * Soonest first, at most `limit`.
 */
export function expiryNotices<P extends ExpiringPack>(
  packs: readonly P[],
  today: string,
  noticeDays: number,
  limit: number,
): (P & { day: string })[] {
  return packs
    .map((p) => ({ ...p, day: addDays(p.expires, -noticeDays) }))
    .filter((p) => p.day > today)
    .sort((a, b) => a.day.localeCompare(b.day))
    .slice(0, limit);
}

/** The weekly summary comes on Monday: the next one after today. */
export function nextMonday(today: string): string {
  const [year, month, date] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return addDays(today, (8 - weekday) % 7 || 7);
}

/** A time of day moved by minutes, within the day: `HH:MM`, or null past midnight. */
export function addMinutes(time: string, minutes: number): string | null {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
