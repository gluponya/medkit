import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { MedicineForm } from '@/domain/medicine';
import type { CabinetIcon, CabinetMode, Place } from '@/domain/places';
import type { MemberRole } from '@/domain/sharing';

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
  /** Expiry notices and the weekly summary include this cabinet. */
  expiryPush: integer('expiry_push', { mode: 'boolean' }).notNull().default(true),
  /**
   * Shared through the server (docs/model.md, "Syncing a shared cabinet"): set
   * when its owner first opens «Запросити», or when it was joined. Changes in it
   * go to the outbox by the triggers of migration 0008.
   */
  synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
  /** This person's role in a synced cabinet; null in a personal one, which is all theirs. */
  role: text('role').$type<MemberRole>(),
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
    /** The last day of the month printed on the pack; null when she picked «Не знаю». */
    expires: text('expires'),
    /** In the form's unit; null means the pack is not counted. */
    quantity: integer('quantity'),
    openedAt: text('opened_at'),
    status: text('status').$type<PackageStatus>().notNull().default('active'),
    /**
     * The code scanned off the pack (docs/model.md, "Barcodes"), so «Змінити
     * ліки» can correct what the code is. Kept on this phone only, not synced.
     */
    gtin: text('gtin'),
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

/** How often a reminder fires (docs/model.md, "Reminder"). */
export type ReminderSchedule = 'daily' | 'days_of_week' | 'as_needed';

/** One dose time of a reminder: «08:00», 1 tablet. */
export type DoseTime = { time: string; dose: number };

/**
 * An intake reminder. It belongs to a person, not the cabinet; there is one
 * person on the phone until shared cabinets come, so no person column yet.
 */
export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    medicineId: text('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    schedule: text('schedule').$type<ReminderSchedule>().notNull(),
    /** Empty for `as_needed`. */
    times: text('times', { mode: 'json' }).$type<DoseTime[]>().notNull(),
    /** 1 is Monday … 7 is Sunday; only for `days_of_week`. */
    daysOfWeek: text('days_of_week', { mode: 'json' }).$type<number[]>(),
    /** The first day of the course. */
    start: text('start').notNull(),
    /** Null is an ongoing course. */
    days: integer('days'),
    createdAt: createdAt(),
  },
  (t) => [index('reminders_medicine').on(t.medicineId)],
);

export type IntakeStatus = 'taken' | 'skipped';

/** One dose taken or skipped. A taken dose came out of `package_id`. */
export const intakes = sqliteTable(
  'intakes',
  {
    id: text('id').primaryKey(),
    medicineId: text('medicine_id')
      .notNull()
      .references(() => medicines.id, { onDelete: 'cascade' }),
    /** Null for a dose taken without a reminder. */
    reminderId: text('reminder_id').references(() => reminders.id, { onDelete: 'set null' }),
    packageId: text('package_id').references(() => packages.id, { onDelete: 'set null' }),
    dose: integer('dose').notNull(),
    status: text('status').$type<IntakeStatus>().notNull(),
    /** The dose time it answers, `YYYY-MM-DDTHH:MM` local; null without a reminder. */
    due: text('due'),
    at: text('at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('intakes_medicine').on(t.medicineId)],
);

/**
 * A shopping line that cannot be derived from packs (docs/model.md, "Shopping
 * list"): added by hand, «Купити нову», or a derived line ticked as bought.
 */
export const shoppingItems = sqliteTable(
  'shopping_items',
  {
    id: text('id').primaryKey(),
    cabinetId: text('cabinet_id')
      .notNull()
      .references(() => cabinets.id, { onDelete: 'cascade' }),
    medicineId: text('medicine_id').references(() => medicines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    boughtAt: text('bought_at'),
    /** × on a medicine's line: off the list until a new pack of it arrives. */
    dismissedAt: text('dismissed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('shopping_items_cabinet').on(t.cabinetId)],
);

/**
 * Changes in synced cabinets waiting to go to the server, in `seq` order. Written
 * only by the SQLite triggers of migration 0008, never by the app's code; the
 * sync worker (src/data/sync) sends and deletes them.
 */
export const outbox = sqliteTable('outbox', {
  seq: integer('seq').primaryKey({ autoIncrement: true }),
  /** Sent with the change, so a resend after a lost answer is applied once. */
  id: text('id').notNull(),
  entity: text('entity').notNull(),
  /** The row's id; `medicine_id|category` for a medicine's category. */
  entityId: text('entity_id').notNull(),
  /** The synced cabinet it belongs to; null for an own category. */
  cabinetId: text('cabinet_id'),
  op: text('op').$type<'insert' | 'update' | 'delete'>().notNull(),
  /** JSON of the changed fields, in the server's column names. */
  payload: text('payload').notNull(),
  /** When the person made the change: the later edit of a field wins. */
  editedAt: text('edited_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
});

/**
 * The sync worker's own state: a pull cursor per server table, and
 * `applying` while it writes pulled rows, which keeps the triggers quiet.
 */
export const syncMeta = sqliteTable('sync_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** The people of each synced cabinet, as last brought from the server. */
export const members = sqliteTable(
  'members',
  {
    cabinetId: text('cabinet_id')
      .notNull()
      .references(() => cabinets.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    role: text('role').$type<MemberRole>().notNull(),
    joinedAt: text('joined_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.cabinetId, t.userId] })],
);
