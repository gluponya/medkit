import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { telegramInitData } from '@/ui/telegram-shell';

/**
 * The Supabase client, for shared cabinets only (docs/model.md, "Syncing a
 * shared cabinet"). Screens never call it: they read SQLite, and sharing goes
 * through src/data/sharing.ts and src/data/sync.
 */

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether this build knows a server. Without one the app works as before and
 * inviting or joining says there is no connection. The two values go in
 * .env.local (see .env.example).
 */
export const hasBackend = Boolean(url && anonKey);

export const supabase = createClient(url || 'http://backend.invalid', anonKey || 'none', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // In a mobile app the session does not arrive from the URL.
    detectSessionInUrl: false,
  },
});

/**
 * The person's id on the server: the anonymous user of the first share or
 * join, kept on the phone. Made on first need, so a phone that never shares
 * never signs in. Inside Telegram the account is the person's Telegram one
 * instead (docs/telegram.md), so it is the same on every device they open it.
 */
export async function signedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const telegram = telegramInitData();
  if (telegram) return signInWithTelegram(telegram);
  const made = await supabase.auth.signInAnonymously();
  if (made.error || !made.data.user) throw made.error ?? new Error('no user from the server');
  return made.data.user.id;
}

/**
 * Telegram's signed launch data goes to the server, which checks the signature
 * and answers with a one-time token; the token becomes the session here,
 * GoTrue's own, kept and refreshed as any other. As Freshka's.
 */
async function signInWithTelegram(initData: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ tokenHash?: string }>('telegram-signin', {
    body: { initData },
  });
  if (error) throw error;
  if (!data?.tokenHash) throw new Error('no token from the server');
  const opened = await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'email' });
  if (opened.error || !opened.data.user) throw opened.error ?? new Error('no user from the server');
  return opened.data.user.id;
}

/**
 * Forgets the session on this phone only: the server user and its cabinets
 * stay. After «Видалити всі дані» the next share or join starts a new user
 * rather than bringing the wiped cabinets back.
 */
export async function signOutHere(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error && __DEV__) console.warn('sign-out failed:', error);
}
