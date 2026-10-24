import { and, asc, eq, like } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import type { IntakeMark } from '@/domain/today';

import { db } from './db/client';
import { intakes, medicines, reminders } from './db/schema';

export type TodayReminder = typeof reminders.$inferSelect & {
  /** When it was saved, `YYYY-MM-DDTHH:MM` local. */
  since: string;
  name: string;
  form: (typeof medicines.$inferSelect)['form'];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** An ISO instant as the local `YYYY-MM-DDTHH:MM` intakes use for `due`. */
function localStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The cabinet's reminders with their medicine; undefined while loading. */
export function useCabinetReminders(cabinetId: string | undefined): TodayReminder[] | undefined {
  const { data, updatedAt } = useLiveQuery(
    db
      .select({ reminder: reminders, name: medicines.name, form: medicines.form })
      .from(reminders)
      .innerJoin(medicines, eq(medicines.id, reminders.medicineId))
      .where(eq(medicines.cabinetId, cabinetId ?? ''))
      .orderBy(asc(medicines.name)),
    [cabinetId],
  );
  return updatedAt ? data.map((r) => ({ ...r.reminder, since: localStamp(r.reminder.createdAt), name: r.name, form: r.form })) : undefined;
}

/** The intakes that answer a day's doses in the cabinet. */
export function useDayIntakes(cabinetId: string | undefined, day: string): IntakeMark[] {
  const { data } = useLiveQuery(
    db
      .select({ medicineId: intakes.medicineId, due: intakes.due, status: intakes.status, at: intakes.at })
      .from(intakes)
      .innerJoin(medicines, eq(medicines.id, intakes.medicineId))
      .where(and(eq(medicines.cabinetId, cabinetId ?? ''), like(intakes.due, `${day}T%`))),
    [cabinetId, day],
  );
  return data;
}
