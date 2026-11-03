/**
 * The featured creator (T147): the shop's hero chip, the phone preview and the first "Meet the
 * makers" card lead with this slug. `FEATURED_CREATOR_SLUG` overrides the default; when the slug is
 * hidden, deleted or unknown the callers fall back to their own pick among public creators.
 */
export const DEFAULT_FEATURED_SLUG = "june-park";

export function featuredSlug(env: Record<string, string | undefined> = process.env): string {
  return env.FEATURED_CREATOR_SLUG?.trim() || DEFAULT_FEATURED_SLUG;
}

/** The public creator with `slug`, or null (hidden creators are never in `publicCreators`). */
export function findFeatured<T extends { slug: string }>(publicCreators: T[], slug: string): T | null {
  return publicCreators.find((c) => c.slug === slug) ?? null;
}

/** `ranked` with the featured creator moved to the front; unchanged when it is not there. */
export function leadWithFeatured<T extends { slug: string }>(ranked: T[], slug: string): T[] {
  const i = ranked.findIndex((c) => c.slug === slug);
  return i <= 0 ? ranked : [ranked[i], ...ranked.slice(0, i), ...ranked.slice(i + 1)];
}
