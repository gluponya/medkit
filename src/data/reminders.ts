import { count, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { uuidv7 } from 'uuidv7';

import type { ReminderPlan } from '@/domain/reminders';

import { db } from './db/client';
import { medicines, reminders } from './db/schema';
import { rescheduleDoses } from './notifications';

export type Reminder = typeof reminders.$inferSelect;

/** A medicine's reminder: undefined while loading, null when it has none. */
export function useReminder(medicineId: string): Reminder | null | undefined {
  const { data, updatedAt } = useLiveQuery(
    db.select().from(reminders).where(eq(reminders.medicineId, medicineId)),
    [medicineId],
  );
  return updatedAt ? (data[0] ?? null) : undefined;
}

/** For «Перші кроки»: whether the cabinet has any reminder yet. */
export function useReminderCount(cabinetId: string | undefined): number {
  const { data } = useLiveQuery(
    db
      .select({ n: count() })
      .from(reminders)
      .innerJoin(medicines, eq(medicines.id, reminders.medicineId))
      .where(eq(medicines.cabinetId, cabinetId ?? '')),
    [cabinetId],
  );
  return data[0]?.n ?? 0;
}

/**
 * Saves a medicine's reminder, replacing the one it had: the screen edits one
 * plan per medicine. The phone's alarms are laid out again afterwards.
 */
export async function saveReminder(medicineId: string, plan: ReminderPlan): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(reminders).where(eq(reminders.medicineId, medicineId));
    await tx.insert(reminders).values({
      id: uuidv7(),
      medicineId,
      schedule: plan.schedule,
      times: [...plan.times],
      daysOfWeek: plan.daysOfWeek ? [...plan.daysOfWeek] : null,
      start: plan.start,
      days: plan.days,
    });
  });
  await rescheduleDoses();
}

export async function deleteReminders(medicineId: string): Promise<void> {
  await db.delete(reminders).where(eq(reminders.medicineId, medicineId));
  await rescheduleDoses();
}
