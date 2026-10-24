import assert from 'node:assert/strict';
import { test } from 'node:test';

import { pluralCategory } from './plural.ts';

const uk = (n: number) => pluralCategory('uk', n);
const en = (n: number) => pluralCategory('en', n);

test('english has one and other, and nothing else', () => {
  assert.equal(en(1), 'one');
  assert.equal(en(0), 'other');
  assert.equal(en(2), 'other');
  assert.equal(en(21), 'other');
});

test('ukrainian: one for 1, 21, 31 but not for 11', () => {
  assert.equal(uk(1), 'one');
  assert.equal(uk(21), 'one');
  assert.equal(uk(101), 'one');
  assert.equal(uk(11), 'many');
  assert.equal(uk(111), 'many');
});

test('ukrainian: few for 2-4 but not for the teens', () => {
  assert.equal(uk(2), 'few');
  assert.equal(uk(4), 'few');
  assert.equal(uk(22), 'few');
  assert.equal(uk(104), 'few');
  assert.equal(uk(12), 'many');
  assert.equal(uk(14), 'many');
  assert.equal(uk(114), 'many');
});

test('ukrainian: many for 0, 5-10 and the rest', () => {
  assert.equal(uk(0), 'many');
  assert.equal(uk(5), 'many');
  assert.equal(uk(10), 'many');
  assert.equal(uk(25), 'many');
});

test('a fraction is other in both languages', () => {
  // Never happens with items, but the rule must not fall through to a form that
  // reads wrong if a quantity ever becomes fractional.
  assert.equal(uk(1.5), 'other');
  assert.equal(en(1.5), 'other');
});

test('a negative count uses the same forms as its absolute value', () => {
  assert.equal(uk(-1), 'one');
  assert.equal(uk(-3), 'few');
  assert.equal(en(-1), 'one');
});
