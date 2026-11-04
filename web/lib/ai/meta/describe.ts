/**
 * Muse Spark 1.3 vision: describes a result for the artist (spoken aloud on-device)
 * and for alt text. Strict JSON per the `Description` type. verified: 2026-10-28 (live probe and seed).
 */
import "server-only";
import { callSignal } from "@/lib/deadline";
import type { Describer, Description, ImageRef, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, type ResponsesLike } from "./client";
import { VISION_INLINE } from "@/lib/image/inline";
import { arr, inlineImage, obj, parseJsonOutput, str, strictFormat, userMessage } from "./responses";

export const DESCRIPTION_SCHEMA = obj({
  alt_text: str("Alt text, at most 125 characters, no 'image of'"),
  spoken: str("At most 2 short sentences written for a blind listener: subject, colors, layout, mood"),
  dominant_colors: arr(str()),
  subject: str("The main subject in a few words"),
  differences_from_prompt: str("How the image differs from the prompt, or an empty string"),
});

const INSTRUCTIONS = [
  "You describe artwork to its artist, who may be blind, and write alt text for shoppers.",
  "spoken: at most two short sentences. Lead with the subject, then colors and where things are. Plain words, no jargon, no 'the image shows'.",
  "alt_text: at most 125 characters.",
  "differences_from_prompt: if a prompt is given, honestly name anything missing or different, in one sentence; otherwise an empty string.",
].join("\n");

export const SUBJECTS_TIMEOUT_MS = 15_000;
export const SUBJECTS_SCHEMA = obj({ subjects: arr(str("A short noun phrase, 2 to 4 words, singular")) });
export const MAX_SUBJECTS = 3;

const SUBJECTS_INSTRUCTIONS = [
  `Name up to ${MAX_SUBJECTS} distinct things or characters drawn or made in this picture, as short singular noun phrases of 2 to 4 words (for example "potted plant with a face", "coffee mug", "bookshelf").`,
  "Name the main subject first. Skip the paper, the table, the background and decoration.",
  "Answer with an empty list when the picture is one plain drawing with no distinct parts.",
].join("\n");

/** Trims, lower-cases, drops empties and repeats, keeps at most MAX_SUBJECTS. */
export function cleanSubjects(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const x of list) {
    const t = typeof x === "string" ? x.trim().toLowerCase() : "";
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, MAX_SUBJECTS);
}

export class MetaDescriber implements Describer {
  constructor(private responses: ResponsesLike = metaResponses()) {}

  async describe(image: ImageRef, opts: { prompt?: string; trace: Trace }): Promise<Description> {
    const body = {
      model: MODELS.spark,
      instructions: INSTRUCTIONS,
      input: [userMessage([
        { type: "input_text", text: opts.prompt ? `The prompt was: "${opts.prompt}"` : "No prompt: this is a photo of a drawing." },
        await inlineImage(image, VISION_INLINE),
      ])],
      // T150: the inlined picture is not stored (a 413 on large payloads with store=true); describe needs no follow-up.
      store: false,
      reasoning: { effort: "low" },
      text: strictFormat("description", DESCRIPTION_SCHEMA),
    };
    const resp = await traced("describe", "meta", MODELS.spark, body, () => this.responses.create(body), opts.trace);
    return parseJsonOutput<Description>(resp);
  }

  async subjects(image: ImageRef, opts: { trace: Trace }): Promise<string[]> {
    const body = {
      model: MODELS.spark,
      instructions: SUBJECTS_INSTRUCTIONS,
      input: [userMessage([{ type: "input_text", text: "What is drawn or made in this picture?" }, await inlineImage(image, VISION_INLINE)])],
      store: false,
      reasoning: { effort: "low" },
      text: strictFormat("subjects", SUBJECTS_SCHEMA),
    };
    // Optional step on the upload path: a short limit, so a slow Spark answer never delays the SAM phrases much.
    const resp = await traced("subjects", "meta", MODELS.spark, body, () => this.responses.create(body, { signal: callSignal(SUBJECTS_TIMEOUT_MS) }), opts.trace);
    return cleanSubjects(parseJsonOutput<{ subjects?: unknown }>(resp).subjects);
  }
}
