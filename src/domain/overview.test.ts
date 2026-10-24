import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysBetween } from './expiry.ts';
import { overview, type PackRow } from './overview.ts';

const row = (over: Partial<PackRow> & { medicineId: string }): PackRow => ({
  name: over.medicineId,
  form: 'tablets',
  lowStockThreshold: null,
  expires: '2028-01-31',
  quantity: null,
  ...over,
});

test('days are counted between calendar days', () => {
  assert.equal(daysBetween('2026-10-24', '2026-11-10'), 17);
  assert.equal(daysBetween('2026-10-24', '2026-10-23'), -1);
});

test('expired comes first, then expiring, then low stock, the rest by name', () => {
  const o = overview(
    [
      row({ medicineId: 'Сорбіфер', quantity: 4, lowStockThreshold: 10 }),
      row({ medicineId: 'Нурофен', expires: '2026-11-10' }),
      row({ medicineId: 'Називін', expires: '2026-09-30' }),
      row({ medicineId: 'Парацетамол' }),
      row({ medicineId: 'Аквадетрим' }),
    ],
    '2026-10-24',
    30,
  );
  assert.deepEqual(
    o.attention.map((m) => [m.name, m.reason]),
    [
      ['Називін', 'expired'],
      ['Нурофен', 'expiring'],
      ['Сорбіфер', 'low'],
    ],
  );
  assert.equal(o.attention[1].daysLeft, 17);
  assert.deepEqual(o.rest.map((m) => m.name), ['Аквадетрим', 'Парацетамол']);
  assert.equal(o.total, 5);
});

test('a medicine shows its soonest pack and the stock of all of them', () => {
  const o = overview(
    [
      row({ medicineId: 'm', expires: '2028-05-31', quantity: 20 }),
      row({ medicineId: 'm', expires: '2027-03-31', quantity: 10, lowStockThreshold: 5 }),
    ],
    '2026-10-24',
    30,
  );
  assert.equal(o.rest[0].expires, '2027-03-31');
  assert.equal(o.rest[0].stock, 30);
  assert.equal(o.rest[0].low, false);
});

test('uncounted packs never read as low stock', () => {
  const o = overview([row({ medicineId: 'm', lowStockThreshold: 5 })], '2026-10-24', 30);
  assert.equal(o.rest[0].stock, null);
  assert.equal(o.attention.length, 0);
});
