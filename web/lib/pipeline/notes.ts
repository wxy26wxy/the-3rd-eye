/** Moderation of short buyer-written text (story-tag notes, ship notes) before it reaches a creator. */
import "server-only";
import { ai } from "@/lib/ai/registry";
import { ApiError } from "@/lib/http";
import { safeErrorText } from "@/lib/log-safe";
import type { Trace } from "@/lib/ai/types";

export const NOTE_REJECTED = "Please keep your note kind and friendly, then try again.";

/**
 * Throws 422 `note_rejected` for unkind or unsafe text (fail closed). When the moderation
 * provider itself fails, throws 503 `moderation_unavailable` with `unavailableMessage`
 * (the caller's hint, e.g. "remove the note and try again") instead of a 500.
 */
export async function moderateNote(text: string, trace: Trace, unavailableMessage: string): Promise<void> {
  let ok: boolean;
  try {
    ok = (await (await ai()).moderator.checkNote(text, { trace })).ok;
  } catch (err) {
    console.warn("[notes] moderation unavailable:", safeErrorText(err));
    throw new ApiError(503, "moderation_unavailable", unavailableMessage);
  }
  if (!ok) throw new ApiError(422, "note_rejected", NOTE_REJECTED);
}
