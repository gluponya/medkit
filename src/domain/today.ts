/**
 * The Today screen (docs/screens.md, 5-today): the doses of the day with what
 * became of each, and which one comes next. Pure, like the rest of domain/.
 */

import { daysBetween } from './expiry.ts';
import { courseEnd, dosesOn, type ReminderPlan } from './reminders.ts';

/**
 * - taken, skipped: an Intake answers the dose.
 * - missed: nothing answers it and its hour is long gone.
 * - due: its time has come, or just went by.
 * - later: still ahead.
 */
export type DoseState = 'taken' | 'skipped' | 'missed' | 'due' | 'later';

/** How long a dose stays due before it counts as missed. */
export const MISSED_AFTER_MINUTES = 60;

/**
 * Matched to a dose by medicine and due time, not by reminder: saving a
 * reminder replaces it, and the intakes of the day must still count.
 */
export interface IntakeMark {
  medicineId: string;
  /** `YYYY-MM-DDTHH:MM` local. */
  due: string | null;
  status: 'taken' | 'skipped';
  /** When it was answered, an ISO instant. */
  at: string;
}

export interface TodayDose<R> {
  reminder: R;
  time: string;
  dose: number;
  /** `YYYY-MM-DDTHH:MM` local, as an Intake records it. */
  due: string;
  state: DoseState;
  /** The Intake's instant, for «Прийнято о …». */
  at: string | null;
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * The doses of `today` in order, each with its state at `now` (`HH:MM`).
 * A reminder's `since` (`YYYY-MM-DDTHH:MM` local) is when it was saved:
 * doses before it were never asked for, so they show only when answered.
 */
export function todayDoses<R extends ReminderPlan & { medicineId: string; since: string }>(
  plans: readonly R[],
  marks: readonly IntakeMark[],
  today: string,
  now: string,
): TodayDose<R>[] {
  const doses: TodayDose<R>[] = [];
  for (const reminder of plans) {
    if (!dosesOn(reminder, today)) continue;
    for (const { time, dose } of reminder.times) {
      const due = `${today}T${time}`;
      const mark = marks.find((m) => m.medicineId === reminder.medicineId && m.due === due);
      if (!mark && due < reminder.since) continue;
      const late = minutes(now) - minutes(time);
      const state: DoseState = mark
        ? mark.status
        : late > MISSED_AFTER_MINUTES
          ? 'missed'
          : late >= 0
            ? 'due'
            : 'later';
      doses.push({ reminder, time, dose, due, state, at: mark?.at ?? null });
    }
  }
  return doses.sort((a, b) => a.time.localeCompare(b.time));
}

/** The dose the big card shows: the first one still to take. */
export function nextDose<D extends { state: DoseState }>(doses: readonly D[]): D | null {
  return doses.find((d) => d.state === 'due' || d.state === 'later') ?? null;
}

/** Minutes from `now` to a dose time, never below zero. */
export function minutesUntil(now: string, time: string): number {
  return Math.max(0, minutes(time) - minutes(now));
}

/**
 * How long a course still runs, today included: a number of days, null when
 * it goes on, 0 once it is over.
 */
export function daysLeft(plan: Pick<ReminderPlan, 'start' | 'days'>, today: string): number | null {
  const end = courseEnd(plan);
  if (end === null) return null;
  const from = today < plan.start ? plan.start : today;
  return Math.max(0, daysBetween(from, end) + 1);
}
