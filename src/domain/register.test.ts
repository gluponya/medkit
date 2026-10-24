import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  formFromRegister,
  rxFromRegister,
  searchQuery,
  searchText,
  shelfLifeMonths,
  strengthFromRegister,
} from './register.ts';

test('the form comes from the first words', () => {
  assert.equal(formFromRegister('таблетки, вкриті плівковою оболонкою, по 100 мг'), 'tablets');
  assert.equal(formFromRegister('Капсули тверді, 0,5 мг/0,4 мг'), 'capsules');
  assert.equal(formFromRegister('краплі очні, 0,05 %'), 'drops');
  assert.equal(formFromRegister('гель для зовнішнього застосування 5 %'), 'ointment');
  assert.equal(formFromRegister('спрей назальний'), 'spray');
  assert.equal(formFromRegister('розчин для ін`єкцій'), 'other');
});

test('the strength is taken as printed', () => {
  assert.equal(strengthFromRegister('таблетки по 200 мг, по 10 таблеток у блістері'), '200 мг');
  assert.equal(strengthFromRegister('капсули тверді, 0,5 мг/0,4 мг; по 30 капсул'), '0,5 мг/0,4 мг');
  assert.equal(strengthFromRegister('сироп, 100 мг/5 мл по 100 мл у флаконі'), '100 мг/5 мл');
  assert.equal(strengthFromRegister('трава по 50 г у пачках'), '50 г');
  assert.equal(strengthFromRegister('краплі оральні, 10 000 МО/мл по 10 мл'), '10 000 МО/мл');
  assert.equal(strengthFromRegister('таблетки; по 10 таблеток у блістері'), null);
});

test('Rx only when no pack goes without a prescription', () => {
  assert.equal(rxFromRegister('за рецептом'), true);
  assert.equal(rxFromRegister('без рецепта'), false);
  assert.equal(rxFromRegister('за рецептом: № 100/без рецепта: № 10'), false);
  assert.equal(rxFromRegister(''), false);
});

test('shelf life in months', () => {
  assert.equal(shelfLifeMonths('3', 'рік'), 36);
  assert.equal(shelfLifeMonths('36', 'місяць'), 36);
  assert.equal(shelfLifeMonths('1,5', 'рік '), 18);
  assert.equal(shelfLifeMonths('5', 'день'), null);
  assert.equal(shelfLifeMonths('', ''), null);
});

test('letters typed either way search the same', () => {
  assert.equal(searchText('НУРОФЄН'), searchText('нурофен'));
  assert.equal(searchText('Ібупрофен'), searchText('ибупрофен'));
  assert.equal(searchText("Ін'єкції Ґ"), "ин'екции г");
});

test('a typed query becomes prefixes that all have to match', () => {
  assert.equal(searchQuery('Нуро 200'), '"нуро"* "200"*');
  assert.equal(searchQuery('  ібупрофен, '), '"ибупрофен"*');
  assert.equal(searchQuery('"*'), null);
});
