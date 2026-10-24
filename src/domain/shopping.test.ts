import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addReminderAt, missing, shoppingList, type ShopItem, type ShopMedicine, type ShopPack } from './shopping.ts';

const TODAY = '2026-10-24';

const med = (id: string, over: Partial<ShopMedicine> = {}): ShopMedicine => ({
  id,
  cabinetId: 'home',
  name: id,
  form: 'tablets',
  rx: false,
  lowStockThreshold: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const pack = (medicineId: string, over: Partial<ShopPack> = {}): ShopPack => ({
  medicineId,
  expires: '2027-03-31',
  quantity: 20,
  status: 'active',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...over,
});

const item = (id: string, over: Partial<ShopItem> = {}): ShopItem => ({
  id,
  cabinetId: 'home',
  medicineId: null,
  name: id,
  boughtAt: null,
  dismissedAt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  ...over,
});

test('missing tells expired, used up and low stock apart', () => {
  const low = { lowStockThreshold: 5 };
  assert.deepEqual(missing(low, [pack('a', { quantity: 4 })], TODAY), { reason: 'low', stock: 4 });
  assert.equal(missing(low, [pack('a', { quantity: 6 })], TODAY), null);
  assert.deepEqual(missing(low, [pack('a', { expires: '2026-10-23' })], TODAY), { reason: 'expired', stock: null });
  assert.deepEqual(missing(low, [pack('a', { status: 'used_up', quantity: 0 })], TODAY), { reason: 'out', stock: 0 });
  assert.equal(missing(low, [pack('a', { status: 'disposed' })], TODAY), null);
  assert.equal(missing(low, [], TODAY), null);
});

test('an expired pack next to a good one is not a reason to buy', () => {
  const packs = [pack('a', { expires: '2026-09-30' }), pack('a')];
  assert.equal(missing({ lowStockThreshold: null }, packs, TODAY), null);
});

test('expired packs do not count towards the stock', () => {
  const packs = [pack('a', { expires: '2026-09-30', quantity: 30 }), pack('a', { quantity: 3 })];
  assert.deepEqual(missing({ lowStockThreshold: 5 }, packs, TODAY), { reason: 'low', stock: 3 });
});

test('uncounted packs never read as low', () => {
  assert.equal(missing({ lowStockThreshold: 5 }, [pack('a', { quantity: null })], TODAY), null);
});

test('the list orders by reason and splits off what was bought', () => {
  const medicines = [
    med('Називін'),
    med('Сорбіфер', { lowStockThreshold: 10 }),
    med('Нурофен', { lowStockThreshold: 10 }),
    med('Аспірин'),
  ];
  const packs = [
    pack('Називін', { expires: '2026-08-31' }),
    pack('Сорбіфер', { quantity: 4 }),
    pack('Нурофен', { quantity: 2 }),
    pack('Аспірин'),
  ];
  const items = [item('Пластир'), item('n', { medicineId: 'Нурофен', name: 'Нурофен', boughtAt: '2026-10-23T09:00:00.000Z' })];
  const list = shoppingList(medicines, packs, items, TODAY);
  assert.deepEqual(
    list.toBuy.map((l) => [l.name, l.reason]),
    [
      ['Сорбіфер', 'low'],
      ['Називін', 'expired'],
      ['Пластир', 'manual'],
    ],
  );
  assert.deepEqual(
    list.bought.map((l) => [l.name, l.itemId]),
    [['Нурофен', 'n']],
  );
  assert.deepEqual(list.done, []);
});

test('«Купити нову» keeps a medicine with good stock on the list', () => {
  const list = shoppingList([med('a')], [pack('a')], [item('i', { medicineId: 'a', name: 'a' })], TODAY);
  assert.deepEqual(
    list.toBuy.map((l) => [l.name, l.reason, l.itemId]),
    [['a', 'manual', 'i']],
  );
});

test('a line is done once its pack or medicine arrives, however long it waits', () => {
  const medicines = [med('a'), med('Пластир', { createdAt: '2026-10-22T00:00:00.000Z' })];
  const packs = [pack('a', { createdAt: '2026-10-21T00:00:00.000Z' })];
  const items = [
    item('linked', { medicineId: 'a', name: 'a', boughtAt: '2026-10-20T00:00:00.000Z' }),
    item('byHand', { name: ' пластир' }),
    item('old', { boughtAt: '2026-10-01T00:00:00.000Z' }),
    item('fresh', { boughtAt: '2026-10-11T00:00:00.000Z' }),
  ];
  const list = shoppingList(medicines, packs, items, TODAY);
  assert.deepEqual(list.done, ['linked', 'byHand']);
  assert.deepEqual(
    list.bought.map((l) => l.key),
    ['fresh', 'old'],
  );
});

test('× keeps a medicine off the list until a new pack arrives', () => {
  const medicines = [med('a')];
  const expired = [pack('a', { expires: '2026-08-31' })];
  const off = item('x', { medicineId: 'a', name: 'a', dismissedAt: '2026-10-23T09:00:00.000Z', createdAt: '2026-10-23T09:00:00.000Z' });
  assert.deepEqual(shoppingList(medicines, expired, [off], TODAY).toBuy, []);
  const renewed = [...expired, pack('a', { createdAt: '2026-10-24T08:00:00.000Z' })];
  assert.deepEqual(shoppingList(medicines, renewed, [off], TODAY).done, ['x']);
});

test('a ticked line is recalled later the same day, or the next morning', () => {
  assert.deepEqual(addReminderAt(new Date(2026, 9, 24, 13, 30)), new Date(2026, 9, 24, 15, 30));
  assert.deepEqual(addReminderAt(new Date(2026, 9, 24, 20, 0)), new Date(2026, 9, 25, 10, 0));
  assert.deepEqual(addReminderAt(new Date(2026, 9, 24, 1, 0)), new Date(2026, 9, 24, 10, 0));
});
