import assert from 'node:assert/strict';
import { test } from 'node:test';

import { NOT_A_BOX, boxQuery, expiryFromAnswer, rankForBox, readFlap, readFront, strengthKey, type BoxReading } from './box.ts';

const reading = (patch: Partial<BoxReading>): BoxReading => ({
  name: null,
  inn: null,
  strength: null,
  form: null,
  packSize: null,
  manufacturer: null,
  expires: null,
  ...patch,
});

test('the front is read key by key, and nothing is trusted', () => {
  assert.deepEqual(
    readFront({ name: ' Лірика ', inn: 'прегабалін', strength: '75 мг', form: 'capsules', packSize: 14, expires: '2028-08' }),
    reading({ name: 'Лірика', inn: 'прегабалін', strength: '75 мг', form: 'capsules', packSize: 14, expires: { year: 2028, month: 8 } }),
  );
  assert.deepEqual(readFront({ name: 42, form: 'pills', packSize: 2.5, expires: '08.2028' }), reading({}));
  assert.deepEqual(readFront('not json'), reading({}));
  assert.equal(readFront({ notABox: true }), NOT_A_BOX);
});

test('an expiry is only a real "YYYY-MM"', () => {
  assert.deepEqual(expiryFromAnswer('2027-05'), { year: 2027, month: 5 });
  assert.equal(expiryFromAnswer('2027-13'), null);
  assert.equal(expiryFromAnswer('05.2027'), null);
  assert.equal(expiryFromAnswer(null), null);
  assert.deepEqual(readFlap({ expires: '2026-12', unsure: [] }), { year: 2026, month: 12 });
  assert.equal(readFlap({ notABox: true }), null);
});

test('the search is the name, or the substance without one', () => {
  assert.equal(boxQuery(reading({ name: 'Лірика', inn: 'прегабалін' })), 'Лірика');
  assert.equal(boxQuery(reading({ inn: 'прегабалін' })), 'прегабалін');
  assert.equal(boxQuery(reading({})), null);
});

test('strengths compare by their numbers', () => {
  assert.equal(strengthKey('75 мг'), '75');
  assert.equal(strengthKey('0,5 %'), strengthKey('0.5%'));
  assert.equal(strengthKey('100 мг/5 мл'), '100/5');
  assert.equal(strengthKey(null), null);
});

test('the same name and strength come first', () => {
  const entries = [
    { name: 'ПРЕГАБАЛІН-ТЕВА', form: 'capsules' as const, strength: '75 мг' },
    { name: 'ЛІРИКА®', form: 'capsules' as const, strength: '150 мг' },
    { name: 'ЛІРИКА®', form: 'capsules' as const, strength: '75 мг' },
  ];
  const { best, others } = rankForBox(entries, reading({ name: 'Лірика', strength: '75 мг', form: 'capsules' }));
  assert.equal(best, entries[2]);
  assert.deepEqual(others, [entries[1], entries[0]]);
});

test('no entry of that name is no best match', () => {
  const entries = [{ name: 'ПРЕГАБАЛІН-ТЕВА', form: 'capsules' as const, strength: '75 мг' }];
  assert.deepEqual(rankForBox(entries, reading({ name: 'Лірика', strength: '75 мг' })), { best: null, others: entries });
});
