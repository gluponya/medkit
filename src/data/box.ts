import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { NOT_A_BOX, readFlap, readFront, type BoxReading } from '@/domain/box';

import { hasBackend, signedIn, supabase } from './remote/client';

/**
 * Reading the box's photos with recognise-box (docs/model.md, "A photo of the
 * box"). It needs the server: the first photo signs the phone in anonymously,
 * as sharing does.
 */
export type BoxReply =
  | { kind: 'read'; reading: BoxReading }
  | { kind: typeof NOT_A_BOX }
  /** No network, or no server in this build. */
  | { kind: 'offline' }
  /** Thirty photos today already. */
  | { kind: 'limit' }
  /** Asked, and the model failed or read no name. */
  | { kind: 'failed' };

/** A model reads a box in a few seconds; past this nobody should be left waiting. */
const TIMEOUT_MS = 60_000;

type Side = { kind: 'answer'; answer: unknown } | { kind: 'offline' | 'limit' | 'failed' };

async function ask(photo: string, side: 'front' | 'flap'): Promise<Side> {
  const { data, error } = await supabase.functions.invoke<{ answer?: unknown }>('recognise-box', {
    body: { photo, side },
    timeout: TIMEOUT_MS,
  });
  if (error instanceof FunctionsHttpError) {
    const status = (error.context as Response | undefined)?.status;
    if (__DEV__) console.warn(`recognise-box ${side}: ${status}`);
    return { kind: status === 429 ? 'limit' : 'failed' };
  }
  if (error instanceof FunctionsFetchError) return { kind: 'offline' };
  if (error || data?.answer === undefined) return { kind: 'failed' };
  return { kind: 'answer', answer: data.answer };
}

/** The front and, unless it was skipped, the flap, read at once. */
export async function readBox(front: string, flap: string | null): Promise<BoxReply> {
  if (!hasBackend) return { kind: 'offline' };
  try {
    await signedIn();
  } catch {
    return { kind: 'offline' };
  }
  const [face, side] = await Promise.all([ask(front, 'front'), flap ? ask(flap, 'flap') : null]);
  if (face.kind !== 'answer') return { kind: face.kind };
  const reading = readFront(face.answer);
  if (reading === NOT_A_BOX) return { kind: NOT_A_BOX };
  if (!reading.name && !reading.inn) return { kind: 'failed' };
  // A flap that failed only leaves the expiry to be picked by hand.
  const expires = side?.kind === 'answer' ? (readFlap(side.answer) ?? reading.expires) : reading.expires;
  return { kind: 'read', reading: { ...reading, expires } };
}
