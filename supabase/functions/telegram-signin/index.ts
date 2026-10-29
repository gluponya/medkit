// Signing in inside Telegram (docs/telegram.md): the mini app is opened with
// the person's Telegram account in its launch data, signed with the bot's
// token, so nothing is asked of them. This checks the signature, finds or makes
// the account that Telegram id is, and hands back a one-time token the app
// turns into a session itself (`verifyOtp`), so the session is GoTrue's own,
// refreshed like any other.
//
// The account's email is made up from the Telegram id and never written to:
// GoTrue keys accounts by email, and a Telegram account has none to give.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withCors } from '../_shared/cors.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const botToken = Deno.env.get('TELEGRAM_APP_BOT_TOKEN');

/** Launch data older than this is not taken: a copied link is not a sign-in. */
const MAX_AGE_S = 24 * 60 * 60;

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * The person in the launch data, or null when it was not signed by this bot or
 * is too old (core.telegram.org/bots/webapps, "Validating data").
 */
async function checked(initData: string, token: string): Promise<TelegramUser | null> {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n');
  const secret = await hmac(encoder.encode('WebAppData'), token);
  if (hex(await hmac(secret, check)) !== hash) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_S) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TelegramUser | null;
    return user && typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

Deno.serve(
  withCors(async (request) => {
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });
    if (!botToken) return new Response('TELEGRAM_APP_BOT_TOKEN is not set', { status: 503 });

    const body = (await request.json().catch(() => ({}))) as { initData?: unknown };
    if (typeof body.initData !== 'string') return new Response('initData is required', { status: 400 });

    const person = await checked(body.initData, botToken);
    if (!person) return new Response('not signed by Telegram', { status: 401 });

    const service = createClient(url, serviceKey);
    const email = `tg${person.id}@telegram.invalid`;
    const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
    const lang = person.language_code === 'uk' ? 'uk' : 'en';

    // Made the first time; after that the call fails as "already registered",
    // which is the account being there.
    const made = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { telegram_id: person.id, telegram_username: person.username ?? null, name, lang },
    });
    if (made.error && made.error.status !== 422) return new Response(made.error.message, { status: 500 });

    const link = await service.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) return new Response(link.error.message, { status: 500 });

    return Response.json({ tokenHash: link.data.properties.hashed_token, name });
  }),
);
