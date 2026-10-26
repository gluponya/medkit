import { and, eq, gte, isNotNull } from 'drizzle-orm';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { expiryStatus, localDay } from '@/domain/expiry';
import { addMinutes, expiryNotices, MORNING, nextMonday } from '@/domain/notices';
import { upcomingDoses } from '@/domain/reminders';
import { addReminderAt } from '@/domain/shopping';
import { UNIT } from '@/features/add/labels';
import { t } from '@/i18n';

import { db } from './db/client';
import { cabinets, intakes, medicines, packages, reminders } from './db/schema';
import { usePrefs } from './prefs';

/**
 * Scheduled notifications: doses and their repeats, a notice before each
 * pack's date and the weekly summary. The phone keeps a limited number of
 * scheduled ones, so only the next days are laid out, each as a one-off
 * alarm, and the whole set is laid out again whenever something changes or
 * the app comes to the front.
 */

const CHANNEL = 'doses';
const SHOPPING_CHANNEL = 'shopping';
const NOTICE_CHANNEL = 'notices';
const DAYS_AHEAD = 7;
/** Android keeps up to 500, iOS 64: stay well under both. */
const MAX_SCHEDULED = 60;
/** Of those, kept for the packs whose date comes soonest. */
const EXPIRY_SLOTS = 8;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks once, when the first reminder or medicine is saved; a refusal is kept by the system. */
export async function askForNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('notifications.channel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(NOTICE_CHANNEL, {
      name: t('notifications.noticeChannel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const repeatId = (reminderId: string, due: string) => `repeat-${reminderId}-${due}`;

const at = (day: string, time: string) => {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, date, hour, minute);
};

const shortDate = (day: string) => day.split('-').reverse().join('.');

interface Planned {
  identifier?: string;
  when: Date;
  content: Notifications.NotificationContentInput;
  channelId: string;
}

/**
 * Lays out every notification again. Doses come only from cabinets that track
 * intake: in «Тільки терміни» a reminder is kept but stays quiet.
 */
export async function rescheduleDoses(): Promise<void> {
  const { expiryNoticeDays, missedRepeatMinutes, weeklyDigest } = usePrefs.getState();
  const now = new Date();
  const today = localDay(now);
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = await db
    .select({ reminder: reminders, name: medicines.name, form: medicines.form })
    .from(reminders)
    .innerJoin(medicines, eq(medicines.id, reminders.medicineId))
    .innerJoin(cabinets, eq(cabinets.id, medicines.cabinetId))
    .where(eq(cabinets.mode, 'with_intake'));
  const marks = await db
    .select({ reminderId: intakes.reminderId, due: intakes.due })
    .from(intakes)
    .where(gte(intakes.due, today));
  const answered = new Set(marks.map((i) => `${i.reminderId}|${i.due}`));
  const packs = await db
    .select({
      packageId: packages.id,
      expires: packages.expires,
      name: medicines.name,
      cabinet: cabinets.name,
      warningDays: cabinets.expiryWarningDays,
    })
    .from(packages)
    .innerJoin(medicines, eq(medicines.id, packages.medicineId))
    .innerJoin(cabinets, eq(cabinets.id, medicines.cabinetId))
    // A cabinet with «Сповіщення про термін» off still shows its dates at home, with no pushes.
    .where(and(eq(packages.status, 'active'), isNotNull(packages.expires), eq(cabinets.expiryPush, true)));
  const dated = packs.flatMap((p) => (p.expires === null ? [] : [{ ...p, expires: p.expires }]));

  const doses: Planned[] = [];
  const plans = rows.map((r) => ({ ...r.reminder, name: r.name, form: r.form }));
  // From midnight, so a dose of this morning still gets its repeat.
  for (const d of upcomingDoses(plans, today, '', DAYS_AHEAD)) {
    const due = `${d.day}T${d.time}`;
    if (answered.has(`${d.reminder.id}|${due}`)) continue;
    const title = t('notifications.doseTitle', { name: d.reminder.name });
    const body = t('notifications.doseBody', { dose: d.dose, unit: t(UNIT[d.reminder.form ?? 'other']), time: d.time });
    const data = { medicineId: d.reminder.medicineId, reminderId: d.reminder.id, due };
    if (d.day > today || d.time > hhmm) {
      doses.push({ when: at(d.day, d.time), content: { title, body, data }, channelId: CHANNEL });
    }
    const again = missedRepeatMinutes > 0 ? addMinutes(d.time, missedRepeatMinutes) : null;
    if (again !== null && (d.day > today || again > hhmm)) {
      doses.push({
        identifier: repeatId(d.reminder.id, due),
        when: at(d.day, again),
        content: { title, body: t('notifications.repeatBody', { body }), data },
        channelId: CHANNEL,
      });
    }
  }
  doses.sort((x, y) => x.when.getTime() - y.when.getTime());

  const notices: Planned[] = expiryNotices(dated, today, expiryNoticeDays, EXPIRY_SLOTS).map((p) => ({
    when: at(p.day, MORNING),
    content: {
      title: t('notifications.expiryTitle', { name: p.name }),
      body: t('notifications.expiryBody', { date: shortDate(p.expires), cabinet: p.cabinet }),
      data: { packageId: p.packageId },
    },
    channelId: NOTICE_CHANNEL,
  }));
  if (weeklyDigest) {
    const monday = nextMonday(today);
    let expired = 0;
    let expiring = 0;
    for (const p of dated) {
      const status = expiryStatus(p.expires, monday, p.warningDays);
      if (status === 'expired') expired++;
      else if (status === 'expiring') expiring++;
    }
    // A week with nothing to look at needs no summary.
    if (expired + expiring > 0) {
      const lines = [
        expired > 0 ? t('notifications.digestExpired', { count: expired }) : null,
        expiring > 0 ? t('notifications.digestExpiring', { count: expiring }) : null,
      ];
      notices.push({
        when: at(monday, MORNING),
        content: { title: t('notifications.digestTitle'), body: lines.filter(Boolean).join(' '), data: { digest: true } },
        channelId: NOTICE_CHANNEL,
      });
    }
  }

  // A snoozed dose stays: it was asked for by hand and is not in the plan. So do shopping recalls.
  for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
    if (!n.content.data?.snoozed && !n.content.data?.shoppingItemId) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  const all = [...notices, ...doses.slice(0, MAX_SCHEDULED - notices.length)];
  if (all.length === 0) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  for (const { identifier, when, content, channelId } of all) {
    await Notifications.scheduleNotificationAsync({
      ...(identifier ? { identifier } : {}),
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId },
    });
  }
}

