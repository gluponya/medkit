import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accusativeUk } from '../i18n/grammar.ts';

import { courseEnd, daysOfSupply, dosesOn, unitsNeeded, upcomingDoses, weekday, type ReminderPlan } from './reminders.ts';
import { packOrder, packToTake, stockOf } from './stock.ts';

const plan = (over: Partial<ReminderPlan> = {}): ReminderPlan => ({
  schedule: 'daily',
  times: [
    { time: '08:00', dose: 1 },
    { time: '20:00', dose: 1 },
  ],
  daysOfWeek: null,
  start: '2026-10-24',
  days: 14,
  ...over,
});

test('weekdays start on Monday', () => {
  assert.equal(weekday('2026-10-26'), 1);
  assert.equal(weekday('2026-10-25'), 7);
});

test('a 14-day course from today ends 13 days later', () => {
  assert.equal(courseEnd(plan()), '2026-11-06');
  assert.equal(courseEnd(plan({ days: null })), null);
});

test('a course needs its doses for every day', () => {
  assert.equal(unitsNeeded(plan()), 28);
  assert.equal(unitsNeeded(plan({ days: null })), null);
  // Mondays and Thursdays in two weeks from Saturday 24.10: four days.
  assert.equal(unitsNeeded(plan({ schedule: 'days_of_week', daysOfWeek: [1, 4] })), 8);
});

test('no doses outside the course, on other weekdays or as needed', () => {
  assert.equal(dosesOn(plan(), '2026-10-23'), false);
  assert.equal(dosesOn(plan(), '2026-11-07'), false);
  assert.equal(dosesOn(plan({ schedule: 'days_of_week', daysOfWeek: [1] }), '2026-10-26'), true);
  assert.equal(dosesOn(plan({ schedule: 'days_of_week', daysOfWeek: [1] }), '2026-10-27'), false);
  assert.equal(dosesOn(plan({ schedule: 'as_needed' }), '2026-10-24'), false);
});

test('stock lasts by the dose a day', () => {
  assert.equal(daysOfSupply(plan(), 14), 7);
  assert.equal(daysOfSupply(plan(), null), null);
});

test('upcoming doses skip the ones already past today', () => {
  const doses = upcomingDoses([plan()], '2026-10-24', '12:00', 2);
  assert.deepEqual(
    doses.map((d) => `${d.day} ${d.time}`),
    ['2026-10-24 20:00', '2026-10-25 08:00', '2026-10-25 20:00'],
  );
});

test('a dose comes out of the opened pack, then the one expiring first', () => {
  const packs = [
    { id: 'late', expires: '2028-08-31', quantity: 10, openedAt: null },
    { id: 'soon', expires: '2026-11-30', quantity: 4, openedAt: null },
    { id: 'empty', expires: '2026-10-31', quantity: 0, openedAt: null },
    { id: 'uncounted', expires: '2026-10-31', quantity: null, openedAt: null },
  ];
  assert.equal(packToTake(packs)?.id, 'soon');
  assert.equal(packToTake([...packs, { id: 'open', expires: '2029-01-31', quantity: 3, openedAt: '2026-10-01' }])?.id, 'open');
  assert.deepEqual(packOrder(packs).map((p) => p.id), ['soon', 'empty', 'uncounted', 'late']);
  assert.equal(stockOf(packs), 14);
  assert.equal(stockOf([packs[3]]), null);
});

test('a feminine name changes after a verb', () => {
  assert.equal(accusativeUk('Лірика'), 'Лірику');
  assert.equal(accusativeUk('ЛІРИКА'), 'ЛІРИКУ');
  assert.equal(accusativeUk('Нурофен'), 'Нурофен');
});
