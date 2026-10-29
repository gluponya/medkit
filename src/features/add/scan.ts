import { create } from 'zustand';

import type { Added } from '@/data/medicines';
import type { Scan } from '@/domain/barcode';

/**
 * The scanner's side of an add (docs/journeys.md, J2): the code of the pack
 * in hand, so the medicine picked for it, by any way, teaches the map; the
 * «Кілька поспіль» mode; and the pack just added in that mode, for the toast.
 * In memory only, for as long as the scanner is open.
 */
interface ScanState {
  scan: Scan | null;
  many: boolean;
  /** The scanner is in the stack, so an add in «Кілька поспіль» can go back to it. */
  open: boolean;
  added: (Added & { name: string }) | null;
  set: (patch: Partial<Omit<ScanState, 'set'>>) => void;
}

export const useScan = create<ScanState>()((set) => ({
  scan: null,
  many: false,
  open: false,
  added: null,
  set: (patch) => set(patch),
}));

/** The expiry a DataMatrix gave, to fill in a draft started from the scanned pack. */
export function scannedExpiry(): { year: number; month: number } | Record<string, never> {
  return useScan.getState().scan?.expires ?? {};
}
