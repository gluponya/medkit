import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addMinutes, expiryNotices, nextMonday } from './notices.ts';

const pack = (packageId: string, expires: string) => ({ packageId, name: packageId, cabinet: 'Дім', expires });

test('a notice comes noticeDays before the date, soonest first', () => {
  const notices = expiryNotices([pack('b', '2026-12-31'), pack('a', '2026-12-10')], '2026-10-24', 30, 10);
  assert.deepEqual(
    notices.map((n) => [n.packageId, n.day]),
    [
      ['a', '2026-11-10'],
      ['b', '2026-12-01'],
    ],
  );
});

test('a notice whose day has passed is not sent late', () => {
  assert.deepEqual(expiryNotices([pack('a', '2026-11-01')], '2026-10-24', 30, 10), []);
  assert.deepEqual(expiryNotices([pack('a', '2026-11-23')], '2026-10-24', 30, 10), []);
  assert.equal(expiryNotices([pack('a', '2026-11-24')], '2026-10-24', 30, 10).length, 1);
});

test('only the soonest notices are kept', () => {
  const packs = ['2027-03-01', '2027-01-01', '2027-02-01'].map((d, i) => pack(String(i), d));
  assert.deepEqual(
    expiryNotices(packs, '2026-10-24', 7, 2).map((n) => n.expires),
    ['2027-01-01', '2027-02-01'],
  );
});

test('the summary comes on the next Monday', () => {
  assert.equal(nextMonday('2026-10-24'), '2026-10-26'); // Saturday
  assert.equal(nextMonday('2026-10-25'), '2026-10-26'); // Sunday
  assert.equal(nextMonday('2026-10-26'), '2026-11-02'); // Monday: the one after
});

test('minutes move a time within its day', () => {
  assert.equal(addMinutes('08:00', 15), '08:15');
  assert.equal(addMinutes('08:50', 15), '09:05');
  assert.equal(addMinutes('23:50', 15), null);
});
