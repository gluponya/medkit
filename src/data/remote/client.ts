import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

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
 * never signs in.
 */
export async function signedIn(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;
  const made = await supabase.auth.signInAnonymously();
  if (made.error || !made.data.user) throw made.error ?? new Error('no user from the server');
  return made.data.user.id;
}
