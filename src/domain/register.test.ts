import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  brandOf,
  closeBrands,
  displayName,
  distinctEntries,
  formFromRegister,
  formWord,
  latinToCyrillic,
  matchParts,
  packSizes,
  rankEntries,
  rxFromRegister,
  searchQuery,
  searchText,
  searchTokens,
  shelfLifeMonths,
  singleInn,
  splitResults,
  strengthFromRegister,
} from './register.ts';

test('the form comes from the first words', () => {
  assert.equal(formFromRegister('таблетки, вкриті плівковою оболонкою, по 100 мг'), 'tablets');
  assert.equal(formFromRegister('Капсули тверді, 0,5 мг/0,4 мг'), 'capsules');
  assert.equal(formFromRegister('краплі очні, 0,05 %'), 'drops');
  assert.equal(formFromRegister('гель для зовнішнього застосування 5 %'), 'ointment');
  assert.equal(formFromRegister('спрей назальний'), 'spray');
  assert.equal(formFromRegister('розчин для ін`єкцій'), 'injection');
  assert.equal(formFromRegister('ліофілізат для розчину для ін’єкцій'), 'injection');
  assert.equal(formFromRegister('розчин нашкірний 1 %'), 'solution');
  assert.equal(formFromRegister('суспензія оральна, 100 мг/5 мл'), 'suspension');
  assert.equal(formFromRegister('супозиторії ректальні по 250 мг'), 'suppositories');
  assert.equal(formFromRegister('трава по 50 г у пачках'), 'herbs');
  assert.equal(formFromRegister('газ медичний стиснений'), 'other');
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
  assert.equal(searchQuery('Нуро 200'), '"нуро"* AND "200"*');
  assert.equal(searchQuery('  ібупрофен, '), '"ибупрофен"*');
  assert.equal(searchQuery('"*'), null);
});

test('a word typed in Latin is also searched in Cyrillic', () => {
  assert.equal(latinToCyrillic('nurofen'), 'нурофен');
  assert.equal(latinToCyrillic('paracetamol'), 'парацетамол');
  assert.equal(latinToCyrillic('cetirizin'), 'цетиризин');
  assert.equal(latinToCyrillic('smecta'), 'смекта');
  assert.equal(latinToCyrillic('shpa'), 'шпа');
  assert.equal(latinToCyrillic('200'), null);
  assert.equal(searchQuery('Nurofen 200'), '("nurofen"* OR "нурофен"*) AND "200"*');
});

test('a Latin query marks the Cyrillic name', () => {
  assert.deepEqual(matchParts('Нурофєн форте', 'nuro'), [
    { text: 'Нуро', match: true },
    { text: 'фєн форте', match: false },
  ]);
});

test('a Register name reads as on the box', () => {
  assert.equal(displayName('НУРОФЄН® ДЛЯ ДІТЕЙ'), 'Нурофєн для дітей');
  assert.equal(displayName('L-ТИРОКСИН  100 БЕРЛІН-ХЕМІ'), 'L-тироксин 100 берлін-хемі');
  assert.equal(displayName('ЛІРИКА™'), 'Лірика');
});

test('the form word comes from the start of the form text', () => {
  assert.equal(formWord('суспензія оральна з апельсиновим смаком, 100 мг/5 мл'), 'суспензія');
  assert.equal(formWord('Супозиторії по 60 мг'), 'супозиторії');
  assert.equal(formWord('  '), null);
});

test('makers and flavours of the same medicine are listed once', () => {
  const entry = (name: string, form: 'tablets' | 'other', strength: string, formText: string) => ({
    name,
    form,
    strength,
    formText,
  });
  const list = distinctEntries([
    entry('НУРОФЄН® ДЛЯ ДІТЕЙ', 'other', '100 мг/5 мл', 'суспензія оральна з апельсиновим смаком'),
    entry('НУРОФЄН® ДЛЯ ДІТЕЙ', 'other', '100 мг/5 мл', 'суспензія оральна з полуничним смаком'),
    entry('НУРОФЄН® ДЛЯ ДІТЕЙ', 'other', '60 мг', 'супозиторії по 60 мг'),
    entry('ІБУПРОФЕН', 'tablets', '200 мг', 'таблетки'),
    entry('Ібупрофен', 'tablets', '200 мг', 'таблетки, вкриті оболонкою'),
  ]);
  assert.deepEqual(
    list.map((e) => e.formText),
    ['суспензія оральна з апельсиновим смаком', 'супозиторії по 60 мг', 'таблетки'],
  );
});

