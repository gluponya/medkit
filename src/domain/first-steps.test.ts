import assert from 'node:assert/strict';
import { test } from 'node:test';

import { firstSteps, firstStepsFinished, type FirstStepsInput } from './first-steps.ts';

const fresh: FirstStepsInput = {
  withIntake: true,
  medicineCount: 0,
  reminderCount: 0,
  evidenceAnswered: false,
  later: [],
};

test('a fresh home cabinet starts on the first step', () => {
  const steps = firstSteps(fresh);
  assert.deepEqual(
    steps.map((s) => [s.id, s.state, s.current]),
    [
      ['medicines', 'open', true],
      ['reminders', 'open', false],
      ['evidence', 'open', false],
    ],
  );
  assert.equal(firstStepsFinished(steps), false);
});

test('a cabinet without intake has no reminders step', () => {
  assert.deepEqual(
    firstSteps({ ...fresh, withIntake: false }).map((s) => s.id),
    ['medicines', 'evidence'],
  );
});

test('adding a medicine moves on to reminders', () => {
  const steps = firstSteps({ ...fresh, medicineCount: 3 });
  assert.equal(steps[0].state, 'done');
  assert.equal(steps[1].current, true);
});

test('putting a step off moves on to the next', () => {
  const steps = firstSteps({ ...fresh, later: ['medicines'] });
  assert.equal(steps[0].state, 'later');
  assert.equal(steps[0].current, false);
  assert.equal(steps[1].current, true);
});

test('the card is finished once every step is done or put off', () => {
  assert.equal(firstStepsFinished(firstSteps({ ...fresh, medicineCount: 1, later: ['reminders'] })), false);
  assert.equal(firstStepsFinished(firstSteps({ ...fresh, medicineCount: 1, later: ['reminders'], evidenceAnswered: true })), true);
  assert.equal(firstStepsFinished(firstSteps({ ...fresh, withIntake: false, later: ['medicines'], evidenceAnswered: true })), true);
});

test('the evidence question comes last, after the others are settled', () => {
  const steps = firstSteps({ ...fresh, medicineCount: 2, reminderCount: 1 });
  assert.deepEqual(
    steps.map((s) => [s.id, s.state, s.current]),
    [
      ['medicines', 'done', false],
      ['reminders', 'done', false],
      ['evidence', 'open', true],
    ],
  );
});
