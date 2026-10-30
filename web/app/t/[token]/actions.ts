"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { createBuyerMessage, recordTap } from "@/lib/db/queries.contract";
import { m } from "@/components/messages";

const token = z.string().regex(/^[A-Za-z0-9]{6,32}$/);

/** Counts one tap of a story tag. Called once per page load from the client. */
export async function tap(raw: string): Promise<void> {
  const parsed = token.safeParse(raw);
  if (!parsed.success) return;
  try { await recordTap(parsed.data, { task: "T020" }); } catch (err) { console.error("tap failed", err); }
}

export type NoteState = { ok?: boolean; error?: string; value?: string };

/** Buyer → creator note from the story-tag page. */
export async function sendReply(rawToken: string, _prev: NoteState, formData: FormData): Promise<NoteState> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: m.tag.noteRequired, value: body };
  const t = token.safeParse(rawToken);
  if (!t.success || body.length > 1000) return { error: m.tag.noteError, value: body };
  try {
    await createBuyerMessage(t.data, body, { task: "T050" });
    refresh(); // show the new note in the thread
    return { ok: true };
  } catch (err) {
    if ((err as { code?: string })?.code === "note_rejected") return { error: m.tag.noteRejected, value: body };
    if ((err as { code?: string })?.code === "moderation_unavailable") return { error: m.tag.noteUnavailable, value: body };
    console.error("sendReply failed", err);
    return { error: m.tag.noteError, value: body };
  }
}
