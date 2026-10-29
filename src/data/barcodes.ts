import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MedicineForm } from '@/domain/medicine';

import { hasBackend, signedIn, supabase } from './remote/client';

/**
 * What a pack's code is (docs/model.md, "Barcodes"): the shared map on the
 * server, and this phone's own picks kept here too, so a code once found
 * works at once next time, with no network.
 */

/** A Register entry, or a medicine typed by hand: its name and form. */
export type CodePick =
  | { registerId: string; packSize: number | null }
  | { registerId: null; name: string; form: MedicineForm; packSize: number | null };

export type CodeAnswer =
  | ({ kind: 'known' } & CodePick)
  | { kind: 'unknown' }
  /** No network, or no server in this build. */
  | { kind: 'offline' };

/**
 * Someone else's pick is trusted once this many people made it. One while
 * there are few users (the owner, 2026-10-29), so a code helps at once.
 */
const TRUSTED = 1;

const useOwnCodes = create<{ codes: Record<string, CodePick> }>()(
  persist(() => ({ codes: {} as Record<string, CodePick> }), {
    name: 'barcodes',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

type Row = {
  register_id: string | null;
  name: string | null;
  form: MedicineForm | null;
  pack_size: number | null;
  confirmations: number;
  mine: boolean;
};

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
    if (row.register_id) return { kind: 'known', registerId: row.register_id, packSize: row.pack_size };
    if (row.name && row.form) {
      return { kind: 'known', registerId: null, name: row.name, form: row.form, packSize: row.pack_size };
    }
    return { kind: 'unknown' };
  } catch (e) {
    if (__DEV__) console.warn('barcode lookup failed:', e);
    return { kind: 'offline' };
  }
}

/**
 * The person added this code as this medicine: kept on the phone and sent to
 * the map, replacing their earlier pick. Sending is not waited for; a pick
 * that cannot be sent now still works here.
 */
export function rememberCode(gtin: string, pick: CodePick): void {
  useOwnCodes.setState((s) => ({ codes: { ...s.codes, [gtin]: pick } }));
  if (!hasBackend) return;
  const typed = pick.registerId === null ? pick : null;
  void (async () => {
    await signedIn();
    const { error } = await supabase.rpc('confirm_barcode', {
      p_gtin: gtin,
      p_register_id: pick.registerId,
      p_name: typed?.name.trim() ?? null,
      p_form: typed?.form ?? null,
      p_pack_size: pick.packSize,
    });
    if (error) throw error;
  })().catch((e: unknown) => {
    if (__DEV__) console.warn('barcode confirm failed:', e);
  });
}
