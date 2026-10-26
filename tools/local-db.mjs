// A medkit.db in Node with every migration applied, for checks of the SQL the
// app runs (the sync triggers, tools/sync-check). Not used by the app.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DIR = new URL('../src/data/db/migrations/', import.meta.url);

export function openLocalDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('pragma foreign_keys = on');
  const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', DIR), 'utf8'));
  for (const entry of journal.entries) {
    const text = readFileSync(new URL(`${entry.tag}.sql`, DIR), 'utf8');
    for (const statement of text.split('--> statement-breakpoint')) {
      if (statement.trim()) db.exec(statement);
    }
  }
  return db;
}
