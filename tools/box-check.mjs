// What recognise-box reads off photos of real boxes, for checking the prompt
// or a change of model (supabase/functions/recognise-box). A file whose name
// has «flap» in it is sent as the flap, any other as the front.
//
//   node --no-warnings --env-file=.env.local tools/box-check.mjs <photo or folder>...
//
// Each run signs in as a new anonymous person, so the daily limit is theirs.
// The server's address and key are never printed.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(url && key, 'no server in .env.local');
assert.ok(process.argv.length > 2, 'give photos or folders of them');

const photos = process.argv
  .slice(2)
  .flatMap((path) =>
    statSync(path).isDirectory()
      ? readdirSync(path)
          .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
          .map((name) => join(path, name))
      : [path],
  );

const remote = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error } = await remote.auth.signInAnonymously();
if (error) throw error;

for (const path of photos) {
  const side = /flap/i.test(basename(path)) ? 'flap' : 'front';
  const started = Date.now();
  const { data, error: failed } = await remote.functions.invoke('recognise-box', {
    body: { side, photo: readFileSync(path).toString('base64') },
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed) {
    const why = failed.context instanceof Response ? await failed.context.text() : failed.message;
    console.log(`${basename(path)} (${side}, ${seconds} s): failed, ${why}`);
  } else {
    console.log(`${basename(path)} (${side}, ${seconds} s):`, JSON.stringify(data.answer, null, 2));
  }
}
