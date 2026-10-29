// What is printed on a medicine box: the name side or the flap with the expiry
// (docs/model.md, "A photo of the box"). A model reads the photo and answers
// as JSON in the shape of ./prompt.ts; this function passes the answer on
// without trusting it, and the phone uses it only as a query for the Register.
//
// Signed in only (the anonymous session is enough) — a function anyone may
// call is an open tap on the model's key — and thirty a day per person,
// counted in box_photo_days. The photos are not kept: they go to the model
// and nowhere else. As Freshka's recognise-photo.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withCors } from '../_shared/cors.ts';
import { BOX_PROMPTS, type BoxSide } from './prompt.ts';

const DAILY_LIMIT = 30;
/** A camera shot is a few hundred kilobytes; a phone's own photo can be several megabytes. */
const MAX_PHOTO_CHARS = 9_000_000;

/**
 * The model Freshka chose on fifty photos of Ukrainian packs
 * (its docs/add-flow.md §3.3). Medicine boxes have smaller print and a pressed
 * expiry; tools/box-check.mjs is how a change of model gets checked here.
 */
const MODEL = 'qwen/qwen3.8-flash';
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
// The function's secrets in production; without it the function answers, and says so.
const apiKey = Deno.env.get('OPENROUTER_API_KEY');

/** A photo's own type, from its first bytes: a screenshot from the gallery is often a PNG. */
function mediaType(base64: string): string {
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

type ModelAnswer = { ok: true; answer: unknown } | { ok: false; status: number; message: string };

async function askModel(photo: string, side: BoxSide, key: string): Promise<ModelAnswer> {
  let reply: Response;
  try {
    reply = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        // Qwen thinks unless told not to, and reading a box does not need it.
        reasoning: { enabled: false },
        // Never an endpoint that may train on a photo of someone's medicines.
        provider: { data_collection: 'deny' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mediaType(photo)};base64,${photo}` } },
              { type: 'text', text: BOX_PROMPTS[side] },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return { ok: false, status: 502, message: 'the model could not be reached' };
  }

  if (reply.status === 429) return { ok: false, status: 503, message: 'the model is busy' };
  if (!reply.ok) {
    return { ok: false, status: 502, message: `the model failed: ${reply.status} ${(await reply.text()).slice(0, 300)}` };
  }

  const body = (await reply.json().catch(() => null)) as {
    choices?: { finish_reason?: string | null; message?: { content?: unknown } }[];
  } | null;
  const choice = body?.choices?.[0];
  if (choice?.finish_reason && choice.finish_reason !== 'stop') {
    return { ok: false, status: 502, message: `the model stopped: ${choice.finish_reason}` };
  }
  const text = choice?.message?.content;
  if (typeof text !== 'string') return { ok: false, status: 502, message: 'the model answered nothing' };

  try {
    // A model asked for bare JSON still sometimes fences it.
    const bare = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return { ok: true, answer: JSON.parse(bare) };
  } catch {
    return { ok: false, status: 502, message: 'the model answered not in JSON' };
  }
}

// withCors: the Telegram mini app is a page (docs/telegram.md).
Deno.serve(withCors(async (request) => {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  });
  const { data } = await caller.auth.getUser();
  const user = data.user;
  if (!user) return new Response('sign in first', { status: 401 });
  if (!apiKey) return new Response('OPENROUTER_API_KEY is not set', { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { photo?: unknown; side?: unknown };
  const side = body.side === 'flap' ? 'flap' : body.side === 'front' ? 'front' : null;
  if (!side) return new Response('side is "front" or "flap"', { status: 400 });
  if (typeof body.photo !== 'string' || body.photo.length === 0) return new Response('one photo is required', { status: 400 });
  if (body.photo.length > MAX_PHOTO_CHARS) return new Response('photo is too large', { status: 413 });

  // Counted before the call, so a call that fails still counts until it is
  // given back: one step in the database, so requests sent at once cannot all
  // read the same count (migration 20261026120000_box_photos.sql).
  const service = createClient(url, serviceKey);
  const taken = await service.rpc('take_box_photo', { p_user: user.id, p_limit: DAILY_LIMIT });
  if (taken.error) return new Response(taken.error.message, { status: 500 });
  if (taken.data !== true) return new Response('enough for today', { status: 429 });

  const reply = await askModel(body.photo, side, apiKey);
  if (!reply.ok) {
    await service.rpc('give_back_box_photo', { p_user: user.id });
    return new Response(reply.message, { status: reply.status });
  }
  return Response.json({ answer: reply.answer });
}));
