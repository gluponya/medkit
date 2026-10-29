import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { AppState } from 'react-native';

import { sqlite } from '@/data/db/client';
import { rescheduleDoses } from '@/data/notifications';
import { hasBackend, signedIn, supabase } from '@/data/remote/client';
import { inTelegram } from '@/ui/telegram-shell';

import { AccountChangedError, OfflineError, OWNER_KEY, syncOnce, type LocalDb } from './engine';

export { AccountChangedError };

/**
 * Runs the sync engine (./engine.ts) when there is something to do: on start,
 * on return to the app, when the network comes back, two seconds after a change
 * goes to the outbox, and on a Realtime nudge from another member's change.
 * A phone that has never shared or joined a cabinet never touches the network.
 */

// Synchronous calls behind the async interface: a cycle's transaction holds only
// local writes, so it runs from BEGIN to COMMIT before the next tap is handled.
// With real awaits in between, the app's own writes could land inside it (with
// `applying` set they never reach the outbox), or start a transaction of their
// own while this one is open and fail with «cannot start a transaction within
// a transaction».
const local: LocalDb = {
  all: async (sql, ...params) => sqlite.getAllSync(sql, params),
  run: async (sql, ...params) => {
    sqlite.runSync(sql, params);
  },
  transaction: async (fn) => {
    sqlite.execSync('BEGIN');
    try {
      await fn();
      sqlite.execSync('COMMIT');
    } catch (e) {
      sqlite.execSync('ROLLBACK');
      throw e;
    }
  },
};

let running: Promise<void> | null = null;
let again = false;
let forced = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: RealtimeChannel | null = null;
let paused = false;

/**
 * A signed-in account keeps every cabinet on the server, not only the shared
 * ones (docs/model.md, "Signing in"): a cabinet still on the phone only goes up
 * whole, as an invited one does, with this person as its owner.
 */
async function backUpAll(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user && !user.is_anonymous) {
    await sqlite.runAsync(`UPDATE cabinets SET synced = 1, role = 'owner' WHERE synced = 0`);
  }
}

async function hasWork(): Promise<boolean> {
  const rows = await sqlite.getAllAsync(
    `SELECT 1 FROM cabinets WHERE synced = 1 UNION ALL SELECT 1 FROM outbox LIMIT 1`,
  );
  return rows.length > 0;
}

/**
 * One cycle now, or after the running one. Rejects when the server cannot be
 * reached, for the screens that wait on it (inviting, joining).
 *
 * `force` runs it even with nothing synced on the phone yet: a phone that has
 * just joined its first cabinet has no synced cabinet and an empty outbox, and
 * without it the cabinet never came down (the owner, 2026-10-26).
 */
export function syncNow(force = false): Promise<void> {
  if (!hasBackend) return Promise.reject(new OfflineError('no server in this build'));
  if (paused) return Promise.resolve();
  if (force) forced = true;
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const now = forced;
        forced = false;
        if (paused) break;
        await backUpAll();
        if (!now && !(await hasWork())) break;
        const me = await signedIn();
        if (await syncOnce(local, supabase, me)) void rescheduleDoses();
        listen();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Runs `fn` with no cycle running or starting: signing in changes who the
 * phone is on the server, and a cycle in between would see the wrong cabinets.
 * A user `fn` signed in on purpose becomes the owner of the phone's synced
 * cabinets; one that changed any other way stops the sync (AccountChangedError).
 */
export async function whileSyncPaused<T>(fn: () => Promise<T>): Promise<T> {
  paused = true;
  try {
    await running?.catch(() => {});
    const before = (await supabase.auth.getSession()).data.session?.user.id ?? null;
    try {
      return await fn();
    } finally {
      const after = (await supabase.auth.getSession()).data.session?.user.id ?? null;
      if (after && after !== before) {
        sqlite.runSync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, [OWNER_KEY, after]);
      }
    }
  } finally {
    paused = false;
  }
}

const FORGET_KEY = 'forget';

/**
 * Asks the server to delete the anonymous user a sign-in merged into the
 * account (supabase/functions/sign-in, `forget`). Kept in `sync_meta` until
 * the server has answered, and tried again on the next start.
 */
export async function forgetAnonymous(id?: string): Promise<void> {
  if (!hasBackend) return;
  if (id) sqlite.runSync(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, [FORGET_KEY, id]);
  const row = sqlite.getFirstSync<{ value: string }>(`SELECT value FROM sync_meta WHERE key = ?`, [FORGET_KEY]);
  if (!row) return;
  const { error } = await supabase.functions.invoke('sign-in', { body: { forget: row.value } });
  // The server said no (already gone, not anonymous, another account): asking again will not help.
  const status = (error as { context?: { status?: number } } | null)?.context?.status;
  if (error && !(status && status >= 400 && status < 500)) {
    if (__DEV__) console.warn('forgetting the anonymous user failed:', error);
    return;
  }
  sqlite.runSync(`DELETE FROM sync_meta WHERE key = ? AND value = ?`, [FORGET_KEY, row.value]);
}

/** A cycle a little later, for the background: failures wait for the next one. */
export function requestSync(delayMs = 0, force = false) {
  if (!hasBackend) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow(force).catch((e: unknown) => {
      if (__DEV__ && e instanceof AccountChangedError) console.warn('sync stopped, another account:', e.message);
      else if (__DEV__ && !(e instanceof OfflineError)) console.warn('sync failed:', e);
    });
  }, delayMs);
}

/** Another member's change, while the app is open: a nudge to pull. */
function listen() {
  if (channel) return;
  channel = supabase.channel('medkit-sync');
  for (const table of ['cabinets', 'cabinet_members', 'medicines', 'packages', 'medicine_categories', 'custom_categories', 'moved_out']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => requestSync(500));
  }
  channel.subscribe();
}

/** Starts the triggers; returns the stop. Called once the migrations ran. */
export function startSync(): () => void {
  if (!hasBackend) return () => {};
  // A phone that has been on the server once asks it on start even with no
  // synced cabinet here: a cabinet it joined may not have come down yet. The
  // Telegram mini app is signed in with Telegram, so it always asks.
  void supabase.auth.getSession().then(({ data }) => {
    requestSync(0, data.session !== null || inTelegram());
    if (data.session && !data.session.user.is_anonymous) void forgetAnonymous().catch(() => {});
  });
  const app = AppState.addEventListener('change', (state) => {
    if (state === 'active') requestSync();
  });
  const network = Network.addNetworkStateListener((s) => {
    if (s.isInternetReachable) requestSync();
  });
  const outbox = addDatabaseChangeListener((e) => {
    if (e.tableName === 'outbox') requestSync(2000);
  });
  return () => {
    app.remove();
    network.remove();
    outbox.remove();
    if (channel) void supabase.removeChannel(channel);
    channel = null;
  };
}
