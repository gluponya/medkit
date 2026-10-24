// Builds assets/register.db, the State Register of Medicinal Products as the app
// searches it (docs/model.md, "Barcodes"), from the Register's CSV.
//
//   node tools/build-register.mjs [reestr.csv]
//
// Without a path it downloads the current CSV from drlz.com.ua. The CSV is in
// cp1251 with `;` between fields. Only medicines in force are kept: not expired,
// not cancelled early, and not bulk substances sold to factories.
//
// The file is read-only on the phone and replaced whole with a new app version,
// so it has no migrations. Also writes src/data/register-version.ts, which
// names the copy the app opens.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  INSTRUCTION_BASE,
  formFromRegister,
  rxFromRegister,
  searchText,
  shelfLifeMonths,
  strengthFromRegister,
} from '../src/domain/register.ts';

const SOURCE_URL = 'http://www.drlz.com.ua/ibp/zvity.nsf/all/zvit/$file/reestr.csv';
const outFile = path.resolve('assets/register.db');
const versionFile = path.resolve('src/data/register-version.ts');
const today = new Date().toISOString().slice(0, 10);

async function loadCsv(file) {
  if (file) return readFile(file);
  console.log(`downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** RFC 4180 with `;`: quoted fields may hold `;`, newlines and `""`. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ';') row.push(field), (field = '');
    else if (c === '\n') row.push(field.replace(/\r$/, '')), rows.push(row), (row = []), (field = '');
    else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

/** «31.12.2027» → «2027-12-31»; «необмежений» (no end) → null. */
function day(text) {
  const m = text.match(/(\d\d)\.(\d\d)\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** «ТОВ "Фармак" (виробництво, контроль якості…)» → «ТОВ "Фармак"». */
function manufacturer(text) {
  return text.replace(/\s*\([^()]*(\([^()]*\)[^()]*)*\)\s*$/, '').trim() || null;
}

const [header, ...rows] = parseCsv(new TextDecoder('windows-1251').decode(await loadCsv(process.argv[2])));
const columns = header.map((h) => h.trim());
const col = (name) => {
  const i = columns.indexOf(name);
  if (i < 0) throw new Error(`the CSV has no column «${name}»`);
  return i;
};
const C = {
  id: col('ID'),
  name: col('Торгівельне найменування'),
  inn: col('Міжнародне непатентоване найменування'),
  form: col('Форма випуску'),
  dispensing: col('Умови відпуску'),
  composition: col('Склад (діючі)'),
  atc: [col('Код АТС 1'), col('Код АТС 2'), col('Код АТС 3')],
  maker: col('Виробник 1: назва українською'),
  country: col('Виробник 1: країна'),
  regNumber: col('Номер Реєстраційного посвідчення'),
  ends: col('Дата закінчення'),
  cancelled: col('Дострокове припинення'),
  instruction: col('URL інструкції'),
  shelfValue: col('Термін придатності: значення'),
  shelfUnit: col('Термін придатності: одиниця вимірювання'),
};

const BULK = /субстанц|cубстанц|in bulk|для виробництва|для фармацевтичного застосування/i;
const inForce = rows.filter((r) => {
  if (r.length !== columns.length) return false;
  const ends = day(r[C.ends]);
  return (!ends || ends >= today) && r[C.cancelled] !== 'Так' && !BULK.test(r[C.form]);
});

await mkdir(path.dirname(outFile), { recursive: true });
await rm(outFile, { force: true });
const db = new DatabaseSync(outFile);
db.exec(`
  create table register_entries (
    id text not null unique,
    name text not null,
    inn text,
    form text not null,
    strength text,
    form_text text not null,
    rx integer not null,
    composition text,
    atc text not null,
    manufacturer text,
    country text,
    reg_number text,
    instruction_url text,
    shelf_life_months integer
  );
  -- Contentless: only the words, in searchText() form; its rowid is
  -- register_entries.rowid.
  create virtual table register_search using fts5(
    name, inn, composition,
    content = '',
    tokenize = 'unicode61 remove_diacritics 2'
  );
  create table meta (key text primary key, value text not null);
`);

const insert = db.prepare(`insert into register_entries values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const index = db.prepare(`insert into register_search(rowid, name, inn, composition) values (?, ?, ?, ?)`);
const text = (s) => s.trim() || null;
db.exec('begin');
for (const r of inForce) {
  const name = r[C.name].trim();
  const inn = text(r[C.inn]);
  const composition = text(r[C.composition]);
  const { lastInsertRowid } = insert.run(
    r[C.id],
    name,
    inn,
    formFromRegister(r[C.form]),
    strengthFromRegister(r[C.form]),
    r[C.form].trim(),
    rxFromRegister(r[C.dispensing]) ? 1 : 0,
    composition,
    C.atc.map((i) => r[i].trim()).filter(Boolean).join(' '),
    manufacturer(r[C.maker]),
    text(r[C.country]),
    text(r[C.regNumber]),
    text(r[C.instruction].replace(INSTRUCTION_BASE, '')),
    shelfLifeMonths(r[C.shelfValue], r[C.shelfUnit]),
  );
  index.run(lastInsertRowid, ...[name, inn, composition].map((s) => s && searchText(s)));
}
const meta = db.prepare('insert into meta values (?, ?)');
meta.run('built', today);
meta.run('source', 'Державний реєстр лікарських засобів України, drlz.com.ua (CC BY 4.0)');
db.exec('commit');
db.exec(`insert into register_search(register_search) values ('optimize')`);
db.exec('vacuum');
db.close();

await writeFile(
  versionFile,
  `// Written by tools/build-register.mjs: the build of assets/register.db.\n` +
    `export const REGISTER_VERSION = '${today}';\n`,
);
console.log(`${inForce.length} of ${rows.length} entries → ${path.relative('.', outFile)}`);
