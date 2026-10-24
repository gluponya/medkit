import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breaksWord } from './text.ts';

test('a word broken letter by letter is caught', () => {
  assert.equal(breaksWord([{ text: 'Атенолол-Астрафар' }, { text: 'м' }]), true);
});

test('breaks at a space or after a hyphen are fine', () => {
  assert.equal(breaksWord([{ text: 'Нурофен ' }, { text: 'для дітей' }]), false);
  assert.equal(breaksWord([{ text: 'Атенолол-' }, { text: 'Астрафарм' }]), false);
  assert.equal(breaksWord([{ text: 'Як приймати' }, { text: '' }]), false);
});

test('one line never breaks a word', () => {
  assert.equal(breaksWord([{ text: 'Лірика' }]), false);
});
