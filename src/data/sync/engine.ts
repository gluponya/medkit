import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * One sync cycle of a phone (docs/model.md, "Syncing a shared cabinet"): send
 * the outbox, bring the memberships, pull what changed. Plain SQL over
 * `LocalDb` and only type imports, so tools/sync-check runs this very file in
 * Node against two databases and a local server.
 */

export type SqlValue = string | number | null;

/** The phone's database as the worker needs it. */
export interface LocalDb {
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  run(sql: string, ...params: SqlValue[]): Promise<void>;
  /** Runs `fn` in one transaction. */
  transaction(fn: () => Promise<void>): Promise<void>;
}

/** The server could not be reached; the next cycle tries again. */
export class OfflineError extends Error {}

/**
 * The phone's synced cabinets belong to another server user than the one
 * signed in now (a lost anonymous session made a new one, say). Nothing is
 * sent or pulled: the new user would have the changes refused and the member
 * list would take every shared cabinet off the phone.
 */
export class AccountChangedError extends Error {}

/** Outbox rows sent in one call. */
const BATCH = 100;
/** Rows pulled in one page. */
const PAGE = 500;
/** A change the server refused this many times stays, and is no longer sent. */
const POISON = 10;
/** A pull reaches this far behind its cursor, for transactions that committed late. */
const LOOKBACK_MS = 10_000;

/** The server tables a phone pulls, in the order their rows depend on each other. */
const PULLED = ['cabinets', 'medicines', 'packages', 'custom_categories', 'medicine_categories', 'moved_out'] as const;
type Pulled = (typeof PULLED)[number];

/** Each pulled table's primary key: the order among rows of one `updated_at`. */
const KEYS: Record<Pulled, string[]> = {
  cabinets: ['id'],
  medicines: ['id'],
  packages: ['id'],
  custom_categories: ['id'],
  medicine_categories: ['medicine_id', 'category'],
  moved_out: ['medicine_id', 'cabinet_id'],
};

/** The server user this phone's synced cabinets belong to, in `sync_meta`. */
export const OWNER_KEY = 'user';
type ServerRow = Record<string, unknown>;

/** Whether a cycle changed the phone's data, so notices are laid out again. */
export async function syncOnce(local: LocalDb, remote: SupabaseClient, me: string): Promise<boolean> {
  await checkOwner(local, remote, me);
  const refused = await push(local, remote);
  const joined = await syncMembers(local, remote, me);
  // A refused change, or a cabinet new to this phone: everything again, so the
  // phone ends up as the server is.
  if (refused || joined.added) await local.run(`DELETE FROM sync_meta WHERE key LIKE 'cursor:%'`);
  const shared = await local.all(`SELECT 1 FROM cabinets WHERE synced = 1 LIMIT 1`);
  let pulled = false;
  if (shared.length > 0) {
    for (const table of PULLED) pulled = (await pull(local, remote, table)) || pulled;
  }
  return joined.changed || pulled;
}

// ─── push ────────────────────────────────────────────────────────────────────

type OutboxRow = {
  seq: number;
  id: string;
  entity: string;
  entity_id: string;
  op: string;
  payload: string;
  edited_at: string;
};

/**
 * Who the phone's synced cabinets belong to. The first cycle after an update
 * has no record yet: it takes the signed-in user when the cabinets are theirs
 * (a membership, or a cabinet still waiting to go up), and none at all.
 */
