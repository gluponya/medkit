import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'medkit.db';

// enableChangeListener is needed for useLiveQuery: without it the screens do not
// redraw after a write.
export const sqlite = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
sqlite.execSync('pragma foreign_keys = on');

export const db = drizzle(sqlite, { schema });

export { schema };
export type Database = typeof db;
