import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evidenceNote, HOMEOPATHY, isHomeopathic, type EvidenceNote } from './evidence.ts';

const product = (composition: string, atc: string[] = [], formText = 'таблетки') => ({
  name: 'ПРЕПАРАТ',
  inn: 'Comb drug',
  composition,
  formText,
  atc,
});

// isHomeopathic
test('finds potencies in the composition', () => {
  assert.equal(isHomeopathic(product('Gentiana D1 1 мл, Aconitum D6 10 мл')), true);
  assert.equal(isHomeopathic(product('Anas barbariae, hepatis et cordis extractum 200К–0,01 мл')), true);
  assert.equal(isHomeopathic(product('Conium 1000CH 20 мг, Sabal serrulatum 50CH 20 мг')), true);
  assert.equal(isHomeopathic(product('антитіла до гамма інтерферону: суміш гомеопатичних розведень С12, С30 та С200')), true);
});

test('finds the word in the form', () => {
  assert.equal(isHomeopathic(product('Agropyron', [], 'гранули гомеопатичні по 20 г у флаконі')), true);
});

test('leaves out products with an ATC code', () => {
  assert.equal(isHomeopathic(product('холекальциферолу (вітаміну D3) 15 000 МО', ['A11CC05'])), false);
});

test('leaves out plain herbs', () => {
  assert.equal(isHomeopathic(product('Cardiospermum 0,1 г')), false);
});

// evidenceNote
const notes: EvidenceNote[] = [
  { key: HOMEOPATHY, source: 'https://h', sourceName: 'H', reviewed: true },
  { key: 'Tilorone', source: 'https://t', sourceName: 'T', reviewed: true },
  { key: 'Umifenovir', source: 'https://u', sourceName: 'U', reviewed: false },
  { key: 'Cerebrolysin', names: ['ЦЕРЕБРОЛІЗИН'], source: 'https://c', sourceName: 'C', reviewed: true },
];

test('matches by INN, in any case', () => {
  assert.equal(evidenceNote({ name: 'X', inn: 'tilorone', composition: null, formText: '', atc: ['J05AX19'] }, notes)?.source, 'https://t');
});

test('skips unreviewed rows', () => {
  assert.equal(evidenceNote({ name: 'X', inn: 'Umifenovir', composition: null, formText: '', atc: ['J05AX13'] }, notes), null);
});

test('marks homeopathy', () => {
  assert.equal(evidenceNote(product('Aconitum D6'), notes)?.key, HOMEOPATHY);
});

test('marks nothing else', () => {
  assert.equal(evidenceNote({ name: 'X', inn: 'Ibuprofen', composition: 'ібупрофену 200 мг', formText: 'таблетки', atc: ['M01AE01'] }, notes), null);
});

test('matches a product with no INN by its trade name', () => {
  assert.equal(evidenceNote({ name: 'ЦЕРЕБРОЛІЗИН®', inn: 'Mono', composition: null, formText: '', atc: ['N06BX'] }, notes)?.key, 'Cerebrolysin');
});
