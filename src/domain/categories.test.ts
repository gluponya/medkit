import assert from 'node:assert/strict';
import { test } from 'node:test';

import { categoriesForAtc } from './categories.ts';

test('ibuprofen is a painkiller', () => {
  assert.deepEqual(categoriesForAtc(['M01AE01']), ['pain']);
});

test('a code can give several categories', () => {
  assert.deepEqual(categoriesForAtc(['R01AC01']), ['cold', 'allergy', 'eye_ear_nose']);
  assert.deepEqual(categoriesForAtc(['D08AX08']), ['skin', 'first_aid']);
});

test('several codes join, without repeats, in the list order', () => {
  assert.deepEqual(categoriesForAtc(['J01CA04', 'C09AA05', 'c07ab07']), ['heart', 'antibiotics']);
});

test('codes not in the table give nothing', () => {
  assert.deepEqual(categoriesForAtc(['L01XE01', '', ' ']), []);
});
