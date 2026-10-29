/**
 * Identifiers. NFC story-tag tokens are 12 characters of Crockford base32
 * (60 bits of randomness), short enough to encode in an NTAG URL and to read aloud.
 */
import { randomBytes, randomUUID } from "node:crypto";

export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const NFC_TOKEN_LENGTH = 12;

/** 12-char Crockford base32 token. Each byte is masked to 5 bits (256 is a multiple of 32, so uniform). */
export function newNfcToken(): string {
  const bytes = randomBytes(NFC_TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < NFC_TOKEN_LENGTH; i++) out += CROCKFORD_ALPHABET[bytes[i] & 31];
  return out;
}

/** Crockford decoding rules: case-insensitive, I/L read as 1, O as 0, hyphens ignored. */
export function normalizeNfcToken(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/-/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

export function isNfcToken(input: string): boolean {
  return new RegExp(`^[${CROCKFORD_ALPHABET}]{${NFC_TOKEN_LENGTH}}$`).test(input);
}

export function newId(): string {
  return randomUUID();
}
