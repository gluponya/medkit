import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { CabinetIcon, CabinetMode, Place } from '@/domain/places';

/**
 * The phone's database (docs/model.md). Ids are uuidv7 strings made on the
 * phone, so a row keeps its id when a shared cabinet later syncs. Days are
 * `YYYY-MM-DD` text (src/domain/expiry.ts), moments are ISO text.
 */

const createdAt = () =>
  text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`);

export const cabinets = sqliteTable('cabinets', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  place: text('place').$type<Place>().notNull(),
  icon: text('icon').$type<CabinetIcon>().notNull(),
  mode: text('mode').$type<CabinetMode>().notNull(),
  expiryWarningDays: integer('expiry_warning_days').notNull().default(30),
  createdAt: createdAt(),
});

export type MedicineForm =
  | 'tablets'
  | 'capsules'
  | 'drops'
  | 'syrup'
  | 'ointment'
  | 'spray'
  | 'powder'
  | 'other';

export const medicines = sqliteTable(
  'medicines',
  {
    id: text('id').primaryKey(),
    cabinetId: text('cabinet_id')
      .notNull()
      .references(() => cabinets.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    inn: text('inn'),
    form: text('form').$type<MedicineForm>(),
    strength: text('strength'),
    manufacturer: text('manufacturer'),
    rx: integer('rx', { mode: 'boolean' }).notNull().default(false),
    lowStockThreshold: integer('low_stock_threshold'),
    createdAt: createdAt(),
  },
  (t) => [index('medicines_cabinet').on(t.cabinetId)],
);

export type PackageStatus = 'active' | 'used_up' | 'disposed';

export const packages = sqliteTable(
  'packages',
  {
    id: text('id').primaryKey(),
    medicineId: text('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    /** The last day of the month printed on the pack. */
    expires: text('expires').notNull(),
    /** In the form's unit; null means the pack is not counted. */
    quantity: integer('quantity'),
    openedAt: text('opened_at'),
    status: text('status').$type<PackageStatus>().notNull().default('active'),
    createdAt: createdAt(),
  },
  (t) => [index('packages_medicine').on(t.medicineId)],
);
