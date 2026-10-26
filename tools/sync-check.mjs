// Two phones and the local server, through the app's own sync engine
// (src/data/sync/engine.ts): sharing, inviting, joining, a count taken on both
// at once, roles, moving a medicine out, leaving and deleting.
//
//   npx supabase start
//   node tools/sync-check.mjs
//
// The server's address and key are read from `supabase status` and never printed.

import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

import { syncOnce } from '../src/data/sync/engine.ts';
import { openLocalDb } from './local-db.mjs';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .map((line) => line.match(/^(\w+)="?([^"]*)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.API_URL;
const key = env.ANON_KEY ?? env.PUBLISHABLE_KEY;
assert.ok(url && key, 'the local server is not running: npx supabase start');

async function phone(label) {
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
  return {
    label,
    me,
    remote,
    exec: (sql) => sqlite.exec(sql),
    get: (sql, ...p) => ({ ...sqlite.prepare(sql).get(...p) }),
    all: (sql, ...p) => sqlite.prepare(sql).all(...p),
    sync: () => syncOnce(local, remote, me),
    rpc: async (fn, args) => {
      const { data, error } = await remote.rpc(fn, args);
      if (error) throw new Error(`${fn}: ${error.message}`);
      return data;
    },
  };
}

const step = (text) => console.log(`✓ ${text}`);
const both = async (a, b) => {
  await a.sync();
  await b.sync();
  await a.sync();
  await b.sync();
};

const a = await phone('A');
const b = await phone('B');
const cab = `cab-${Date.now()}`;

// A has a cabinet with a medicine, a counted pack and an own category.
a.exec(`
  INSERT INTO cabinets (id, name, place, icon, mode) VALUES ('${cab}', 'Батьки', 'parents', 'heart', 'expiry_only'),
    ('${cab}-mine', 'Моя', 'home', 'home', 'with_intake');
  INSERT INTO medicines (id, cabinet_id, name, rx) VALUES ('${cab}-m1', '${cab}', 'Нурофен', 1), ('${cab}-m2', '${cab}', 'Аспірин', 0);
  INSERT INTO packages (id, medicine_id, expires, quantity) VALUES ('${cab}-p1', '${cab}-m1', '2027-05-31', 10);
  INSERT INTO custom_categories (id, name, icon) VALUES ('${cab}-k1', 'Мамині', 'heart');
  INSERT INTO medicine_categories VALUES ('${cab}-m1', '${cab}-k1'), ('${cab}-m1', 'pain');
`);
a.exec(`UPDATE cabinets SET synced = 1, role = 'owner' WHERE id = '${cab}'`);
await a.rpc('set_name', { name: 'Аня' });
await a.sync();
assert.equal(a.get('SELECT count(*) n FROM outbox').n, 0, 'the outbox went up');
const [invite] = await a.rpc('create_invite', { cabinet: cab });
assert.match(invite.code, /^[A-HJKMNP-Z2-9]{6}$/);
const [again] = await a.rpc('create_invite', { cabinet: cab });
assert.equal(again.code, invite.code, 'the same code while it lasts');
step('A shares the cabinet and gets a code');

const [peek] = await b.rpc('peek_invite', { code: invite.code.toLowerCase() });
assert.deepEqual(
  [peek.name, peek.inviter, peek.medicines, peek.people, peek.expired, peek.joined],
  ['Батьки', 'Аня', 2, 1, false, false],
);
await b.rpc('join_cabinet', { code: invite.code, name: 'Олена' });
await b.sync();
assert.deepEqual(b.get(`SELECT name, role, synced FROM cabinets WHERE id = '${cab}'`), {
  name: 'Батьки',
  role: 'member',
  synced: 1,
});
assert.equal(b.get(`SELECT rx FROM medicines WHERE id = '${cab}-m1'`).rx, 1);
assert.equal(b.get(`SELECT quantity FROM packages WHERE id = '${cab}-p1'`).quantity, 10);
assert.equal(b.get(`SELECT name FROM custom_categories WHERE id = '${cab}-k1'`).name, 'Мамині');
assert.equal(b.get(`SELECT count(*) n FROM medicine_categories WHERE medicine_id = '${cab}-m1'`).n, 2);
assert.equal(b.get('SELECT count(*) n FROM outbox').n, 0, 'pulled rows do not go back up');
await a.sync();
assert.deepEqual(
  a.all(`SELECT name, role FROM members WHERE cabinet_id = '${cab}' ORDER BY joined_at`).map((m) => `${m.name} ${m.role}`),
  ['Аня owner', 'Олена member'],
);
step('B joins by the code and gets the whole cabinet; A sees her in the members');