/** A dose marked taken needs no repeat. */
export async function forgetRepeat(reminderId: string, due: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(repeatId(reminderId, due));
}

/** «Пізніше»: the dose's notification once more in `minutes`. Not an Intake. */
export async function snoozeDose(dose: {
  medicineId: string;
  reminderId: string;
  name: string;
  form: keyof typeof UNIT | null;
  time: string;
  dose: number;
  due: string;
}, minutes: number): Promise<Date> {
  const at = new Date(Date.now() + minutes * 60_000);
  if (!(await Notifications.getPermissionsAsync()).granted) return at;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.doseTitle', { name: dose.name }),
      body: t('notifications.doseBody', { dose: dose.dose, unit: t(UNIT[dose.form ?? 'other']), time: dose.time }),
      data: { medicineId: dose.medicineId, reminderId: dose.reminderId, due: dose.due, snoozed: true },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
  });
  return at;
}

const shoppingId = (itemId: string) => `shopping-${itemId}`;

/**
 * A line ticked as bought: a recall to add the pack, unless it is added first.
 * The first tick is where the app asks for notifications, if no reminder has.
 */
export async function remindToAdd(item: { id: string; name: string; cabinet: string }): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(SHOPPING_CHANNEL, {
      name: t('notifications.shoppingChannel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && !(current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) return;
  await Notifications.scheduleNotificationAsync({
    identifier: shoppingId(item.id),
    content: {
      title: t('notifications.addTitle', { name: item.name }),
      body: t('notifications.addBody', { cabinet: item.cabinet }),
      data: { shoppingItemId: item.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: addReminderAt(new Date()), channelId: SHOPPING_CHANNEL },
  });
}

/** The recall is no longer needed: unticked, crossed out or the pack added. */
export async function forgetToAdd(itemIds: readonly string[]): Promise<void> {
  for (const id of itemIds) await Notifications.cancelScheduledNotificationAsync(shoppingId(id));
}
