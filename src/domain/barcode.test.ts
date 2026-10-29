import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OPEN_GATE, SCAN_QUIET_MS, asEan13, checkDigitOk, passScan, readScan } from './barcode.ts';

const GS = '\u001d';

test('an EAN-13 with a right check digit is a code, one digit off is not', () => {
  assert.equal(checkDigitOk('4006381333931'), true);
  assert.deepEqual(readScan('4006381333931'), { gtin: '4006381333931', expires: null });
  assert.equal(readScan('4006381333932'), null);
});

test('a DataMatrix gives the EAN-13 and the expiry, whatever order its fields are in', () => {
  const pack = { gtin: '4006381333931', expires: { year: 2028, month: 8 } };
  assert.deepEqual(readScan(`${GS}010400638133393117280831` + `10AB12${GS}21XYZ987`), pack);
  assert.deepEqual(readScan(`]d2010400638133393121XYZ987${GS}1728083110AB12`), pack);
  // A batch first, then the fixed fields; day 00 is the end of the month.
  assert.deepEqual(readScan(`10AB12${GS}010400638133393117280800`), pack);
});

test('a GTIN-14 from any packaging level is the EAN-13 of the box', () => {
  assert.equal(asEan13('18901463153304'), '8901463153307');
  assert.equal(checkDigitOk('8901463153307'), true);
  assert.deepEqual(readScan('0118901463153304'), { gtin: '8901463153307', expires: null });
});

test('a DataMatrix with no expiry still gives the code', () => {
  assert.deepEqual(readScan('0104006381333931'), { gtin: '4006381333931', expires: null });
});

test('a bad month is no expiry, a bad GTIN is no code', () => {
  assert.deepEqual(readScan('010400638133393117281331'), { gtin: '4006381333931', expires: null });
  assert.equal(readScan('010400638133393217280831'), null);
});

test('anything else is no code', () => {
  assert.equal(readScan('https://example.com'), null);
  assert.equal(readScan('21XYZ'), null);
  assert.equal(readScan('12345'), null);
});

test('a code held in view is one scan, shown again after a pause it is another', () => {
  let { accept, gate } = passScan(OPEN_GATE, 'a', 0);
  assert.equal(accept, true);
  ({ accept, gate } = passScan(gate, 'a', 1000));
  assert.equal(accept, false);
  ({ accept, gate } = passScan(gate, 'a', 1000 + SCAN_QUIET_MS + 1));
  assert.equal(accept, true);
  ({ accept } = passScan(gate, 'b', 1000 + SCAN_QUIET_MS + 2));
  assert.equal(accept, true);
});
