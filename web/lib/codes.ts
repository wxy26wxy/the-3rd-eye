/**
 * Creator login codes and slugs. Pure helpers (no database), shared by the admin
 * "Add creator" flow (T070) and scripts/seed.ts.
 */
import { randomInt } from "node:crypto";

/** No look-alikes: 0/O, 1/I/L are left out so a code read aloud or handwritten survives. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 10;

export function generateLoginCode(): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

export const SLUG_MAX = 40;

/** Lowercase a-z0-9 with single hyphens, at most 40 characters; "creator" when nothing is left. */
export function slugify(name: string): string {
  const s = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX).replace(/-+$/g, "");
  return s || "creator";
}

/**
 * Prefix that every slug `uniqueSlug(base, …)` can produce starts with (the base is cut to fit
 * `-N`), so a `LIKE prefix%` lookup finds all earlier `-2`, `-3` … even for 40-character bases.
 */
export function slugLookupPrefix(base: string): string {
  return base.slice(0, SLUG_MAX - 6).replace(/-+$/g, "");
}

/**
 * First free slug for `base`: `base`, then `base-2`, `base-3` … (the base is shortened so the
 * result stays within 40 characters). `taken` holds every slug already in use.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * The code to pre-fill on /create/code from the studio's sign-in link (`?c=CODE`):
 * trimmed, uppercased, at most 64 characters; "" when absent. A prefill only: the
 * person still taps Sign in.
 */
export function readCodePrefill(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.c;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim().toUpperCase().slice(0, 64) : "";
}