async function checkOwner(local: LocalDb, remote: SupabaseClient, me: string): Promise<void> {
  const [stored] = await local.all<{ value: string }>(`SELECT value FROM sync_meta WHERE key = ?`, OWNER_KEY);
  if (stored) {
    if (stored.value !== me) throw new AccountChangedError(`cabinets of ${stored.value}, signed in as ${me}`);
    return;
  }
  const here = await local.all<{ id: string }>(`SELECT id FROM cabinets WHERE synced = 1`);
  if (here.length > 0) {
    const members = await select<{ cabinet_id: string }>(
      remote.from('cabinet_members').select('cabinet_id').eq('user_id', me),
    );
    const mine = new Set(members.map((m) => m.cabinet_id));
    const going = await local.all<{ entity_id: string }>(
      `SELECT entity_id FROM outbox WHERE entity = 'cabinets' AND op = 'insert'`,
    );
    for (const g of going) mine.add(g.entity_id);
    if (!here.some((c) => mine.has(c.id))) throw new AccountChangedError(`no cabinet here is of ${me}`);
  }
  await local.run(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, OWNER_KEY, me);
}

type Refusal = { id: string; code: string; message: string };

/**
 * Sends the outbox in order. Whether the phone should pull everything again:
 * the server refused a change for the role, or a change it kept refusing was
 * dropped.
 */
async function push(local: LocalDb, remote: SupabaseClient): Promise<boolean> {
  // Changes of a cabinet the phone no longer has go with it; its own delete stays.
  await local.run(
    `DELETE FROM outbox WHERE cabinet_id IS NOT NULL AND NOT (entity = 'cabinets' AND op = 'delete')
       AND NOT EXISTS (SELECT 1 FROM cabinets c WHERE c.id = outbox.cabinet_id AND c.synced = 1)`,
  );
  // A change refused this many times will not go: kept, it held its cabinet on
  // the phone after the person left it. It goes, and the pull puts the server's back.
  const stuck = await local.all<{ entity: string; entity_id: string; last_error: string | null }>(
    `SELECT entity, entity_id, last_error FROM outbox WHERE attempts >= ?`,
    POISON,
  );
  if (stuck.length > 0) {
    if (typeof __DEV__ === 'undefined' || __DEV__) console.warn('sync: dropping changes the server keeps refusing:', stuck);
    await local.run(`DELETE FROM outbox WHERE attempts >= ?`, POISON);
  }
  let resync = stuck.length > 0;
  for (;;) {
    const rows = await local.all<OutboxRow>(
      `SELECT seq, id, entity, entity_id, op, payload, edited_at FROM outbox WHERE attempts < ? ORDER BY seq LIMIT ?`,
      POISON,
      BATCH,
    );
    if (rows.length === 0) return resync;

    const sent = await send(local, remote, rows);
    resync = resync || sent.forRole;
    if (sent.refused) {
      // The rest waits for the next cycle rather than hitting the same wall,
      // except a cabinet the person left or deleted: held back, the member
      // list would bring it back to the phone.
      const leaving = await local.all<OutboxRow>(
        `SELECT seq, id, entity, entity_id, op, payload, edited_at FROM outbox
          WHERE entity = 'cabinets' AND op = 'delete' AND attempts < ? AND seq > ? ORDER BY seq`,
        POISON,
        rows[rows.length - 1].seq,
      );
      if (leaving.length > 0) resync = (await send(local, remote, leaving)).forRole || resync;
      return resync;
    }
  }
}

/** One `push_changes` call and what it left in the outbox. */
async function send(
  local: LocalDb,
  remote: SupabaseClient,
  rows: OutboxRow[],
): Promise<{ refused: boolean; forRole: boolean }> {
  const { data, error } = await remote.rpc('push_changes', { changes: rows });
  if (error) throw new OfflineError(error.message);
  const refused = new Map((data as Refusal[]).map((r) => [r.id, r]));
  let forRole = false;
  await local.transaction(async () => {
    for (const row of rows) {
      const no = refused.get(row.id);
      if (!no) {
        await local.run(`DELETE FROM outbox WHERE seq = ?`, row.seq);
      } else if (no.code === '42501') {
        // Not this person's to change: the pull puts the server's back.
        forRole = true;
        await local.run(`DELETE FROM outbox WHERE seq = ?`, row.seq);
      } else {
        await local.run(
          `UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE seq = ?`,
          `${no.code} ${no.message}`,
          row.seq,
        );
      }
    }
  });
  return { refused: refused.size > 0, forRole };
}

