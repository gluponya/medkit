// Exports every top-level frame of the Figma file as a PNG into design/figma/,
// through the Figma REST API (the Figma app is never started).
//
//   node --env-file=.env.local tools/figma-export.mjs [scale]
//
// Needs FIGMA_TOKEN and FIGMA_FILE_KEY in .env.local. The token is never printed.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const token = process.env.FIGMA_TOKEN;
const fileKey = process.env.FIGMA_FILE_KEY;
const scale = Number(process.argv[2] ?? 1);
const outDir = path.resolve('design/figma');
const BATCH = 20;

if (!token || !fileKey) {
  console.error('FIGMA_TOKEN or FIGMA_FILE_KEY is empty in .env.local');
  process.exit(1);
}

async function api(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'X-Figma-Token': token } });
    if (res.status === 429 && attempt < 5) {
      const wait = Number(res.headers.get('retry-after') ?? 30);
      console.log(`rate limited, waiting ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${new URL(url).pathname}`);
    return res;
  }
}

const slug = (s) =>
  s.trim().replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'untitled';

// Frames sitting on a page, and frames inside sections on it.
function collectFrames(node, page, out) {
  for (const child of node.children ?? []) {
    if (child.visible === false) continue;
    if (child.type === 'SECTION') collectFrames(child, page, out);
    else if (['FRAME', 'COMPONENT', 'COMPONENT_SET'].includes(child.type)) {
      const box = child.absoluteBoundingBox ?? {};
      out.push({ id: child.id, page, name: child.name, width: box.width, height: box.height });
    }
  }
}

const file = await (await api(`https://api.figma.com/v1/files/${fileKey}?depth=3`)).json();
const frames = [];
for (const page of file.document.children) collectFrames(page, page.name, frames);
console.log(`"${file.name}": ${file.document.children.length} pages, ${frames.length} frames`);

await mkdir(outDir, { recursive: true });
const used = new Set();
for (const [i, f] of frames.entries()) {
  let base = `${String(i + 1).padStart(3, '0')} ${slug(f.page)} - ${slug(f.name)}`;
  while (used.has(base)) base += '_';
  used.add(base);
  f.file = `${base}.png`;
}

for (let i = 0; i < frames.length; i += BATCH) {
  const batch = frames.slice(i, i + BATCH);
  const ids = batch.map((f) => f.id).join(',');
  const { images, err } = await (
    await api(`https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=${scale}`)
  ).json();
  if (err) throw new Error(err);
  await Promise.all(
    batch.map(async (f) => {
      if (!images[f.id]) return console.warn(`no image for ${f.file}`);
      const png = Buffer.from(await (await fetch(images[f.id])).arrayBuffer());
      await writeFile(path.join(outDir, f.file), png);
    }),
  );
  console.log(`${Math.min(i + BATCH, frames.length)}/${frames.length}`);
}

await writeFile(
  path.join(outDir, 'index.json'),
  JSON.stringify({ name: file.name, lastModified: file.lastModified, frames }, null, 2),
);
console.log(`done: ${outDir}`);