a.exec(`UPDATE packages SET quantity = quantity - 1 WHERE id = '${cab}-p1'`);
b.exec(`UPDATE packages SET quantity = quantity - 1 WHERE id = '${cab}-p1'`);
await both(a, b);
assert.equal(a.get(`SELECT quantity FROM packages WHERE id = '${cab}-p1'`).quantity, 8);
assert.equal(b.get(`SELECT quantity FROM packages WHERE id = '${cab}-p1'`).quantity, 8);
step('both take a tablet of 10 at once: 8 on both');

b.exec(`UPDATE medicines SET name = 'Нурофен від Олени' WHERE id = '${cab}-m1'`);
await b.sync();
assert.equal(b.get(`SELECT name FROM medicines WHERE id = '${cab}-m1'`).name, 'Нурофен', 'a member cannot rename');
step('a member’s rename is refused and the phone gets the name back');

await a.rpc('set_member_role', { cabinet: cab, person: b.me, role: 'admin' });
await b.sync();
assert.equal(b.get(`SELECT role FROM cabinets WHERE id = '${cab}'`).role, 'admin');
b.exec(`UPDATE medicines SET strength = '200 мг' WHERE id = '${cab}-m1'`);
a.exec(`UPDATE medicines SET name = 'Нурофен Форте' WHERE id = '${cab}-m1'`);
await both(a, b);
for (const p of [a, b]) {
  assert.deepEqual({ ...p.get(`SELECT name, strength FROM medicines WHERE id = '${cab}-m1'`) }, {
    name: 'Нурофен Форте',
    strength: '200 мг',
  });
}
step('as an admin, B changes the strength while A renames: both changes stay');

a.exec(`UPDATE medicines SET cabinet_id = '${cab}-mine' WHERE id = '${cab}-m2'`);
await both(a, b);
assert.equal(b.get(`SELECT count(*) n FROM medicines WHERE id = '${cab}-m2'`).n, 0);
assert.equal(a.get(`SELECT cabinet_id FROM medicines WHERE id = '${cab}-m2'`).cabinet_id, `${cab}-mine`);
step('A moves a medicine to her own cabinet: it leaves B’s phone, stays on A’s');

a.exec(`DELETE FROM medicines WHERE id = '${cab}-m1'`);
await both(a, b);
assert.equal(b.get(`SELECT count(*) n FROM medicines WHERE cabinet_id = '${cab}'`).n, 0);
assert.equal(b.get(`SELECT count(*) n FROM packages WHERE id = '${cab}-p1'`).n, 0);
step('A deletes a medicine: gone with its pack on B');

b.exec(`DELETE FROM cabinets WHERE id = '${cab}'`);
await both(a, b);
assert.equal(b.get(`SELECT count(*) n FROM cabinets WHERE id = '${cab}'`).n, 0, 'B stays out');
assert.equal(a.get(`SELECT count(*) n FROM members WHERE cabinet_id = '${cab}'`).n, 1);
assert.equal(a.get(`SELECT count(*) n FROM cabinets WHERE id = '${cab}'`).n, 1, 'the cabinet stays for A');
step('B leaves: the cabinet stays for A alone');

const c = await phone('C');
await c.rpc('join_cabinet', { code: invite.code, name: 'Дмитро' });
await c.sync();
assert.equal(c.get(`SELECT count(*) n FROM cabinets WHERE id = '${cab}'`).n, 1);
a.exec(`DELETE FROM cabinets WHERE id = '${cab}'`);
await a.sync();
await c.sync();
assert.equal(c.get(`SELECT count(*) n FROM cabinets WHERE id = '${cab}'`).n, 0);
await a.sync();
assert.equal(a.get(`SELECT count(*) n FROM cabinets WHERE id = '${cab}'`).n, 0, 'not back for A');
const gone = await c.rpc('peek_invite', { code: invite.code });
assert.equal(gone.length, 0, 'the code of a deleted cabinet leads nowhere');
step('A deletes the cabinet: gone for everyone, its code too');

console.log('all good');