// ─── members ─────────────────────────────────────────────────────────────────

type MemberRow = { cabinet_id: string; user_id: string; role: string; joined_at: string };

/**
 * The cabinets the server lists for this person, and who else is in them. A
 * cabinet joined on the server comes to the phone; one the person left or was
 * taken out of goes, unless its own changes still wait to go up.
 */
async function syncMembers(
  local: LocalDb,
  remote: SupabaseClient,
  me: string,
): Promise<{ added: boolean; changed: boolean }> {
  const members = await select<MemberRow>(remote.from('cabinet_members').select('cabinet_id, user_id, role, joined_at'));
  const mine = new Map(members.filter((m) => m.user_id === me).map((m) => [m.cabinet_id, m.role]));
  const here = await local.all<{ id: string; role: string | null }>(`SELECT id, role FROM cabinets WHERE synced = 1`);
  const hereIds = new Set(here.map((c) => c.id));

  // A cabinet whose leave or delete still waits to go up stays gone.
  const leaving = new Set(
    (
      await local.all<{ entity_id: string }>(`SELECT entity_id FROM outbox WHERE entity = 'cabinets' AND op = 'delete'`)
    ).map((r) => r.entity_id),
  );
  const newIds = [...mine.keys()].filter((id) => !hereIds.has(id) && !leaving.has(id));
  const fresh =
    newIds.length > 0
      ? await select<ServerRow>(remote.from('cabinets').select('*').in('id', newIds).is('deleted_at', null))
      : [];
  const people = [...new Set(members.map((m) => m.user_id))];
  const names = new Map(
    (await select<{ id: string; name: string }>(remote.from('profiles').select('id, name').in('id', people))).map(
      (p) => [p.id, p.name],
    ),
  );

  let changed = false;
  await applying(local, async () => {
    for (const c of fresh) {
      changed = true;
      await local.run(
        `INSERT INTO cabinets (id, name, place, icon, mode, expiry_warning_days, synced, role, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET synced = 1, role = excluded.role`,
        ...values(c, ['id', 'name', 'place', 'icon', 'mode', 'expiry_warning_days']),
        mine.get(c.id as string) ?? 'member',
        c.created_at as string,
      );
    }
    for (const c of here) {
      const role = mine.get(c.id);
      if (role === undefined) {
        const waiting = await local.all(`SELECT 1 FROM outbox WHERE cabinet_id = ? LIMIT 1`, c.id);
        if (waiting.length > 0) continue;
        changed = true;
        await local.run(`DELETE FROM cabinets WHERE id = ?`, c.id);
      } else if (role !== c.role) {
        await local.run(`UPDATE cabinets SET role = ? WHERE id = ?`, role, c.id);
      }
    }
    await local.run(`DELETE FROM members`);
    for (const m of members) {
      await local.run(
        `INSERT INTO members (cabinet_id, user_id, name, role, joined_at)
         SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM cabinets WHERE id = ? AND synced = 1)`,
        m.cabinet_id,
        m.user_id,
        names.get(m.user_id) ?? '',
        m.role,
        m.joined_at,
        m.cabinet_id,
      );
    }
  });
  return { added: fresh.length > 0, changed };
}

// ─── pull ────────────────────────────────────────────────────────────────────

