import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { MedicineForm } from '@/domain/medicine';
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
    /** `register_entries.id` in assets/register.db, when picked from the Register. */
    registerId: text('register_id'),
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

/**
 * Categories the person adds next to the built-in ones (src/domain/categories.ts).
 * Kept per phone, not per cabinet, so an own category is there in every cabinet.
 */
export const customCategories = sqliteTable('custom_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  createdAt: createdAt(),
});

/** A medicine's tags: a built-in `Category` key, or a `custom_categories.id`. */
export const medicineCategories = sqliteTable(
  'medicine_categories',
  {
    medicineId: text('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.medicineId, t.category] }),
    index('medicine_categories_category').on(t.category),
  ],
);
