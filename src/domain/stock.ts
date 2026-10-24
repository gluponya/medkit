/**
 * Which pack a dose comes out of (docs/model.md, "Intake"): an opened one
 * first, then one with an unknown expiry (likely the oldest), then the one that
 * expires soonest. Only counted packs with something
 * left can give a dose.
 */

export interface StockPack {
  id: string;
  /** Null: «Не знаю», no date on the pack. */
  expires: string | null;
  quantity: number | null;
  openedAt: string | null;
}

export function packToTake<P extends StockPack>(packs: readonly P[]): P | null {
  const counted = packs.filter((p) => p.quantity !== null && p.quantity > 0);
  counted.sort(
    (a, b) => Number(b.openedAt !== null) - Number(a.openedAt !== null) || byExpiry(a, b),
  );
  return counted[0] ?? null;
}

/** All active packs in the order they are used up: the one in use first. */
export function packOrder<P extends StockPack>(packs: readonly P[]): P[] {
  const first = packToTake(packs);
  const rest = packs.filter((p) => p !== first).sort(byExpiry);
  return first ? [first, ...rest] : rest;
}

/** Counted stock over the packs; null when none of them is counted. */
export function stockOf(packs: readonly StockPack[]): number | null {
  const counted = packs.filter((p) => p.quantity !== null);
  return counted.length > 0 ? counted.reduce((sum, p) => sum + (p.quantity ?? 0), 0) : null;
}

/** Unknown expiries first, then the soonest. */
function byExpiry(a: StockPack, b: StockPack): number {
  if (a.expires === null || b.expires === null) return Number(b.expires === null) - Number(a.expires === null);
  return a.expires.localeCompare(b.expires);
}
