import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ReminderPlan } from './reminders.ts';
import { daysLeft, doseToMark, minutesUntil, nextDose, todayDoses, type IntakeMark } from './today.ts';

const plan = (medicineId: string, times: string[], over: Partial<ReminderPlan & { since: string }> = {}) => ({
  medicineId,
  since: '2026-10-20T07:00',
  schedule: 'daily' as const,
  times: times.map((time) => ({ time, dose: 1 })),
  daysOfWeek: null,
  start: '2026-10-20',
  days: null,
  ...over,
});

const taken = (medicineId: string, due: string): IntakeMark => ({
  medicineId,
  due,
  status: 'taken',
  at: '2026-10-24T05:04:00.000Z',
});

test('todayDoses orders the doses and tells what became of each', () => {
  const plans = [plan('a', ['08:00', '20:00']), plan('b', ['09:00']), plan('c', ['13:00'])];
  const doses = todayDoses(plans, [taken('a', '2026-10-24T08:00')], '2026-10-24', '10:00');
  assert.deepEqual(
    doses.map((d) => [d.time, d.state]),
    [
      ['08:00', 'taken'],
      ['09:00', 'due'],
      ['13:00', 'later'],
      ['20:00', 'later'],
    ],
  );
  assert.equal(doses[0].at, '2026-10-24T05:04:00.000Z');
  assert.equal(doses[1].due, '2026-10-24T09:00');
});

test('a dose an hour and more behind is missed', () => {
  const doses = todayDoses([plan('b', ['09:00'])], [], '2026-10-24', '10:01');
  assert.equal(doses[0].state, 'missed');
});

test('doses before the reminder was saved show only when answered', () => {
  const saved = [plan('a', ['07:30', '08:00', '20:00'], { since: '2026-10-24T08:30' })];
  const doses = todayDoses(saved, [taken('a', '2026-10-24T08:00')], '2026-10-24', '12:00');
  assert.deepEqual(
    doses.map((d) => [d.time, d.state]),
    [
      ['08:00', 'taken'],
      ['20:00', 'later'],
    ],
  );
});

test('an intake of another day or medicine does not count', () => {
  const marks = [taken('a', '2026-10-23T08:00'), taken('x', '2026-10-24T08:00')];
  assert.equal(todayDoses([plan('a', ['08:00'])], marks, '2026-10-24', '08:30')[0].state, 'due');
});

test('days without doses and as needed reminders are left out', () => {
  const plans = [
    plan('w', ['08:00'], { schedule: 'days_of_week', daysOfWeek: [1] }),
    plan('n', [''], { schedule: 'as_needed' }),
  ];
  assert.deepEqual(todayDoses(plans, [], '2026-10-24', '07:00'), []);
});

test('nextDose skips what is answered or missed', () => {
  const doses = todayDoses([plan('a', ['08:00', '09:00', '13:00'])], [taken('a', '2026-10-24T08:00')], '2026-10-24', '10:30');
  assert.equal(nextDose(doses)?.time, '13:00');
  assert.equal(nextDose([]), null);
});

test('minutesUntil and daysLeft', () => {
  assert.equal(minutesUntil('10:00', '13:00'), 180);
  assert.equal(minutesUntil('10:00', '09:00'), 0);
  assert.equal(daysLeft({ start: '2026-10-20', days: 10 }, '2026-10-24'), 6);
  assert.equal(daysLeft({ start: '2026-10-20', days: 3 }, '2026-10-24'), 0);
  assert.equal(daysLeft({ start: '2026-10-20', days: null }, '2026-10-24'), null);
});

test('doseToMark picks the due dose, then one within the hour, then the latest missed', () => {
  const plans = [plan('a', ['08:00', '12:00', '14:00', '20:00'])];
  const at = (now: string) => doseToMark(todayDoses(plans, [], '2026-10-24', now), now)?.time ?? null;
  assert.equal(at('12:30'), '12:00');
  assert.equal(at('13:10'), '14:00');
  assert.equal(at('16:00'), '14:00');
  assert.equal(at('07:30'), '08:00');
  assert.equal(at('06:00'), null);
  const answered = todayDoses(plans, [taken('a', '2026-10-24T14:00')], '2026-10-24', '16:00');
  assert.equal(doseToMark(answered, '16:00')?.time, '12:00');
});
