/**
 * The default revenue split of a sale (basis points): artist (creator), studio (org), production.
 * The single source for the database default (`creators.split`) and for the shares shown on pages.
 */
export const DEFAULT_SPLIT = { creator_bps: 5000, org_bps: 3000, production_bps: 2000 } as const;

export type SplitBps = { creator_bps: number; org_bps: number; production_bps: number };

/**
 * Whole percentages of a creator's split. A split with any field missing (or not a number) is not
 * trusted: the whole default is shown, so the three shares always come from one split.
 */
export function splitPercents(split: Partial<SplitBps> | null | undefined): { artist: number; studio: number; production: number } {
  const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  const s = split && ok(split.creator_bps) && ok(split.org_bps) && ok(split.production_bps) ? (split as SplitBps) : DEFAULT_SPLIT;
  return { artist: Math.round(s.creator_bps / 100), studio: Math.round(s.org_bps / 100), production: Math.round(s.production_bps / 100) };
}
