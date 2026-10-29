import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stepDose } from './dose.ts';

test('a whole dose steps by one, down to a half', () => {
  assert.equal(stepDose(2, 1), 3);
  assert.equal(stepDose(2, -1), 1);
  assert.equal(stepDose(1, -1), 0.5);
});

test('a half dose goes to the whole next to it', () => {
  assert.equal(stepDose(2.5, 1), 3);
  assert.equal(stepDose(2.5, -1), 2);
  assert.equal(stepDose(0.5, 1), 1);
  assert.equal(stepDose(0.5, -1), 0.5);
});

test('any other fraction goes to the next half first', () => {
  assert.equal(stepDose(0.3, 1), 0.5);
  assert.equal(stepDose(1.2, -1), 1);
  assert.equal(stepDose(1.7, 1), 2);
  assert.equal(stepDose(0.2, -1), 0.5);
});
