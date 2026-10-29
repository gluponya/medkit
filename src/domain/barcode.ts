/**
 * The codes on a medicine's pack (docs/model.md, "Barcodes"): an EAN-13, or a
 * GS1 DataMatrix that holds the same number as a GTIN-14 and, on most packs,
 * the expiry. Pure: the camera hands the text in, the lookup lives in
 * src/data/barcodes.ts.
 */

export type Scan = {
  /** A DataMatrix's GTIN-14 as an EAN-13, so a pack's two codes are one key (see `asEan13`). */
  gtin: string;
  /** From a DataMatrix; an EAN-13 has none. */
  expires: { year: number; month: number } | null;
};

/**
 * A GTIN's check digit is right. A camera reading a crumpled pack now and then
 * returns a code one digit off; this stops it being looked up as another one.
 */
export function checkDigitOk(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  return checkDigit(code.slice(0, -1)) === Number(code.slice(-1));
}

/** The check digit for these digits; weights 3 and 1 alternate from the right, whatever the length. */
function checkDigit(body: string): number {
  const sum = [...body].reverse().reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * A DataMatrix's GTIN-14 as the EAN-13 printed on the same box: the first
 * digit (the packaging level) dropped and the check digit made again. Makers
 * put 1 there as often as 0 (a Pantamak box, 2026-10-29: «1 890146315330 4»
 * in the DataMatrix, «890146315330 7» in the barcode), and a person holds one
 * medicine either way.
 */
export function asEan13(gtin14: string): string {
  const body = gtin14.slice(1, 13);
  return body + checkDigit(body);
}

/** The group separator that ends a variable-length field in a GS1 code. */
const GS = '\u001d';

/**
 * The fields of fixed length, by the first two digits of their identifier:
 * how long the identifier and its value are together. Any other field runs to
 * the next separator or the end.
 */
const FIXED: Record<string, number> = {
  '00': 20,
  '01': 16,
  '02': 16,
  '03': 16,
  '04': 18,
  '11': 8,
  '12': 8,
  '13': 8,
  '14': 8,
  '15': 8,
  '16': 8,
  '17': 8,
  '18': 8,
  '19': 8,
  '20': 4,
  '31': 10,
  '32': 10,
  '33': 10,
  '34': 10,
  '35': 10,
  '36': 10,
  '41': 16,
};

/** A GS1 DataMatrix's GTIN (01) and expiry (17, YYMMDD); null when it has no GTIN. */
function readGs1(text: string): Scan | null {
  // Some readers keep the symbology mark or the leading FNC1 the code starts with.
  let rest = text.replace(/^\]d2/, '').replace(/^\u001d+/, '');
  let gtin: string | null = null;
  let expires: Scan['expires'] = null;
  while (rest.length > 0) {
    const ai = rest.slice(0, 2);
    const fixed = FIXED[ai];
    let value: string;
    if (fixed) {
      value = rest.slice(2, fixed);
      if (value.length < fixed - 2) return null;
      rest = rest.slice(fixed);
      // A field of fixed length may still be followed by a separator.
      if (rest.startsWith(GS)) rest = rest.slice(1);
    } else {
      const end = rest.indexOf(GS);
      value = end < 0 ? rest : rest.slice(0, end);
      rest = end < 0 ? '' : rest.slice(end + 1);
    }
    if (ai === '01') {
      if (!checkDigitOk(value)) return null;
      gtin = value;
    } else if (ai === '17') {
      const year = 2000 + Number(value.slice(0, 2));
      const month = Number(value.slice(2, 4));
      if (/^\d{6}$/.test(value) && month >= 1 && month <= 12) expires = { year, month };
    }
  }
  if (!gtin) return null;
  return { gtin: gtin.length === 14 ? asEan13(gtin) : gtin, expires };
}

/**
 * What the camera read, as a pack's code; null for anything else (a QR code
 * of a web page, a DataMatrix with no GTIN, a misread EAN).
 */
export function readScan(data: string): Scan | null {
  const text = data.trim();
  if (/^\d{13}$/.test(text)) return checkDigitOk(text) ? { gtin: text, expires: null } : null;
  return readGs1(text);
}

/**
 * How long a code must be out of view before seeing it again means a second
 * one. The camera reports the same code many times a second while it is held
 * there; in «Кілька поспіль» two packs of the same medicine are two.
 */
export const SCAN_QUIET_MS = 1500;

export type ScanGate = { code: string | null; seenAt: number };

export const OPEN_GATE: ScanGate = { code: null, seenAt: 0 };

/**
 * Whether this read is a new scan. Every read of the code in view moves
 * `seenAt` on, so a pack held in front of the camera is still one scan: the
 * quiet period counts from the last time it was seen (as in Freshka).
 */
export function passScan(gate: ScanGate, code: string, now: number): { accept: boolean; gate: ScanGate } {
  const accept = code !== gate.code || now - gate.seenAt > SCAN_QUIET_MS;
  return { accept, gate: { code, seenAt: now } };
}
