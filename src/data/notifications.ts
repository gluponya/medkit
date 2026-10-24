import { eq } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { localDay } from '@/domain/expiry';
import { upcomingDoses } from '@/domain/reminders';
import { UNIT } from '@/features/add/labels';
import { t } from '@/i18n';

import { db } from './db/client';
import { medicines, reminders } from './db/schema';

/**
 * Dose notifications. The phone keeps a limited number of scheduled ones, so
 * only the doses of the next days are laid out, each as a one-off alarm, and
 * the whole set is laid out again whenever reminders change or the app starts.
 */

const CHANNEL = 'doses';
const DAYS_AHEAD = 7;
/** Android keeps up to 500, iOS 64: stay well under both. */
const MAX_SCHEDULED = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks once, when the first reminder is saved; a refusal is kept by the system. */
export async function askForNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('notifications.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function rescheduleDoses(): Promise<void> {
  const rows = await db
    .select({ reminder: reminders, name: medicines.name, form: medicines.form })
    .from(reminders)
    .innerJoin(medicines, eq(medicines.id, reminders.medicineId));

  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const plans = rows.map((r) => ({ ...r.reminder, times: r.reminder.times, name: r.name, form: r.form }));
  const doses = upcomingDoses(plans, localDay(now), hhmm, DAYS_AHEAD).slice(0, MAX_SCHEDULED);

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (doses.length === 0) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  for (const d of doses) {
    const [year, month, date] = d.day.split('-').map(Number);
    const [hour, minute] = d.time.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notifications.doseTitle', { name: d.reminder.name }),
        body: t('notifications.doseBody', { dose: d.dose, unit: t(UNIT[d.reminder.form ?? 'other']), time: d.time }),
        data: { medicineId: d.reminder.medicineId, reminderId: d.reminder.id, due: `${d.day}T${d.time}` },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(year, month - 1, date, hour, minute),
        channelId: CHANNEL,
      },
    });
  }
}
