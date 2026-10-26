import assert from 'node:assert/strict';
import { test } from 'node:test';

import { leafletHtml } from './leaflet.ts';

const mht = (html: string, encoding = 'quoted-printable', charset = 'us-ascii') =>
  [
    'MIME-Version: 1.0',
    'Content-Type: multipart/related; boundary="----=_NextPart_01"',
    '',
    'Archive preamble',
    '',
    '------=_NextPart_01',
    'Content-Location: file:///C:/X/UA1.htm',
    `Content-Transfer-Encoding: ${encoding}`,
    `Content-Type: text/html; charset="${charset}"`,
    '',
    html,
    '',
    '------=_NextPart_01',
    'Content-Location: file:///C:/X/UA1.files/image001.png',
    'Content-Transfer-Encoding: base64',
    'Content-Type: image/png',
    '',
    'iVBORw0K',
    '------=_NextPart_01--',
  ].join('\r\n');

test('the page comes out of a quoted-printable archive, with a phone viewport', () => {
  const html = leafletHtml(mht('<html><head></head><body><p class=3D"x">&#1053;=\r\n&#1091;</p></body></html>'));
  assert.ok(html?.includes('<p class="x">&#1053;&#1091;</p>'));
  assert.ok(html?.includes('width=device-width'));
});

test('pictures are inlined', () => {
  const html = leafletHtml(mht('<img src=3D"UA1.files/image001.png">'));
  assert.ok(html?.includes('src="data:image/png;base64,iVBORw0K"'));
});

test('a Windows-1251 page is read as Cyrillic', () => {
  const html = leafletHtml(mht('=CD=F3=F0=EE=F4=E5=ED', 'quoted-printable', 'windows-1251'));
  assert.ok(html?.includes('</style>Нурофен'));
});

test('a base64 page, and nothing without a page', () => {
  assert.ok(leafletHtml(mht(Buffer.from('<b>Hi</b>').toString('base64'), 'base64'))?.includes('<b>Hi</b>'));
  assert.equal(leafletHtml('just text'), null);
});
