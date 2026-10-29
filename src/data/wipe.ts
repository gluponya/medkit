import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { db } from './db/client';
import { cabinets, customCategories } from './db/schema';
import { usePrefs } from './prefs';
import { useSession } from './session';

/**
 * «Видалити всі дані»: every cabinet (and by cascade all in it), the own
 * categories, every scheduled notification and the phone's own settings. The
 * language stays: the person still reads the app in it.
 */
export async function wipeAll(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(cabinets);
    await tx.delete(customCategories);
  });
  // The web build schedules none (notifications.web.ts).
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
  useSession.setState({ currentCabinetId: null, stepsLater: [], stepsFinished: false, switcherHint: 'unseen' });
  usePrefs.setState(usePrefs.getInitialState());
}
