import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hasBackend, signedIn, supabase } from './remote/client';

/**
 * What a pack's code is (docs/model.md, "Barcodes"): the shared map on the
 * server, and this phone's own picks kept here too, so a code once found
 * works at once next time, with no network.
 */
export type CodeAnswer =
  | { kind: 'known'; registerId: string; packSize: number | null }
  | { kind: 'unknown' }
  /** No network, or no server in this build. */
  | { kind: 'offline' };

/** Someone else's pick is trusted once this many people made it. */
const TRUSTED = 2;

type OwnCode = { registerId: string; packSize: number | null };

const useOwnCodes = create<{ codes: Record<string, OwnCode> }>()(
  persist(() => ({ codes: {} as Record<string, OwnCode> }), {
    name: 'barcodes',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

type Row = { register_id: string; pack_size: number | null; confirmations: number; mine: boolean };

export async function lookupCode(gtin: string): Promise<CodeAnswer> {
  const own = useOwnCodes.getState().codes[gtin];
  if (own) return { kind: 'known', ...own };
  if (!hasBackend) return { kind: 'offline' };
  try {
    await signedIn();
    const { data, error } = await supabase.rpc('lookup_barcode', { p_gtin: gtin });
    if (error) throw error;
    const row = (data as Row[] | null)?.[0];
    if (!row || !(row.mine || row.confirmations >= TRUSTED)) return { kind: 'unknown' };
    return { kind: 'known', registerId: row.register_id, packSize: row.pack_size };
  } catch (e) {
    if (__DEV__) console.warn('barcode lookup failed:', e);
    return { kind: 'offline' };
  }
}

/**
 * The person added this code as this Register entry: kept on the phone and
 * sent to the map. Sending is not waited for; a pick that cannot be sent now
 * still works here.
 */
export function rememberCode(gtin: string, registerId: string, packSize: number | null): void {
  useOwnCodes.setState((s) => ({ codes: { ...s.codes, [gtin]: { registerId, packSize } } }));
  send('confirm_barcode', { p_gtin: gtin, p_register_id: registerId, p_pack_size: packSize });
}

/**
 * The person's pick for this code was wrong and there is no Register entry
 * to put instead («Змінити ліки» to one typed by hand): it goes, here and on
 * the server. Other people's picks stay.
 */
export function forgetCode(gtin: string): void {
  useOwnCodes.setState((s) => {
    const { [gtin]: _gone, ...codes } = s.codes;
    return { codes };
  });
  send('forget_barcode', { p_gtin: gtin });
}

/** Tells the map, not waited for; what cannot be sent now still holds on this phone. */
function send(fn: 'confirm_barcode' | 'forget_barcode', args: Record<string, unknown>): void {
  if (!hasBackend) return;
  void (async () => {
    await signedIn();
    const { error } = await supabase.rpc(fn, args);
    if (error) throw error;
  })().catch((e: unknown) => {
    if (__DEV__) console.warn(`${fn} failed:`, e);
  });
}
