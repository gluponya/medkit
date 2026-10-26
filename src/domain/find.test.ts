import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoryCounts, findMedicines, foundStatus, matchesQuery, type Findable } from './find.ts';

const med = (id: string, cabinetId: string, name: string, inn: string | null, extra: Partial<Findable> = {}): Findable => ({
  id,
  cabinetId,
  name,
  inn,
  form: 'tablets',
  strength: null,
  categories: [],
  packs: ['2027-03-31'],
  ...extra,
});

const items = [
  med('n', 'home', 'Нурофен 200 мг', 'Ібупрофен', { categories: ['pain'] }),
  med('p', 'home', 'Парацетамол', 'Парацетамол', { categories: ['pain', 'cold'] }),
  med('k', 'car', 'Нурофен для дітей', 'Ібупрофен', { categories: ['pain'] }),
  med('i', 'dacha', 'Імет 400 мг', 'Ібупрофен', { packs: ['2026-01-31'] }),
];

const find = (query: string, category: string | null = null, current = 'home') =>
  findMedicines(items, { query, category }, ['home', 'car', 'dacha'], current, '2026-10-24', () => 30).map((g) => [
    g.cabinetId,
    g.medicines.map((m) => m.id),
  ]);

test('a medicine is found by its substance too', () => {
  assert.deepEqual(find('ібуп'), [
    ['home', ['n']],
    ['car', ['k']],
    ['dacha', ['i']],
  ]);
});

test('the current cabinet comes first', () => {
  assert.deepEqual(find('ібуп', null, 'dacha')[0], ['dacha', ['i']]);
});

test('every word must match, as a prefix, whatever the letters', () => {
  assert.equal(matchesQuery({ name: 'Нурофен для дітей', inn: null }, 'нур діт'), true);
  assert.equal(matchesQuery({ name: 'Нурофен для дітей', inn: null }, 'нур форте'), false);
  assert.equal(matchesQuery({ name: 'Нурофен', inn: null }, 'rofen'), false);
  assert.equal(matchesQuery({ name: 'Нурофен', inn: null }, 'nurofen'), true);
});

test('a category alone, or with words', () => {
  assert.deepEqual(find('', 'pain'), [
    ['home', ['n', 'p']],
    ['car', ['k']],
  ]);
  assert.deepEqual(find('пара', 'pain'), [['home', ['p']]]);
  assert.deepEqual(find(''), []);
});

test('expired only when every pack is', () => {
  assert.deepEqual(foundStatus(['2026-01-31'], '2026-10-24', 30), { status: 'expired', expires: '2026-01-31' });
  assert.deepEqual(foundStatus(['2026-01-31', '2026-11-15'], '2026-10-24', 30), { status: 'expiring', expires: '2026-11-15' });
  assert.deepEqual(foundStatus(['2026-01-31', null], '2026-10-24', 30), { status: 'unknown', expires: null });
  assert.deepEqual(foundStatus([], '2026-10-24', 30), { status: null, expires: null });
});

test('categories are counted over every cabinet', () => {
  assert.deepEqual([...categoryCounts(items)], [
    ['pain', 3],
    ['cold', 1],
  ]);
});
