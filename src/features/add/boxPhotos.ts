import { create } from 'zustand';

import type { BoxReading } from '@/domain/box';

/**
 * The two shots of a box (docs/screens.md, "Box photo"): the front with the
 * name and the flap with the expiry, as JPEG in base64, which is what goes to
 * recognise-box. `flap` stays null after «Терміну не видно, пропустити».
 * `reading` is what recognise-box read off them. Kept in memory only, like
 * the draft beside it.
 */
export interface BoxShot {
  uri: string;
  base64: string;
}

interface BoxPhotosState {
  front: BoxShot | null;
  flap: BoxShot | null;
  reading: BoxReading | null;
  set: (patch: Partial<Pick<BoxPhotosState, 'front' | 'flap' | 'reading'>>) => void;
  reset: () => void;
}

export const useBoxPhotos = create<BoxPhotosState>()((set) => ({
  front: null,
  flap: null,
  reading: null,
  set: (patch) => set(patch),
  reset: () => set({ front: null, flap: null, reading: null }),
}));