test('name matches come first, the rest once per brand', () => {
  const list = splitResults(
    [
      { name: 'ІБУПРОФЕН' },
      { name: 'НУРОФЄН®' },
      { name: 'ІБУПРОФЕН-ДАРНИЦЯ' },
      { name: 'НУРОФЄН® ДЛЯ ДІТЕЙ' },
      { name: 'ДАРФЕН' },
    ],
    'ибупрофен',
  );
  assert.deepEqual(list.named.map((e) => e.name), ['ІБУПРОФЕН', 'ІБУПРОФЕН-ДАРНИЦЯ']);
  assert.deepEqual(list.alsoContain.map((e) => e.name), ['НУРОФЄН®', 'ДАРФЕН']);
  assert.equal(brandOf('НУРОФЄН® ДЛЯ ДІТЕЙ'), 'Нурофєн');
});

test('a misspelt name suggests the brands it is close to', () => {
  const brands = ['Нурофєн', 'Нурофен-хелс', 'Нормобакт', 'Аспірин', 'Ібупром'];
  assert.deepEqual(closeBrands('нуррфен', brands), ['Нурофєн']);
  assert.deepEqual(closeBrands('nurrfen', brands), ['Нурофєн']);
  assert.deepEqual(closeBrands('нуорф', brands), ['Нурофєн']);
  assert.deepEqual(closeBrands('аспирн', brands), ['Аспірин']);
  assert.deepEqual(closeBrands('нур', brands), []);
});

test('several substances have no single international name', () => {
  assert.equal(singleInn('Ibuprofen'), 'Ibuprofen');
  assert.equal(singleInn('Comb drug'), null);
  assert.equal(singleInn('Ibuprofen, combinations'), null);
  assert.equal(singleInn(null), null);
});

test('pack sizes come from the form text', () => {
  assert.deepEqual(
    packSizes(
      'таблетки, вкриті оболонкою, по 200 мг по 6 таблеток у блістері; по 1 блістеру в картонній коробці; ' +
        'по 12 таблеток у блістері; по 1 або 2 блістери в картонній коробці',
      'tablets',
    ),
    [6, 12, 24],
  );
  assert.deepEqual(packSizes('капсули по 325 мг, по 10 капсул у блістері; по 1 або по 2 блістери у коробці', 'capsules'), [10, 20]);
  assert.deepEqual(packSizes('краплі назальні 0,05 % по 10 мл у флаконі; по 1 флакону в коробці', 'drops'), [10]);
  assert.deepEqual(packSizes('гель 5 % по 50 г у тубі; по 1 тубі в пачці', 'ointment'), [50]);
  assert.deepEqual(packSizes('трава по 50 г у пачках', 'tablets'), []);
});

test('the matched start of each word is marked', () => {
  assert.deepEqual(matchParts('Нурофєн форте', 'нурофен'), [
    { text: 'Нурофєн', match: true },
    { text: ' форте', match: false },
  ]);
  assert.deepEqual(matchParts('Нурофєн експрес', 'нуро екс'), [
    { text: 'Нуро', match: true },
    { text: 'фєн ', match: false },
    { text: 'екс', match: true },
    { text: 'прес', match: false },
  ]);
  assert.deepEqual(matchParts('Мальтофер', 'мал'), [
    { text: 'Мал', match: true },
    { text: 'ьтофер', match: false },
  ]);
  assert.deepEqual(matchParts('Аспірин', 'парацетамол'), [{ text: 'Аспірин', match: false }]);
});

test('the web search finds prefixes in any column, the name first', () => {
  const entry = (rowid: number, name: string, inn: string | null, composition: string | null) => ({
    rowid,
    columns: [searchTokens(name), searchTokens(inn), searchTokens(composition)],
  });
  const entries = [
    entry(1, 'МІГ® 400', 'Ibuprofen', 'ібупрофен 400 мг'),
    entry(2, 'НУРОФЄН® ДЛЯ ДІТЕЙ', 'Ibuprofen', 'ібупрофену 100 мг'),
    entry(3, 'НУРОФЄН®', 'Ibuprofen', 'ібупрофену 200 мг'),
    entry(4, 'ПАРАЦЕТАМОЛ', 'Paracetamol', 'парацетамол 500 мг'),
  ];
  assert.deepEqual(rankEntries(entries, 'нурофен'), [3, 2]);
  assert.deepEqual(rankEntries(entries, 'nurofen'), [3, 2]);
  assert.deepEqual(rankEntries(entries, 'нуро 200'), [3]);
  // Only in the composition for all three: the shorter name first.
  assert.deepEqual(rankEntries(entries, 'ібупрофен'), [3, 1, 2]);
  assert.deepEqual(rankEntries(entries, 'аспірин'), []);
  assert.deepEqual(rankEntries(entries, '  '), []);
});
