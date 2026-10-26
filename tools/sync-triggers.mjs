// Writes src/data/db/migrations/0008_sync_triggers.sql: the SQLite triggers
// that put every change in a synced cabinet into the outbox (docs/model.md,
// "Syncing a shared cabinet"). Run it again after changing a synced table's
// columns, as a new migration: `node tools/sync-triggers.mjs <file>`.
//
// The column names are the server's too (supabase/migrations), so a payload
// goes up as it is. Rows a pull writes are marked by `applying` in sync_meta,
// and no trigger fires for them.

import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'src/data/db/migrations/0008_sync_triggers.sql';

/** The shared columns of each synced table; `bool` ones go as JSON true/false. */
const TABLES = {
  cabinets: ['name', 'place', 'icon', 'mode', 'expiry_warning_days', 'created_at'],
  medicines: [
    'cabinet_id',
    'name',
    'inn',
    'form',
    'strength',
    'manufacturer',
    'rx:bool',
    'low_stock_threshold',
    'register_id',
    'created_at',
  ],
  packages: ['medicine_id', 'expires', 'quantity', 'opened_at', 'status', 'created_at'],
  custom_categories: ['name', 'icon', 'created_at'],
  medicine_categories: ['medicine_id', 'category'],
};

const cols = (table) => TABLES[table].map((c) => c.split(':')[0]);
const isBool = (table, col) => TABLES[table].includes(`${col}:bool`);

const NOT_APPLYING = `NOT EXISTS (SELECT 1 FROM sync_meta WHERE key = 'applying')`;
const NEW_ID = 'lower(hex(randomblob(16)))';
const NOW = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
const synced = (cabinet) => `COALESCE((SELECT synced FROM cabinets WHERE id = ${cabinet}), 0) = 1`;
const cabinetOf = (medicine) => `(SELECT cabinet_id FROM medicines WHERE id = ${medicine})`;

/** A column's value as JSON text, for json() around it. */
const jsonValue = (table, row, col) =>
  isBool(table, col) ? `CASE WHEN ${row}.${col} THEN 'true' ELSE 'false' END` : `json_quote(${row}.${col})`;

/** The whole row, for an insert. */
const fullPayload = (table, row) =>
  `json_object(${cols(table)
    .map((c) => `'${c}', json(${jsonValue(table, row, c)})`)
    .join(', ')})`;

/**
 * Only the fields that changed. A pack's count goes as a change
 * (`quantity_delta`), so two people taking one each leave two fewer; it goes
 * as a value only when it starts or stops being counted.
 */
function changedPayload(table, only = cols(table)) {
  const parts = only.map((c) => {
    if (table === 'packages' && c === 'quantity') {
      return `SELECT 'quantity_delta' AS k, json_quote(NEW.quantity - OLD.quantity) AS v
          WHERE NEW.quantity IS NOT NULL AND OLD.quantity IS NOT NULL AND NEW.quantity <> OLD.quantity
        UNION ALL SELECT 'quantity', json_quote(NEW.quantity)
          WHERE (NEW.quantity IS NULL) <> (OLD.quantity IS NULL)`;
    }
    return `SELECT '${c}' AS k, ${jsonValue(table, 'NEW', c)} AS v WHERE NEW.${c} IS NOT OLD.${c}`;
  });
  return `(SELECT json_group_object(k, json(v)) FROM (\n        ${parts.join('\n        UNION ALL ')}))`;
}

const changed = (table, only = cols(table)) => `(${only.map((c) => `NEW.${c} IS NOT OLD.${c}`).join(' OR ')})`;

const enqueue = (entity, id, cabinet, op, payload) =>
  `INSERT INTO outbox (id, entity, entity_id, cabinet_id, op, payload, edited_at)
    VALUES (${NEW_ID}, '${entity}', ${id}, ${cabinet}, '${op}', ${payload}, ${NOW});`;