/** Brings one table's changes since its cursor. Whether any came. */
async function pull(local: LocalDb, remote: SupabaseClient, table: Pulled): Promise<boolean> {
  const key = `cursor:${table}`;
  const [stored] = await local.all<{ value: string }>(`SELECT value FROM sync_meta WHERE key = ?`, key);
  let from = stored ? new Date(toMillis(stored.value) - LOOKBACK_MS).toISOString() : null;
  // Rows at `from` already brought: a page can end inside a run of one
  // `updated_at` (a cabinet's medicines moved at once), longer than a page even.
  let skip = 0;
  let any = false;
  for (;;) {
    let query = remote.from(table).select('*').order('updated_at');
    for (const k of KEYS[table]) query = query.order(k);
    if (from) query = query.gte('updated_at', from);
    const rows = await select<ServerRow>(query.range(skip, skip + PAGE - 1));
    if (rows.length === 0) return any;
    any = true;
    await applying(local, () => APPLY[table](local, rows));
    const last = rows[rows.length - 1].updated_at as string;
    if (!stored || toMillis(last) > toMillis(stored.value)) {
      await local.run(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)`, key, last);
    }
    if (rows.length < PAGE) return any;
    skip = last === from ? skip + rows.length : rows.filter((r) => r.updated_at === last).length;
    from = last;
  }
}

/** Postgres writes microseconds, which not every JS engine parses. */
const toMillis = (time: string) => Date.parse(time.replace(/(\.\d{3})\d+/, '$1'));

/**
 * What still waits in the outbox for each row of an entity: a pulled row does
 * not overwrite it. `all` for a waiting insert or delete, else the fields.
 */
async function waiting(local: LocalDb, entity: string): Promise<Map<string, Set<string> | 'all'>> {
  const rows = await local.all<{ entity_id: string; op: string; payload: string }>(
    `SELECT entity_id, op, payload FROM outbox WHERE entity = ? ORDER BY seq`,
    entity,
  );
  const out = new Map<string, Set<string> | 'all'>();
  for (const r of rows) {
    const had = out.get(r.entity_id);
    if (had === 'all' || r.op !== 'update') {
      out.set(r.entity_id, 'all');
      continue;
    }
    const fields = had ?? new Set<string>();
    for (const k of Object.keys(JSON.parse(r.payload) as object)) fields.add(k === 'quantity_delta' ? 'quantity' : k);
    out.set(r.entity_id, fields);
  }
  return out;
}

const COLUMNS = {
  cabinets: ['name', 'place', 'icon', 'mode', 'expiry_warning_days'],
  medicines: [
    'cabinet_id',
    'name',
    'inn',
    'form',
    'strength',
    'manufacturer',
    'rx',
    'low_stock_threshold',
    'register_id',
    'created_at',
  ],
  packages: ['medicine_id', 'expires', 'quantity', 'opened_at', 'status', 'created_at'],
  custom_categories: ['name', 'icon', 'created_at'],
};

/** A server row's values as SQLite takes them: booleans as 1 and 0. */
const values = (row: ServerRow, cols: string[]): SqlValue[] =>
  cols.map((c) => {
    const v = row[c];
    return typeof v === 'boolean' ? (v ? 1 : 0) : ((v ?? null) as SqlValue);
  });

/** Inserts the row, or updates the fields that are not waiting to go up. */
async function upsert(
  local: LocalDb,
  table: string,
  row: ServerRow,
  cols: string[],
  skip: Set<string> | undefined,
): Promise<void> {
  const all = ['id', ...cols];
  const update = cols.filter((c) => c !== 'created_at' && !skip?.has(c));
  await local.run(
    `INSERT INTO ${table} (${all.join(', ')}) VALUES (${all.map(() => '?').join(', ')})
     ON CONFLICT (id) DO ${update.length > 0 ? `UPDATE SET ${update.map((c) => `${c} = excluded.${c}`).join(', ')}` : 'NOTHING'}`,
    ...values(row, all),
  );
}

const syncedCabinets = async (local: LocalDb) =>
  new Set((await local.all<{ id: string }>(`SELECT id FROM cabinets WHERE synced = 1`)).map((c) => c.id));

const APPLY: Record<Pulled, (local: LocalDb, rows: ServerRow[]) => Promise<void>> = {
  async cabinets(local, rows) {
    const wait = await waiting(local, 'cabinets');
    for (const row of rows) {
      const id = row.id as string;
      const skip = wait.get(id);
      if (skip === 'all') continue;
      if (row.deleted_at) {
        await local.run(`DELETE FROM cabinets WHERE id = ? AND synced = 1`, id);
        continue;
      }
      const cols = COLUMNS.cabinets.filter((c) => !skip?.has(c));
      if (cols.length === 0) continue;
      await local.run(
        `UPDATE cabinets SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND synced = 1`,
        ...values(row, cols),
        id,
      );
    }
  },

  async medicines(local, rows) {
    const wait = await waiting(local, 'medicines');
    const synced = await syncedCabinets(local);
    for (const row of rows) {
      const id = row.id as string;
      const skip = wait.get(id);
      if (skip === 'all') continue;
      if (row.deleted_at || !synced.has(row.cabinet_id as string)) {
        // Deleted, or moved to a cabinet this phone does not have.
        await local.run(
          `DELETE FROM medicines WHERE id = ? AND cabinet_id IN (SELECT id FROM cabinets WHERE synced = 1)`,
          id,
        );
        continue;
      }
      await upsert(local, 'medicines', row, COLUMNS.medicines, skip);
    }
  },

  async packages(local, rows) {
    const wait = await waiting(local, 'packages');
    for (const row of rows) {
      const id = row.id as string;
      const skip = wait.get(id);
      if (skip === 'all') continue;
      if (row.deleted_at) {
        await local.run(`DELETE FROM packages WHERE id = ?`, id);
        continue;
      }
      const there = await local.all(`SELECT 1 FROM medicines WHERE id = ?`, row.medicine_id as string);
      if (there.length > 0) await upsert(local, 'packages', row, COLUMNS.packages, skip);
    }
  },

  async custom_categories(local, rows) {
    const wait = await waiting(local, 'custom_categories');
    for (const row of rows) {
      const id = row.id as string;
      const skip = wait.get(id);
      if (skip === 'all') continue;
      if (row.deleted_at) {
        await local.run(`DELETE FROM medicine_categories WHERE category = ?`, id);
        await local.run(`DELETE FROM custom_categories WHERE id = ?`, id);
        continue;
      }
      await upsert(local, 'custom_categories', row, COLUMNS.custom_categories, skip);
    }
  },

  async medicine_categories(local, rows) {
    const wait = await waiting(local, 'medicine_categories');
    for (const row of rows) {
      const [medicine, category] = [row.medicine_id as string, row.category as string];
      if (wait.has(`${medicine}|${category}`)) continue;
      if (row.deleted_at) {
        await local.run(`DELETE FROM medicine_categories WHERE medicine_id = ? AND category = ?`, medicine, category);
      } else {
        await local.run(
          `INSERT OR IGNORE INTO medicine_categories (medicine_id, category)
           SELECT ?, ? WHERE EXISTS (SELECT 1 FROM medicines WHERE id = ?)`,
          medicine,
          category,
          medicine,
        );
      }
    }
  },

  // A medicine that left a cabinet for one this phone may not have.
  async moved_out(local, rows) {
    const wait = await waiting(local, 'medicines');
    for (const row of rows) {
      if (wait.has(row.medicine_id as string)) continue;
      await local.run(`DELETE FROM medicines WHERE id = ? AND cabinet_id = ?`, row.medicine_id as string, row.cabinet_id as string);
    }
  },
};

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Writes pulled rows with the outbox triggers quiet (`applying`). */
async function applying(local: LocalDb, fn: () => Promise<void>): Promise<void> {
  await local.transaction(async () => {
    await local.run(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('applying', '1')`);
    try {
      await fn();
    } finally {
      await local.run(`DELETE FROM sync_meta WHERE key = 'applying'`);
    }
  });
}

async function select<T>(query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new OfflineError(error.message);
  return (data ?? []) as T[];
}
