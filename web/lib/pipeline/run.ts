/**
 * Runs a long pipeline inside the request deadline (270 s, under Vercel's 300 s maxDuration).
 * On timeout → 504 `deadline_exceeded` with the artwork id(s) created so far; on other failures
 * the tracked artworks get `lastError` and the error carries `artworkId` so clients can retry.
 */
import "server-only";
import { DeadlineError, trackedArtworks, withDeadline } from "@/lib/deadline";
import { ApiError, toApiError } from "@/lib/http";
import { markArtworksFailed } from "@/lib/db/queries";

export const REQUEST_DEADLINE_MS = 270_000;

export async function runPipeline<T>(fn: () => Promise<T>, ms = REQUEST_DEADLINE_MS): Promise<T> {
  let ids: string[] = [];
  try {
    return await withDeadline(ms, async () => {
      try {
        return await fn();
      } finally {
        ids = trackedArtworks();
      }
    });
  } catch (err) {
    if (err instanceof DeadlineError) ids = err.artworkIds;
    const apiErr = err instanceof DeadlineError
      ? new ApiError(504, "deadline_exceeded", err.message)
      : toApiError(err);
    if (ids.length && apiErr.status >= 500) {
      await markArtworksFailed(ids, `${apiErr.code}: ${err instanceof Error ? err.message : String(err)}`).catch(() => undefined);
    }
    if (ids.length) apiErr.details = { ...apiErr.details, artworkId: ids[0], artworkIds: ids };
    throw apiErr;
  }
}
