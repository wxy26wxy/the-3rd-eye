/**
 * Buyer-note moderation with Muse Spark 1.3 (strict JSON). Notes go to artists with
 * disabilities, so anything hateful, harassing, sexual, threatening, or spam is rejected.
 * verified: same request shape as the listing moderation call (live 2026-10-28).
 */
import "server-only";
import type { Moderation, NoteModerator, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, type ResponsesLike } from "./client";
import { bool, obj, parseJsonOutput, str, strictFormat } from "./responses";

const INSTRUCTIONS = [
  "You review a short note a shopper wrote to an artist (or a shipping note). Many artists have disabilities.",
  "ok=false only for hateful, harassing, demeaning, sexual, threatening or violent content, or spam/links.",
  "Ordinary thanks, questions, compliments and delivery instructions are ok. reason is one short sentence.",
].join("\n");

export class MetaNoteModerator implements NoteModerator {
  constructor(private responses: ResponsesLike) {}

  async checkNote(text: string, opts: { trace: Trace }): Promise<Moderation> {
    const body = {
      model: MODELS.spark, instructions: INSTRUCTIONS, input: text.slice(0, 2000),
      reasoning: { effort: "minimal" }, text: strictFormat("note_moderation", obj({ ok: bool(), reason: str() })),
    };
    const resp = await traced("moderate", "meta", MODELS.spark, body, () => this.responses.create(body), { ...opts.trace, stage: "moderate" });
    const out = parseJsonOutput<Moderation>(resp);
    return { ok: Boolean(out.ok), reason: String(out.reason ?? "") };
  }
}
