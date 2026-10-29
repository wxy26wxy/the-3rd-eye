/**
 * Muse Spark 1.3 turns a spoken idea into a Muse Image prompt (strict JSON).
 * UNVERIFIED until the first live call.
 */
import "server-only";
import type { PromptShaper, ShapedPrompt, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, type ResponsesLike } from "./client";
import { nullableStr, obj, parseJsonOutput, str, strictFormat } from "./responses";

export const SHAPED_PROMPT_SCHEMA = obj({
  prompt: str("Image prompt for Muse Image, in English, one paragraph"),
  style_notes: str("Short notes on the style choices made"),
  clarifying_question: nullableStr("ONE question, only if the idea is truly ambiguous; otherwise null"),
  spoken_confirmation: str("One or two short sentences read aloud to the artist, e.g. 'I will draw ...'"),
});

export const SHAPING_STYLE: Record<"sticker" | "tote", string> = {
  sticker:
    "Sticker illustration: a single subject, centered, bold dark outlines, flat colors, no gradients, " +
    "pure white background (#FFFFFF) with nothing else in the scene, no text, no letters, no border, no shadow.",
  tote:
    "Tote bag print: a single subject or simple composition, bold dark outlines, flat colors (at most 5), " +
    "pure white background (#FFFFFF), no text, no letters, no photo realism.",
};

export function shapingInstructions(product: "sticker" | "tote"): string {
  return [
    "You help artists, including blind and low-vision artists, turn an idea they said out loud into an image prompt.",
    "Keep every concrete detail the artist said (subject, colors, mood, objects). Do not add new subjects.",
    `Always apply this style: ${SHAPING_STYLE[product]}`,
    "Ask ONE clarifying question only if the idea is truly ambiguous (you cannot pick a subject at all). " +
      "If it is merely brief, make a friendly choice and set clarifying_question to null.",
    "If answers to an earlier question are given, use them and set clarifying_question to null.",
    "spoken_confirmation is warm, plain language, no jargon, and says what will be drawn.",
  ].join("\n");
}

export class MetaPromptShaper implements PromptShaper {
  constructor(private responses: ResponsesLike = metaResponses()) {}

  styleFor(product: "sticker" | "tote"): string {
    return SHAPING_STYLE[product];
  }

  async shape(transcript: string, opts: { answers?: string[]; product: "sticker" | "tote"; trace: Trace }): Promise<ShapedPrompt> {
    const user = [
      `The artist said: "${transcript}"`,
      opts.answers?.length ? `Answers to your question: ${opts.answers.map((a) => `"${a}"`).join("; ")}` : "",
      `Product: ${opts.product}`,
    ].filter(Boolean).join("\n");
    const body = {
      model: MODELS.spark,
      instructions: shapingInstructions(opts.product),
      input: user,
      reasoning: { effort: "low" },
      text: strictFormat("shaped_prompt", SHAPED_PROMPT_SCHEMA),
    };
    const resp = await traced("shape", "meta", MODELS.spark, body, () => this.responses.create(body), opts.trace);
    const out = parseJsonOutput<ShapedPrompt>(resp);
    return { ...out, clarifying_question: out.clarifying_question || null };
  }
}
