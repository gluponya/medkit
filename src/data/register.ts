import * as SQLite from 'expo-sqlite';

import type { MedicineForm } from '@/domain/medicine';
import { brandOf, distinctEntries, formFromRegister, INSTRUCTION_BASE, searchQuery, searchText } from '@/domain/register';

import { REGISTER_VERSION } from './register-version';

/**
 * The State Register as the app searches it: assets/register.db, built by
 * tools/build-register.mjs. It ships with the app and is only read; a new app
 * version brings a new file, which replaces the old copy on first use. It is a
 * separate file from medkit.db, so the person's data never migrates with it.
 */

const NAME = 'register.db';

export type RegisterEntry = {
  id: string;
  /** Trade name, as the Register writes it: «НУРОФЄН®». */
  name: string;
  /** The international name, in Latin: «Ibuprofen». */
  inn: string | null;
  form: MedicineForm;
  strength: string | null;
  /** «Форма випуску» in full, with the pack sizes. */
  formText: string;
  rx: boolean;
  /** «Склад (діючі)»: the substances in Ukrainian, as the instruction lists them. */
  composition: string | null;
  atc: string[];
  manufacturer: string | null;
  country: string | null;
  regNumber: string | null;
  instructionUrl: string | null;
  shelfLifeMonths: number | null;
};

type Row = {
  id: string;
  name: string;
  inn: string | null;
  form: MedicineForm;
  strength: string | null;
  form_text: string;
  rx: number;
  composition: string | null;
  atc: string;
  manufacturer: string | null;
  country: string | null;
  reg_number: string | null;
  instruction_url: string | null;
  shelf_life_months: number | null;
};

function toEntry(r: Row): RegisterEntry {
  return {
    id: r.id,
    name: r.name,
    inn: r.inn,
    // The bundled database was built before the forms under «Інше» were told apart.
    form: r.form === 'other' ? formFromRegister(r.form_text) : r.form,
    strength: r.strength,
    formText: r.form_text,
    rx: r.rx === 1,
    composition: r.composition,
    atc: r.atc ? r.atc.split(' ') : [],
    manufacturer: r.manufacturer,
    country: r.country,
    regNumber: r.reg_number,
    instructionUrl: r.instruction_url && INSTRUCTION_BASE + r.instruction_url,
    shelfLifeMonths: r.shelf_life_months,
  };
}

async function builtOn(db: SQLite.SQLiteDatabase): Promise<string | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(`select value from meta where key = 'built'`);
    return row?.value ?? null;
  } catch {
    return null; // an empty file: never copied, or a copy that broke
  }
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const asset = { assetId: require('../../assets/register.db') as number };
  await SQLite.importDatabaseFromAssetAsync(NAME, asset);
  let db = await SQLite.openDatabaseAsync(NAME);
  if ((await builtOn(db)) !== REGISTER_VERSION) {
    await db.closeAsync();
    await SQLite.importDatabaseFromAssetAsync(NAME, { ...asset, forceOverwrite: true });
    db = await SQLite.openDatabaseAsync(NAME);
  }
  return db;
}

let opening: Promise<SQLite.SQLiteDatabase> | null = null;

function register(): Promise<SQLite.SQLiteDatabase> {
  opening ??= open().catch((e: unknown) => {
    opening = null; // try again next time
    throw e;
  });
  return opening;
}

/**
 * Entries matching what was typed, best first: a match in the name counts most,
 * then the international name, then the composition. The same medicine from
 * another maker or in another flavour is left out. Empty for an empty query.
 * The limit is high on purpose: «ібупрофен» alone is in 132 entries, and the
 * screen groups the ones found by substance (splitResults).
 */
export async function searchRegister(text: string, limit = 150): Promise<RegisterEntry[]> {
  const match = searchQuery(text);
  if (!match) return [];
  const rows = await (await register()).getAllAsync<Row>(
    `select e.* from register_search s
       join register_entries e on e.rowid = s.rowid
      where register_search match ?
      order by bm25(register_search, 10, 3, 1)
      limit ?`,
    [match, limit * 2],
  );
  return distinctEntries(rows.map(toEntry)).slice(0, limit);
}

let brands: Promise<string[]> | null = null;

/**
 * Every brand in the Register once, the commonest first (most entries), for
 * the «did you mean» of a misspelt search (closeBrands).
 */
export function registerBrands(): Promise<string[]> {
  brands ??= register()
    .then((db) => db.getAllAsync<{ name: string }>(`select name from register_entries`))
    .then((rows) => {
      const count = new Map<string, { brand: string; n: number }>();
      for (const { name } of rows) {
        const brand = brandOf(name);
        const key = searchText(brand).replace(/['’ʼ`]/g, ''); // «здоров’я» and «здоров'я»
        const seen = count.get(key);
        if (seen) seen.n++;
        else count.set(key, { brand, n: 1 });
      }
      return [...count.values()].sort((a, b) => b.n - a.n).map((b) => b.brand);
    })
    .catch((e: unknown) => {
      brands = null;
      throw e;
    });
  return brands;
}

export async function getRegisterEntry(id: string): Promise<RegisterEntry | null> {
  const row = await (await register()).getFirstAsync<Row>(`select * from register_entries where id = ?`, [id]);
  return row ? toEntry(row) : null;
}

/** Several entries at once, in no particular order; ids not in the Register are left out. */
export async function getRegisterEntries(ids: readonly string[]): Promise<RegisterEntry[]> {
  if (ids.length === 0) return [];
  const rows = await (await register()).getAllAsync<Row>(
    `select * from register_entries where id in (select value from json_each(?))`,
    [JSON.stringify(ids)],
  );
  return rows.map(toEntry);
}
