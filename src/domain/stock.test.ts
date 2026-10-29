import assert from 'node:assert/strict';
import { test } from 'node:test';

import { packToTake, takeFrom, type StockPack } from './stock.ts';

const pack = (id: string, quantity: number | null, over: Partial<StockPack> = {}): StockPack => ({
  id,
  expires: '2027-01-31',
  quantity,
  openedAt: null,
  ...over,
});

test('packToTake prefers an opened pack, then an unknown date, then the soonest', () => {
  const packs = [pack('late', 10, { expires: '2028-01-31' }), pack('soon', 10), pack('open', 3, { openedAt: 'x', expires: '2029-01-31' })];
  assert.equal(packToTake(packs)?.id, 'open');
  assert.equal(packToTake([pack('late', 10, { expires: '2028-01-31' }), pack('unknown', 5, { expires: null })])?.id, 'unknown');
  assert.equal(packToTake([pack('empty', 0), pack('uncounted', null)]), null);
});

test('takeFrom splits a dose over packs in the order they are used', () => {
  const packs = [pack('soon', 10), pack('open', 1, { openedAt: 'x', expires: '2029-01-31' }), pack('none', null)];
  assert.deepEqual(
    takeFrom(packs, 2).map((p) => [p.pack.id, p.amount]),
    [
      ['open', 1],
      ['soon', 1],
    ],
  );
  assert.deepEqual(takeFrom(packs, 1).map((p) => [p.pack.id, p.amount]), [['open', 1]]);
});

test('takeFrom takes what is left when the dose is more than the stock', () => {
  assert.deepEqual(takeFrom([pack('a', 1)], 3).map((p) => [p.pack.id, p.amount]), [['a', 1]]);
  assert.deepEqual(takeFrom([pack('a', null)], 1), []);
});