/** The same for every row a select finds: a whole medicine or cabinet going up. */
const enqueueAll = (entity, alias, id, cabinet, from) =>
  `INSERT INTO outbox (id, entity, entity_id, cabinet_id, op, payload, edited_at)
    SELECT ${NEW_ID}, '${entity}', ${id}, ${cabinet}, 'insert', ${fullPayload(entity, alias)}, ${NOW}
    ${from};`;

const categoryId = (row) => `${row}.medicine_id || '|' || ${row}.category`;

/** Everything of the medicines a `where` picks, in the order the server needs. */
const medicinesUp = (where) => [
  enqueueAll('medicines', 'm', 'm.id', 'm.cabinet_id', `FROM medicines m WHERE ${where} ORDER BY m.created_at`),
  enqueueAll(
    'custom_categories',
    'c',
    'c.id',
    'NULL',
    `FROM custom_categories c WHERE c.id IN (
      SELECT mc.category FROM medicine_categories mc JOIN medicines m ON m.id = mc.medicine_id WHERE ${where})`,
  ),
  enqueueAll(
    'packages',
    'p',
    'p.id',
    'm.cabinet_id',
    `FROM packages p JOIN medicines m ON m.id = p.medicine_id WHERE ${where} ORDER BY p.created_at`,
  ),
  enqueueAll(
    'medicine_categories',
    'mc',
    categoryId('mc'),
    'm.cabinet_id',
    `FROM medicine_categories mc JOIN medicines m ON m.id = mc.medicine_id WHERE ${where}`,
  ),
];

const trigger = (name, when, table, conditions, body) =>
  `CREATE TRIGGER ${name} AFTER ${when} ON ${table}
  WHEN ${[...conditions, NOT_APPLYING].join('\n    AND ')}
BEGIN
  ${body.join('\n  ')}
END;`;

