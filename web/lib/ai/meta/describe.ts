/**
 * Muse Spark 1.3 vision: describes a result for the artist (spoken aloud on-device)
 * and for alt text. Strict JSON per the `Description` type. UNVERIFIED until live.
 */
import "server-only";
import type { Describer, Description, ImageRef, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, type ResponsesLike } from "./client";
import { arr, inputImage, obj, parseJsonOutput, str, strictFormat, userMessage } from "./responses";

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

export class MetaDescriber implements Describer {
  constructor(private responses: ResponsesLike = metaResponses()) {}

  async describe(image: ImageRef, opts: { prompt?: string; trace: Trace }): Promise<Description> {
    const body = {
      model: MODELS.spark,
      instructions: INSTRUCTIONS,
      input: [userMessage([
        { type: "input_text", text: opts.prompt ? `The prompt was: "${opts.prompt}"` : "No prompt: this is a photo of a drawing." },
        inputImage(image),
      ])],
      reasoning: { effort: "low" },
      text: strictFormat("description", DESCRIPTION_SCHEMA),
    };
    const resp = await traced("describe", "meta", MODELS.spark, body, () => this.responses.create(body), opts.trace);
    return parseJsonOutput<Description>(resp);
  }
}
