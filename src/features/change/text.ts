import type { Package } from '@/data/medicines';
import type { Reminder } from '@/data/reminders';
import { expiryMonth } from '@/domain/expiry';
import type { MessageKey } from '@/i18n';
import type { MessageParams } from '@/i18n/types';

type T = (key: MessageKey, params?: MessageParams) => string;

/** «08:00 і 20:00», «11.2026, 02.2027 і 08.2028». */
export function joinList(t: T, items: readonly string[]): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${t('change.and')} ${items[items.length - 1]}`;
}

/** «11.2026» for a pack's expiry. */
export function monthText(expires: string): string {
  const { year, month } = expiryMonth(expires);
  return `${String(month).padStart(2, '0')}.${year}`;
}

/** «2 упаковки, до 11.2026 і 08.2028»; packs with an unknown date only count. */
export function packsText(t: T, packs: readonly Package[]): string {
  const dates = packs.flatMap((p) => (p.expires === null ? [] : [monthText(p.expires)]));
  const unique = [...new Set(dates)];
  return unique.length > 0
    ? t('change.packsUntil', { count: packs.length, dates: joinList(t, unique) })
    : t('change.packs', { count: packs.length });
}

/** When a reminder fires, in words: «2 рази на день о 08:00 і 20:00», «Пн, Ср о 09:00», «За потреби». */
export function reminderWhen(t: T, r: Reminder): string {
  if (r.schedule === 'as_needed') return t('reminder.asNeeded');
  const at = t('change.at', { times: joinList(t, r.times.map((d) => d.time)) });
  const days =
    r.schedule === 'days_of_week'
      ? (r.daysOfWeek ?? []).map((d) => t(`weekday.${d}` as MessageKey)).join(', ')
      : t('reminder.timesADay', { count: r.times.length });
  return `${days} ${at}`;
}

/** The same, after «Нагадування»: «о 08:00 і 20:00», «за потреби». */
export function reminderAt(t: T, r: Reminder): string {
  if (r.schedule === 'as_needed') return t('reminder.asNeeded').toLocaleLowerCase();
  return t('change.at', { times: joinList(t, r.times.map((d) => d.time)) });
}

/** «До 08.2028, 10 шт»; titled, «Упаковка до 08.2028, 10 шт». */
export function packText(t: T, p: Package, unit: string, titled = false): string {
  const until = p.expires === null ? null : t('home.until', { date: monthText(p.expires) });
  const head = titled
    ? until === null
      ? t('change.packUnknown')
      : t('change.packOf', { until })
    : until === null
      ? t('expiry.unknown')
      : until.charAt(0).toLocaleUpperCase() + until.slice(1);
  return p.quantity === null ? head : `${head}, ${t('medicine.amount', { count: p.quantity, unit })}`;
}
