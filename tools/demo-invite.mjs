// A second phone for trying «Приєднатися за кодом» with one iPhone: an
// anonymous person «Мама» shares a cabinet with a few medicines on the server
// from .env.local and prints its invite code.
//
//   node --no-warnings --env-file=.env.local tools/demo-invite.mjs
//
// The server's address and key are never printed.

import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

import { syncOnce } from '../src/data/sync/engine.ts';
import { openLocalDb } from './local-db.mjs';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'no server in .env.local');

const sqlite = openLocalDb();
const local = {
  all: async (sql, ...params) => sqlite.prepare(sql).all(...params),
  run: async (sql, ...params) => void sqlite.prepare(sql).run(...params),
  transaction: async (fn) => {
    sqlite.exec('BEGIN');
    try {
      await fn();
      sqlite.exec('COMMIT');
    } catch (e) {
      sqlite.exec('ROLLBACK');
      throw e;
    }
  },
};
const remote = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await remote.auth.signInAnonymously();
if (error) throw error;
const me = data.user.id;

const rpc = async (fn, args) => {
  const { data, error } = await remote.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

const cab = `demo-${Date.now()}`;
sqlite.exec(`
  INSERT INTO cabinets (id, name, place, icon, mode)
    VALUES ('${cab}', 'Аптечка мами', 'parents', 'heart', 'expiry_only');
  INSERT INTO medicines (id, cabinet_id, name, rx) VALUES
    ('${cab}-m1', '${cab}', 'Нурофен', 0),
    ('${cab}-m2', '${cab}', 'Атенолол-Астрафарм', 1),
    ('${cab}-m3', '${cab}', 'Корвалол', 0);
  INSERT INTO packages (id, medicine_id, expires, quantity) VALUES
    ('${cab}-p1', '${cab}-m1', '2027-05-31', 10),
    ('${cab}-p2', '${cab}-m2', '2026-11-30', 28),
    ('${cab}-p3', '${cab}-m3', '2026-09-30', NULL);
`);
// As «Запросити» does: the cabinet becomes synced and goes up whole.
sqlite.exec(`UPDATE cabinets SET synced = 1, role = 'owner' WHERE id = '${cab}'`);
await rpc('set_name', { name: 'Мама' });
await syncOnce(local, remote, me);
assert.equal(sqlite.prepare('SELECT count(*) n FROM outbox').get().n, 0, 'the cabinet went up');
const [invite] = await rpc('create_invite', { cabinet: cab });
console.log(`Код: ${invite.code}`);
