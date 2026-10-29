import { asc, count, eq, inArray } from 'drizzle-orm';
import { useMemo } from 'react';
import { uuidv7 } from 'uuidv7';

import type { ReminderPlan } from '@/domain/reminders';

import { db } from './db/client';
import { useLiveRows } from './live';
import { medicines, reminders } from './db/schema';
import { rescheduleDoses } from './notifications';

export type Reminder = typeof reminders.$inferSelect;

/** A medicine's reminder: undefined while loading, null when it has none. */
export function useReminder(medicineId: string): Reminder | null | undefined {
  const { data, updatedAt } = useLiveRows(
    db.select().from(reminders).where(eq(reminders.medicineId, medicineId)),
    [medicineId],
    ['reminders'],
  );
  return updatedAt ? (data[0] ?? null) : undefined;
}

/** For «Перші кроки»: whether the cabinet has any reminder yet. */
export function useReminderCount(cabinetId: string | undefined): number {
  const { data } = useLiveRows(
    db
      .select({ n: count() })
      .from(reminders)
      .innerJoin(medicines, eq(medicines.id, reminders.medicineId))
      .where(eq(medicines.cabinetId, cabinetId ?? '')),
    [cabinetId],
    ['reminders', 'medicines'],
  );
  return data[0]?.n ?? 0;
}

/** The cabinet's medicines that have a reminder, for «Вже є нагадування». */
export function useRemindedMedicines(cabinetId: string | undefined): Set<string> {
  const { data } = useLiveRows(
    db
      .select({ id: reminders.medicineId })
      .from(reminders)
      .innerJoin(medicines, eq(medicines.id, reminders.medicineId))
      .where(eq(medicines.cabinetId, cabinetId ?? '')),
    [cabinetId],
    ['reminders', 'medicines'],
  );
  return useMemo(() => new Set(data.map((r) => r.id)), [data]);
}

/**
 * Saves a medicine's reminder: the screen edits one plan per medicine. One
 * already there is changed in place, so the intakes that answer it keep
 * pointing at it; `created_at` moves to now, as Today counts doses from when
 * the plan was saved. The phone's alarms are laid out again afterwards.
 */
export async function saveReminder(medicineId: string, plan: ReminderPlan): Promise<void> {
  const fields = {
    schedule: plan.schedule,
    times: [...plan.times],
    daysOfWeek: plan.daysOfWeek ? [...plan.daysOfWeek] : null,
    start: plan.start,
    days: plan.days,
  };
  // Sync: drizzle's expo-sqlite transaction commits when the callback returns.
  db.transaction((tx) => {
    const [kept, ...extra] = tx
      .select({ id: reminders.id })
      .from(reminders)
      .where(eq(reminders.medicineId, medicineId))
      .orderBy(asc(reminders.createdAt))
      .all();
    if (kept) {
      tx.update(reminders).set({ ...fields, createdAt: new Date().toISOString() }).where(eq(reminders.id, kept.id)).run();
      if (extra.length > 0) tx.delete(reminders).where(inArray(reminders.id, extra.map((r) => r.id))).run();
    } else {
      tx.insert(reminders).values({ id: uuidv7(), medicineId, ...fields }).run();
    }
  });
  await rescheduleDoses();
}

export async function deleteReminders(medicineId: string): Promise<void> {
  await db.delete(reminders).where(eq(reminders.medicineId, medicineId));
  await rescheduleDoses();
}
