import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { AppState } from 'react-native';

import { sqlite } from '@/data/db/client';
import { rescheduleDoses } from '@/data/notifications';
import { hasBackend, signedIn, supabase } from '@/data/remote/client';

import { OfflineError, syncOnce, type LocalDb } from './engine';

/**
 * Runs the sync engine (./engine.ts) when there is something to do: on start,
 * on return to the app, when the network comes back, two seconds after a change
 * goes to the outbox, and on a Realtime nudge from another member's change.
 * A phone with no shared cabinet never touches the network.
 */

const local: LocalDb = {
  all: (sql, ...params) => sqlite.getAllAsync(sql, params),
  run: async (sql, ...params) => {
    await sqlite.runAsync(sql, params);
  },
  transaction: (fn) => sqlite.withTransactionAsync(fn),
};

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let channel: RealtimeChannel | null = null;

async function hasWork(): Promise<boolean> {
  const rows = await sqlite.getAllAsync(
    `SELECT 1 FROM cabinets WHERE synced = 1 UNION ALL SELECT 1 FROM outbox LIMIT 1`,
  );
  return rows.length > 0;
}

/**
 * One cycle now, or after the running one. Rejects when the server cannot be
 * reached, for the screens that wait on it (inviting, joining).
 */
export function syncNow(): Promise<void> {
  if (!hasBackend) return Promise.reject(new OfflineError('no server in this build'));
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        if (!(await hasWork())) break;
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

/** A cycle a little later, for the background: failures wait for the next one. */
function requestSync(delayMs = 0) {
  if (!hasBackend) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncNow().catch((e: unknown) => {
      if (__DEV__ && !(e instanceof OfflineError)) console.warn('sync failed:', e);
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
  requestSync();
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
