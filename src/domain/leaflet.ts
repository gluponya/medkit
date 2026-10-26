/**
 * The Register keeps most instructions as `.mht`: a Word page saved as one
 * MIME archive. No phone browser opens it, so the app takes the page out of
 * it and shows that. Pure, so it is tested without the network; the archive
 * comes in as a byte string (one char per byte).
 */

interface Part {
  headers: Map<string, string>;
  body: string;
}

function parts(raw: string): Part[] {
  const boundary = /boundary="?([^";\r\n]+)"?/i.exec(raw)?.[1];
  if (!boundary) return [];
  return raw
    .split(`--${boundary}`)
    .slice(1)
    .map((chunk) => {
      const split = /\r?\n\r?\n/.exec(chunk);
      const head = split ? chunk.slice(0, split.index) : chunk;
      const headers = new Map<string, string>();
      for (const line of head.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
        const colon = line.indexOf(':');
        if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
      }
      return { headers, body: split ? chunk.slice(split.index + split[0].length) : '' };
    })
    .filter((p) => p.headers.has('content-type'));
}

/** Quoted-printable → bytes. */
function unquote(body: string): string {
  return body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/** Windows-1251 above 0x7F; enough for Ukrainian and Russian pages. */
const CP1251_HIGH =
  'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї' +
  'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';

function decodeText(bytes: string, charset: string): string {
  const cs = charset.toLowerCase();
  if (cs === 'windows-1251' || cs === 'cp1251') {
    return bytes.replace(/[\x80-\xff]/g, (c) => CP1251_HIGH[c.charCodeAt(0) - 0x80]);
  }
  if (cs === 'utf-8') {
    try {
      return decodeURIComponent(bytes.replace(/[\x80-\xff%]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')));
    } catch {
      return bytes;
    }
  }
  return bytes;
}

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function unbase64(body: string): string {
  const clean = body.replace(/[^A-Za-z0-9+/]/g, '');
  let out = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => base64Chars.indexOf(clean[i + k] ?? 'A'));
    const bits = (n[0] << 18) | (n[1] << 12) | (n[2] << 6) | n[3];
    out += String.fromCharCode((bits >> 16) & 255);
    if (i + 2 < clean.length) out += String.fromCharCode((bits >> 8) & 255);
    if (i + 3 < clean.length) out += String.fromCharCode(bits & 255);
  }
  return out;
}

/** Word's widths, margins and point sizes fit an A4 page, not a phone: they are reset. */
const PHONE_CSS = `
html, body { margin: 0 !important; padding: 0 !important; }
body { padding: 16px !important; background: #FFFFFF; color: #2F3A4F; font-family: -apple-system, system-ui, sans-serif !important; font-size: 17px; line-height: 1.45; overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }
* { max-width: 100% !important; box-sizing: border-box; }
div, p, li { width: auto !important; margin-left: 0 !important; margin-right: 0 !important; text-indent: 0 !important; }
p, span, li, td, th, font, b, i, u, a, h1, h2, h3 { color: inherit !important; font-family: inherit !important; font-size: inherit !important; line-height: inherit !important; }
p { margin-top: 0 !important; margin-bottom: 10px !important; text-align: left !important; }
table { width: 100% !important; border-collapse: collapse; margin: 8px 0 14px; }
td, th { width: auto !important; padding: 6px !important; border: 1px solid #DCE3F2 !important; vertical-align: top; font-size: 15px !important; }
img { height: auto !important; }
`;

/**
 * The page inside an `.mht`, ready for a WebView: its pictures inlined, a
 * phone viewport and readable type. Null when there is no page in it.
 */
export function leafletHtml(raw: string): string | null {
  const all = parts(raw);
  const page = all.find((p) => /^text\/html/i.test(p.headers.get('content-type') ?? ''));
  if (!page) return null;

  const decode = (p: Part) => {
    const encoding = (p.headers.get('content-transfer-encoding') ?? '').toLowerCase();
    return encoding === 'quoted-printable' ? unquote(p.body) : encoding === 'base64' ? unbase64(p.body) : p.body;
  };
  const declared = /charset="?([\w-]+)/i.exec(page.headers.get('content-type') ?? '')?.[1] ?? 'us-ascii';
  let html = decode(page);
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(html)?.[1];
  html = decodeText(html, declared === 'us-ascii' && meta ? meta : declared);

  for (const p of all) {
    const type = p.headers.get('content-type')?.split(';')[0] ?? '';
    const location = p.headers.get('content-location');
    if (!type.startsWith('image/') || !location) continue;
    const name = location.split('/').slice(-2).join('/');
    const data = `data:${type};base64,${p.body.replace(/\s+/g, '')}`;
    if ((p.headers.get('content-transfer-encoding') ?? '').toLowerCase() !== 'base64') continue;
    html = html.split(`"${name}"`).join(`"${data}"`);
  }

  const head = `<meta name="viewport" content="width=device-width, initial-scale=1"><style>${PHONE_CSS}</style>`;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${head}</head>`) : head + html;
}
