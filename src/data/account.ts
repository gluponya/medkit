import type { User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { usePrefs } from './prefs';
import { hasBackend, supabase } from './remote/client';
import { syncNow, whileSyncPaused } from './sync';

/**
 * «Зберегти доступ» (docs/model.md, "Signing in"): the phone signs in with
 * Telegram or Apple, its anonymous user goes into that account on the server,
 * and from then on every cabinet is kept there (src/data/sync), so a new phone
 * or the Telegram mini app signed in the same way gets them back.
 */

export type Provider = 'telegram' | 'apple';

function providerOf(user: User | undefined): Provider | null {
  if (!user || user.is_anonymous) return null;
  if (user.user_metadata?.telegram_id) return 'telegram';
  if (user.app_metadata?.provider === 'apple') return 'apple';
  return null;
}

/** What the phone is signed in with; null while it is anonymous or not at all. */
export function useAccount(): Provider | null {
  const [provider, setProvider] = useState<Provider | null>(null);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setProvider(providerOf(data.session?.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setProvider(providerOf(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);
  return provider;
}

/**
 * Opens Telegram's sign-in in the browser. It comes back to the app at
 * /signed-in with Telegram's signed result (`finishTelegram`).
 */
export async function startTelegram(): Promise<void> {
  if (!hasBackend) throw new Error('no server in this build');
  const back = Linking.createURL('signed-in');
  const start = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/sign-in?return=${encodeURIComponent(back)}`;
  await Linking.openURL(start);
}

export function finishTelegram(result: string): Promise<void> {
  return finish({ telegram: result }, '');
}

export function appleAvailable(): Promise<boolean> {
  return Platform.OS === 'ios' ? AppleAuthentication.isAvailableAsync() : Promise.resolve(false);
}

/** Apple's own sheet; false when the person closed it. */
export async function signInWithApple(): Promise<boolean> {
  // Apple gets the nonce's hash and puts it in the token; the server compares.
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw e;
  }
  if (!credential.identityToken) throw new Error('no token from Apple');
  // Apple gives the name only the first time.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  await finish({ apple: { idToken: credential.identityToken, nonce } }, name);
  return true;
}

/**
 * The server merges the phone's anonymous user into the account and answers
 * with its session. Sync waits meanwhile: a cycle run as the account before the
 * merge would find none of the phone's cabinets on the server and drop them.
 */
async function finish(body: object, appleName: string): Promise<void> {
  if (!hasBackend) throw new Error('no server in this build');
  await whileSyncPaused(async () => {
    const { data, error } = await supabase.functions.invoke<{
      tokenHash?: string;
      session?: { access_token: string; refresh_token: string };
      name?: string;
    }>('sign-in', { body });
    if (error) throw error;
    const opened = data?.tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: data.tokenHash, type: 'email' })
      : data?.session
        ? await supabase.auth.setSession(data.session)
        : null;
    if (!opened || opened.error) throw opened?.error ?? new Error('no session from the server');

    const prefs = usePrefs.getState();
    const name = prefs.name || data?.name || appleName;
    if (!prefs.name && name) prefs.set({ name });
    if (name) await supabase.rpc('set_name', { name });
  });
  await syncNow(true);
}
