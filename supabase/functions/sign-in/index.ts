// Signing in on the phone (docs/model.md, "Signing in"): with Telegram, so it
// is the same account as the Telegram mini app, or with Apple. The phone's
// anonymous user, when it calls with one, goes into the account first
// (`merge_account`), so its cabinets stay with the person; then the account's
// session is handed back.
//
// Telegram on a phone is its Login Widget: a GET here sends the browser to
// Telegram, Telegram back to the app's page on the Worker
// (public/telegram-login.html), and the page to the app with the signed
// result, which the app posts here. The mini app's own launch data is checked
// by telegram-signin; this is the widget's, signed differently.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const botToken = Deno.env.get('TELEGRAM_APP_BOT_TOKEN');
/** The Worker the bot's domain is set to (/setdomain in @BotFather). */
const webUrl = Deno.env.get('MEDKIT_WEB_URL') ?? 'https://medkit.nb-77d18a.workers.dev';

/** A widget result older than this is not taken. */
const MAX_AGE_S = 24 * 60 * 60;

/** Where the result may be sent: the app, in Expo Go or built. */
const APP_RETURN = /^(exp|exps|medkit):\/\//;

const encoder = new TextEncoder();

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * The person in the widget's result (base64 JSON, as Telegram puts it in
 * `tgAuthResult`), or null when it was not signed by this bot or is too old
 * (core.telegram.org/widgets/login, "Checking authorization").
 */
async function telegramUser(result: string, token: string): Promise<TelegramUser | null> {
  let data: Record<string, unknown>;
  try {
    const b64 = result.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(result.length / 4) * 4, '=');
    data = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
  const { hash, ...fields } = data;
  if (typeof hash !== 'string') return null;
  const check = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secret = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  if (hex(await crypto.subtle.sign('HMAC', key, encoder.encode(check))) !== hash) return null;

  const authDate = Number(fields.auth_date);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AGE_S) return null;
  return typeof fields.id === 'number' ? (fields as unknown as TelegramUser) : null;
}

/** The anonymous user that called, if one did: the phone before signing in. */
async function caller(service: SupabaseClient, request: Request): Promise<string | null> {
  const jwt = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data } = await service.auth.getUser(jwt);
  return data.user?.is_anonymous ? data.user.id : null;
}

async function merge(service: SupabaseClient, from: string | null, to: string): Promise<Response | null> {
  if (!from || from === to) return null;
  const merged = await service.rpc('merge_account', { p_from: from, p_to: to });
  if (merged.error) return new Response(merged.error.message, { status: 500 });
  await service.auth.admin.deleteUser(from);
  return null;
}

async function withTelegram(service: SupabaseClient, from: string | null, result: string): Promise<Response> {
  if (!botToken) return new Response('TELEGRAM_APP_BOT_TOKEN is not set', { status: 503 });
  const person = await telegramUser(result, botToken);
  if (!person) return new Response('not signed by Telegram', { status: 401 });

  // The mini app's account (telegram-signin): the same email, so the same person.
  const email = `tg${person.id}@telegram.invalid`;
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
  const made = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { telegram_id: person.id, telegram_username: person.username ?? null, name },
  });
  if (made.error && made.error.status !== 422) return new Response(made.error.message, { status: 500 });

  const link = await service.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) return new Response(link.error.message, { status: 500 });

  const failed = await merge(service, from, link.data.user.id);
  if (failed) return failed;
  return Response.json({ tokenHash: link.data.properties.hashed_token, name });
}

async function withApple(service: SupabaseClient, from: string | null, idToken: string, nonce: string) {
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await anon.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce });
  if (signed.error || !signed.data.session) return new Response(signed.error?.message ?? 'no session', { status: 401 });

  const failed = await merge(service, from, signed.data.user.id);
  if (failed) return failed;
  const { access_token, refresh_token } = signed.data.session;
  return Response.json({ session: { access_token, refresh_token } });
}

Deno.serve(async (request) => {
  // The browser on its way to Telegram: the bot's id is the token's first part.
  if (request.method === 'GET') {
    const back = new URL(request.url).searchParams.get('return') ?? '';
    if (!botToken) return new Response('TELEGRAM_APP_BOT_TOKEN is not set', { status: 503 });
    if (!APP_RETURN.test(back)) return new Response('return must be the app', { status: 400 });
    const page = `${webUrl}/telegram-login.html?return=${encodeURIComponent(back)}`;
    const auth = new URL('https://oauth.telegram.org/auth');
    auth.searchParams.set('bot_id', botToken.split(':')[0]);
    auth.searchParams.set('origin', webUrl);
    auth.searchParams.set('return_to', page);
    return Response.redirect(auth.toString(), 302);
  }
  if (request.method !== 'POST') return new Response('GET or POST', { status: 405 });

  const body = (await request.json().catch(() => ({}))) as {
    telegram?: unknown;
    apple?: { idToken?: unknown; nonce?: unknown };
  };
  const service = createClient(url, serviceKey);
  const from = await caller(service, request);

  if (typeof body.telegram === 'string') return withTelegram(service, from, body.telegram);
  if (body.apple && typeof body.apple.idToken === 'string' && typeof body.apple.nonce === 'string') {
    return withApple(service, from, body.apple.idToken, body.apple.nonce);
  }
  return new Response('telegram or apple is required', { status: 400 });
});
