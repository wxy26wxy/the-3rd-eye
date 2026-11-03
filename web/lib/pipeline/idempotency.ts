/**
 * Client idempotency keys (T134, docs/api.md "clientRequestId"): a repeated `change` or
 * `products` call with the same key returns the row the first call made; the same key for
 * another target is a conflict. The unique index (creator, key) settles a race.
 */
import "server-only";
import { z } from "zod";
import type { Description } from "@/lib/ai/types";
import { getArtworkByClientRequest, getProductByClientRequest, isUniqueViolation, type ArtworkRow, type ProductRow } from "@/lib/db/queries";
import { ApiError } from "@/lib/http";

export const ClientRequestId = z.string().trim().min(1).max(100);

const conflict = () => new ApiError(409, "client_request_conflict", "This clientRequestId was used for another request");

/** The change child made with `key`, or null. Another parent (or a deleted row) → 409. */
export async function existingChange(creatorId: string, key: string, parentId: string): Promise<ArtworkRow | null> {
  const row = await getArtworkByClientRequest(creatorId, key);
  if (!row) return null;
  if (row.deletedAt || row.parentArtworkId !== parentId) throw conflict();
  return row;
}

/** The product made with `key`, or null. Another artwork or type (or a deleted row) → 409. */
export async function existingProduct(creatorId: string, key: string, artworkId: string, type: string): Promise<ProductRow | null> {
  const row = await getProductByClientRequest(creatorId, key);
  if (!row) return null;
  if (row.deletedAt || row.artworkId !== artworkId || row.type !== type) throw conflict();
  return row;
}

/** Runs `insert`; when it loses a race on the unique key, returns the winner's row from `lookup` instead. */
export async function insertOnce<T>(key: string | null | undefined, insert: () => Promise<T>, lookup: () => Promise<T | null>): Promise<{ row: T; repeated: boolean }> {
  try {
    return { row: await insert(), repeated: false };
  } catch (err) {
    if (!key || !isUniqueViolation(err)) throw err;
    const row = await lookup();
    if (!row) throw err;
    return { row, repeated: true };
  }
}

/** The `change` description rebuilt from a stored child row (for a repeat). */
export function descriptionOf(row: ArtworkRow): Description {
  return {
    alt_text: row.altText ?? "", spoken: row.spokenDescription ?? "", dominant_colors: [], subject: "",
    differences_from_prompt: row.differencesFromPrompt ?? "",
  };
}
