import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bodyTime, factsFor, type SubstanceFacts } from './body-time.ts';

const row = (inn: string, max: number, extra: Partial<SubstanceFacts> = {}): SubstanceFacts => ({
  inn,
  halfLifeHours: { min: max / 2, max },
  alcohol: 'not_mentioned',
  source: 'https://example.org',
  reviewed: true,
  ...extra,
});

const LIST = [
  row('Ibuprofen', 2),
  row('Metronidazole', 8, { alcohol: 'forbidden', alcoholWaitHours: 48, alcoholQuote: 'Не вживати алкоголь.' }),
  row('Diazepam', 48, { metaboliteHalfLifeHours: { min: 40, max: 100 }, alcohol: 'avoid', alcoholQuote: 'Уникати.' }),
  row('Draft', 1, { reviewed: false }),
];

const at = (iso: string) => new Date(iso);

// factsFor
test('finds a row by INN, any case', () => {
  assert.equal(factsFor(['ibuprofen'], LIST)?.inn, 'Ibuprofen');
});

test('skips unreviewed rows and unknown substances', () => {
  assert.equal(factsFor(['Draft'], LIST), null);
  assert.equal(factsFor(['Ibuprofen', 'Unknown'], LIST), null);
  assert.equal(factsFor([], LIST), null);
});

test('several substances take the longest half-life and the strictest alcohol rule', () => {
  const f = factsFor(['Diazepam', 'Metronidazole'], LIST)!;
  assert.equal(f.inn, 'Diazepam');
  assert.equal(f.alcohol, 'forbidden');
  assert.equal(f.alcoholQuote, 'Не вживати алкоголь.');
  assert.equal(f.alcoholWaitHours, 48);
});

// bodyTime
test('no marked doses: only the general time', () => {
  const b = bodyTime(LIST[0], []);
  assert.equal(b.clearHours, 10);
  assert.equal(b.lastDose, null);
  assert.equal(b.goneBy, null);
});

test('gone by is 5 half-lives after the last dose, rounded up to the hour', () => {
  const b = bodyTime(LIST[0], [at('2026-10-29T08:00:00Z'), at('2026-10-28T20:30:00Z')]);
  assert.equal(b.lastDose?.toISOString(), '2026-10-29T08:00:00.000Z');
  assert.equal(b.goneBy?.toISOString(), '2026-10-29T18:00:00.000Z');
  assert.equal(bodyTime(LIST[0], [at('2026-10-29T08:20:00Z')]).goneBy?.toISOString(), '2026-10-29T19:00:00.000Z');
});

test('a metabolite that stays longer sets the time', () => {
  assert.equal(bodyTime(LIST[2], []).clearHours, 500);
});

test('alcohol waits for the later of gone by and the named wait', () => {
  const b = bodyTime(LIST[1], [at('2026-10-29T08:00:00Z')]);
  assert.equal(b.goneBy?.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(b.alcoholFrom?.toISOString(), '2026-10-31T08:00:00.000Z');
  assert.equal(bodyTime(LIST[0], [at('2026-10-29T08:00:00Z')]).alcoholFrom, null);
});

test('builds up when a course doses closer than the half-life', () => {
  const course = ['2026-10-27T08:00Z', '2026-10-27T20:00Z', '2026-10-28T08:00Z', '2026-10-28T20:00Z'].map(at);
  assert.equal(bodyTime(LIST[2], course).buildsUp, true);
  assert.equal(bodyTime(LIST[0], course).buildsUp, false);
  assert.equal(bodyTime(LIST[2], course.slice(0, 2)).buildsUp, false);
});
