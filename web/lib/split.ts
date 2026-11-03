/**
 * The default revenue split of a sale (basis points): artist (creator), studio (org), production.
 * The single source for the database default (`creators.split`) and for the shares shown on pages.
 */
export const DEFAULT_SPLIT = { creator_bps: 5000, org_bps: 3000, production_bps: 2000 } as const;

export type SplitBps = { creator_bps: number; org_bps: number; production_bps: number };

/** Whole percentages of a creator's split (the default where a field is missing). */
export function splitPercents(split: Partial<SplitBps> | null | undefined): { artist: number; studio: number; production: number } {
  const pct = (bps: number | undefined, fallback: number) => Math.round((bps ?? fallback) / 100);
  return {
    artist: pct(split?.creator_bps, DEFAULT_SPLIT.creator_bps),
    studio: pct(split?.org_bps, DEFAULT_SPLIT.org_bps),
    production: pct(split?.production_bps, DEFAULT_SPLIT.production_bps),
  };
}