const triggers = [
  // A cabinet goes up whole when it is first shared.
  trigger('sync_cabinet_shared', 'UPDATE OF synced', 'cabinets', ['OLD.synced = 0', 'NEW.synced = 1'], [
    enqueue('cabinets', 'NEW.id', 'NEW.id', 'insert', fullPayload('cabinets', 'NEW')),
    ...medicinesUp('m.cabinet_id = NEW.id'),
  ]),
  trigger('sync_cabinet_update', 'UPDATE', 'cabinets', ['OLD.synced = 1', 'NEW.synced = 1', changed('cabinets')], [
    enqueue('cabinets', 'NEW.id', 'NEW.id', 'update', changedPayload('cabinets')),
  ]),
  // The owner deletes it for everyone; anyone else leaves it. The role says which.
  trigger('sync_cabinet_delete', 'DELETE', 'cabinets', ['OLD.synced = 1'], [
    enqueue('cabinets', 'OLD.id', 'OLD.id', 'delete', `json_object('role', OLD.role)`),
  ]),

  trigger('sync_medicine_insert', 'INSERT', 'medicines', [synced('NEW.cabinet_id')], [
    enqueue('medicines', 'NEW.id', 'NEW.cabinet_id', 'insert', fullPayload('medicines', 'NEW')),
  ]),
  // An edit, or a move between two synced cabinets.
  trigger(
    'sync_medicine_update',
    'UPDATE',
    'medicines',
    [synced('OLD.cabinet_id'), synced('NEW.cabinet_id'), changed('medicines')],
    [enqueue('medicines', 'NEW.id', 'NEW.cabinet_id', 'update', changedPayload('medicines'))],
  ),
  // Moved to a personal cabinet: gone for the others.
  trigger('sync_medicine_out', 'UPDATE OF cabinet_id', 'medicines', [synced('OLD.cabinet_id'), `NOT ${synced('NEW.cabinet_id')}`], [
    enqueue('medicines', 'NEW.id', 'OLD.cabinet_id', 'delete', `'{}'`),
  ]),
  // Moved in from a personal cabinet: up whole.
  trigger('sync_medicine_in', 'UPDATE OF cabinet_id', 'medicines', [`NOT ${synced('OLD.cabinet_id')}`, synced('NEW.cabinet_id')], [
    ...medicinesUp('m.id = NEW.id'),
  ]),
  // A cabinet's own delete takes its medicines with it on the server; by then
  // the cabinet row is gone, so these do not fire for it.
  trigger('sync_medicine_delete', 'DELETE', 'medicines', [synced('OLD.cabinet_id')], [
    enqueue('medicines', 'OLD.id', 'OLD.cabinet_id', 'delete', `'{}'`),
  ]),

  trigger('sync_package_insert', 'INSERT', 'packages', [synced(cabinetOf('NEW.medicine_id'))], [
    enqueue('packages', 'NEW.id', cabinetOf('NEW.medicine_id'), 'insert', fullPayload('packages', 'NEW')),
  ]),
  trigger(
    'sync_package_update',
    'UPDATE',
    'packages',
    [synced(cabinetOf('OLD.medicine_id')), synced(cabinetOf('NEW.medicine_id')), changed('packages')],
    [enqueue('packages', 'NEW.id', cabinetOf('NEW.medicine_id'), 'update', changedPayload('packages'))],
  ),
  // Merged into a medicine of another kind of cabinet: a delete on one side, an insert on the other.
  trigger(
    'sync_package_out',
    'UPDATE OF medicine_id',
    'packages',
    [synced(cabinetOf('OLD.medicine_id')), `NOT ${synced(cabinetOf('NEW.medicine_id'))}`],
    [enqueue('packages', 'NEW.id', cabinetOf('OLD.medicine_id'), 'delete', `'{}'`)],
  ),
  trigger(
    'sync_package_in',
    'UPDATE OF medicine_id',
    'packages',
    [`NOT ${synced(cabinetOf('OLD.medicine_id'))}`, synced(cabinetOf('NEW.medicine_id'))],
    [enqueue('packages', 'NEW.id', cabinetOf('NEW.medicine_id'), 'insert', fullPayload('packages', 'NEW'))],
  ),
  // With its medicine gone (a cascade), the medicine's own delete says it all.
  trigger('sync_package_delete', 'DELETE', 'packages', [synced(cabinetOf('OLD.medicine_id'))], [
    enqueue('packages', 'OLD.id', cabinetOf('OLD.medicine_id'), 'delete', `'{}'`),
  ]),

  trigger('sync_category_insert', 'INSERT', 'medicine_categories', [synced(cabinetOf('NEW.medicine_id'))], [
    // An own category goes up first, so the others can show it.
    enqueueAll('custom_categories', 'c', 'c.id', 'NULL', 'FROM custom_categories c WHERE c.id = NEW.category'),
    enqueue('medicine_categories', categoryId('NEW'), cabinetOf('NEW.medicine_id'), 'insert', fullPayload('medicine_categories', 'NEW')),
  ]),
  trigger('sync_category_delete', 'DELETE', 'medicine_categories', [synced(cabinetOf('OLD.medicine_id'))], [
    enqueue('medicine_categories', categoryId('OLD'), cabinetOf('OLD.medicine_id'), 'delete', `'{}'`),
  ]),

  // An own category: the server keeps it if a shared medicine used it, and ignores the rest.
  trigger(
    'sync_custom_category_update',
    'UPDATE',
    'custom_categories',
    ['EXISTS (SELECT 1 FROM cabinets WHERE synced = 1)', changed('custom_categories')],
    [enqueue('custom_categories', 'NEW.id', 'NULL', 'update', changedPayload('custom_categories'))],
  ),
  trigger('sync_custom_category_delete', 'DELETE', 'custom_categories', ['EXISTS (SELECT 1 FROM cabinets WHERE synced = 1)'], [
    enqueue('custom_categories', 'OLD.id', 'NULL', 'delete', `'{}'`),
  ]),
];

const header = `-- Generated by tools/sync-triggers.mjs; edit that, not this.\n`;
writeFileSync(out, header + triggers.join('\n--> statement-breakpoint\n') + '\n');
console.log(`${triggers.length} triggers → ${out}`);
