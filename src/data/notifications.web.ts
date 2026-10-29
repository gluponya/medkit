/**
 * The web build (the Telegram mini app) has no scheduled notifications: a page
 * cannot raise one while it is closed. There the reminders are to come as the
 * bot's messages; until then every call does nothing, and permission is never
 * given.
 */

export async function askForNotifications(): Promise<boolean> {
  return false;
}

export async function rescheduleDoses(): Promise<void> {}

export async function forgetDose(_reminderId: string, _due: string): Promise<void> {}

export async function snoozeDose(_dose: unknown, minutes: number): Promise<Date> {
  return new Date(Date.now() + minutes * 60_000);
}

export async function remindToAdd(_item: { id: string; name: string; cabinet: string }): Promise<void> {}

export async function forgetToAdd(_itemIds: readonly string[]): Promise<void> {}

export function onNotificationOpen(_open: (medicineId: string) => void): () => void {
  return () => {};
}
