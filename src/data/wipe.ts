import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { sqlite } from './db/client';
import { usePrefs } from './prefs';
import { signOutHere } from './remote/client';
import { useSession } from './session';
import { whileSyncPaused } from './sync';

/**
 * «Видалити всі дані»: every cabinet (and by cascade all in it), the own
 * categories, every scheduled notification and the phone's own settings. The
 * language stays: the person still reads the app in it.
 *
 * Only this phone's copy goes (docs/model.md, "Wiping the phone"): nothing is
 * sent to the server, the outbox and the sync cursors go too, and the phone
 * signs out, so the next start does not pull the shared cabinets back. On the
 * server they stay, with this person still a member; an account signed in again
 * brings them back.
 */
export async function wipeAll(): Promise<void> {
  await whileSyncPaused(async () => {
    // `applying` keeps the outbox triggers quiet: the deletes are not changes to send.
    sqlite.withTransactionSync(() => {
      sqlite.runSync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('applying', '1')`);
      sqlite.runSync(`DELETE FROM cabinets`);
      sqlite.runSync(`DELETE FROM custom_categories`);
      sqlite.runSync(`DELETE FROM outbox`);
      sqlite.runSync(`DELETE FROM sync_meta`);
    });
    await signOutHere();
  });
  // The web build schedules none (notifications.web.ts).
  if (Platform.OS !== 'web') await Notifications.cancelAllScheduledNotificationsAsync();
  useSession.setState({ currentCabinetId: null, stepsLater: [], stepsFinished: false, switcherHint: 'unseen' });
  usePrefs.setState(usePrefs.getInitialState());
}
