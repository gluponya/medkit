import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, expiryFromMonth, expiryMonth, expiryStatus, monthsLeft, worstStatus } from './expiry.ts';

test('a printed month expires on its last day', () => {
  assert.equal(expiryFromMonth(2027, 3), '2027-03-31');
  assert.equal(expiryFromMonth(2027, 4), '2027-04-30');
  assert.equal(expiryFromMonth(2028, 2), '2028-02-29');
  assert.equal(expiryFromMonth(2027, 2), '2027-02-28');
  assert.equal(expiryFromMonth(2027, 12), '2027-12-31');
});

test('the month comes back as printed', () => {
  assert.deepEqual(expiryMonth('2027-09-30'), { year: 2027, month: 9 });
});

test('days move across months and years', () => {
  assert.equal(addDays('2026-10-24', 30), '2026-11-23');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2027-03-01', -1), '2027-02-28');
});

test('status follows the warning window', () => {
  const today = '2026-10-24';
  assert.equal(expiryStatus('2026-10-23', today, 30), 'expired');
  // The last day of the month is still a good day.
  assert.equal(expiryStatus('2026-10-24', today, 30), 'expiring');
  assert.equal(expiryStatus('2026-11-23', today, 30), 'expiring');
  assert.equal(expiryStatus('2026-11-24', today, 30), 'good');
});

test('a medicine shows its worst pack', () => {
  assert.equal(worstStatus([]), 'good');
  assert.equal(worstStatus(['good', 'expiring']), 'expiring');
  assert.equal(worstStatus(['expiring', 'expired', 'good']), 'expired');
});

test('months are counted from this month', () => {
  assert.equal(monthsLeft('2026-10-24', 2027, 3), 5);
  assert.equal(monthsLeft('2026-10-24', 2026, 10), 0);
  assert.equal(monthsLeft('2026-10-24', 2026, 9), -1);
  assert.equal(monthsLeft('2026-10-24', 2028, 3), 17);
});
