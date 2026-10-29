/**
 * Intake reminders (docs/model.md, "Reminder"): when the doses fall, how long a
 * course runs and how much medicine it needs. Pure, like the rest of domain/.
 */

import { addDays } from './expiry.ts';

export type Schedule = 'daily' | 'days_of_week' | 'as_needed';

export interface DoseTime {
  time: string;
  dose: number;
}

export interface ReminderPlan {
  schedule: Schedule;
  times: readonly DoseTime[];
  /** 1 is Monday … 7 is Sunday. */
  daysOfWeek: readonly number[] | null;
  start: string;
  /** Null is an ongoing course. */
  days: number | null;
}

/** The times the «1 / 2 / 3 рази на день» cards start with. */
export const PRESET_TIMES: Record<1 | 2 | 3, readonly string[]> = {
  1: ['08:00'],
  2: ['08:00', '20:00'],
  3: ['08:00', '14:00', '20:00'],
};

/** The course choices besides «Постійно». */
export const COURSE_DAYS = [7, 14, 30] as const;

/** 1 is Monday … 7 is Sunday. */
export function weekday(day: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const sunday0 = new Date(Date.UTC(year, month - 1, date)).getUTCDay();
  return sunday0 === 0 ? 7 : sunday0;
}

/** The last day of a course, or null when it goes on. */
export function courseEnd(plan: Pick<ReminderPlan, 'start' | 'days'>): string | null {
  return plan.days === null ? null : addDays(plan.start, plan.days - 1);
}

/**
 * The first day of a plan saved over `saved` on `today`: a running course
 * keeps its start, so changing a time does not begin it again. A new plan, a
 * changed length or a course already over starts today.
 */
export function startOf(
  saved: Pick<ReminderPlan, 'schedule' | 'start' | 'days'> | null,
  plan: Pick<ReminderPlan, 'schedule' | 'days'>,
  today: string,
): string {
  if (!saved || saved.schedule === 'as_needed' || plan.schedule === 'as_needed' || saved.days !== plan.days) return today;
  const end = courseEnd(saved);
  return end !== null && end < today ? today : saved.start;
}

/** Whether a reminder has doses on a day. */
export function dosesOn(plan: ReminderPlan, day: string): boolean {
  if (plan.schedule === 'as_needed' || day < plan.start) return false;
  const end = courseEnd(plan);
  if (end !== null && day > end) return false;
  if (plan.schedule === 'days_of_week') return (plan.daysOfWeek ?? []).includes(weekday(day));
  return true;
}

const perDay = (plan: ReminderPlan) => plan.times.reduce((sum, t) => sum + t.dose, 0);

/** How much a course takes from start to end; null when it goes on or is as needed. */
export function unitsNeeded(plan: ReminderPlan): number | null {
  if (plan.days === null || plan.schedule === 'as_needed') return null;
  let total = 0;
  for (let i = 0; i < plan.days; i++) if (dosesOn(plan, addDays(plan.start, i))) total += perDay(plan);
  return total;
}

/** Whole days the stock lasts; null when it cannot be told. */
export function daysOfSupply(plan: ReminderPlan, stock: number | null): number | null {
  if (stock === null || plan.schedule === 'as_needed') return null;
  const daysAWeek = plan.schedule === 'days_of_week' ? (plan.daysOfWeek?.length ?? 0) : 7;
  const perWeek = perDay(plan) * daysAWeek;
  return perWeek === 0 ? null : Math.floor((stock / perWeek) * 7);
}

export interface Dose<R> {
  reminder: R;
  day: string;
  time: string;
  dose: number;
}

/**
 * The doses of the next `days` days from `today` at `now` (`HH:MM`), in
 * order; those of today already past are left out.
 */
export function upcomingDoses<R extends ReminderPlan>(
  plans: readonly R[],
  today: string,
  now: string,
  days: number,
): Dose<R>[] {
  const doses: Dose<R>[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    for (const reminder of plans) {
      if (!dosesOn(reminder, day)) continue;
      for (const { time, dose } of reminder.times) {
        if (i === 0 && time <= now) continue;
        doses.push({ reminder, day, time, dose });
      }
    }
  }
  return doses.sort((a, b) => a.day.localeCompare(b.day) || a.time.localeCompare(b.time));
}
