/**
 * Muse Image 1.0 via the Responses API. generate() runs n calls in parallel;
 * refine() continues with previous_response_id; compose() sends several input_image parts;
 * edit() sends one input_image (the picked piece) with the change instruction (T111, "Change it").
 * The PNG is the base64 `result` of the `image_generation_call` output item.
 * verified: 2026-10-28 — the `image_generation` tool entry (output_format png) is accepted;
 * native resolution is 1600×1600 whatever `size` says (docs/architecture.md "Live findings").
 */
import "server-only";
import sharp from "sharp";
import type { GeneratedImage, ImageProvider, ImageRef, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, type ResponsesLike } from "./client";
import { imageResults, inputImage, responseId, userMessage } from "./responses";

export const IMAGE_TOOL = { type: "image_generation", output_format: "png", size: "1024x1024" } as const;

export async function toGeneratedImage(resp: unknown): Promise<GeneratedImage> {
  const [b64] = imageResults(resp);
  if (!b64) throw new Error("Muse Image returned no image_generation_call result");
  const png = await sharp(Buffer.from(b64, "base64")).png().toBuffer();
  const meta = await sharp(png).metadata();
  return { png, responseId: responseId(resp), width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Appended to every change instruction (refine and edit): the art stays the artist's, the background stays printable. */
export const KEEP_GUARD = "Keep the same subject, style and pure white background unless asked otherwise.";

/** The edit request body: instruction (with the guard) and the picture as one user message. */
export function editBody(image: ImageRef, instruction: string) {
  return {
    model: MODELS.image,
    input: [userMessage([{ type: "input_text", text: `${instruction.trim()}\n${KEEP_GUARD}` }, inputImage(image)])],
    tools: [IMAGE_TOOL],
  };
}

export class MetaImageProvider implements ImageProvider {
  constructor(private responses: ResponsesLike = metaResponses()) {}

  private async call(stage: string, body: Record<string, unknown>, trace: Trace): Promise<GeneratedImage> {
    return traced(stage, "meta", MODELS.image, body, async () => toGeneratedImage(await this.responses.create(body)), trace);
  }

  async generate(prompt: string, opts: { n: number; trace: Trace }): Promise<GeneratedImage[]> {
    const n = Math.max(1, Math.min(4, opts.n));
    const body = { model: MODELS.image, input: prompt, tools: [IMAGE_TOOL] };
    return Promise.all(Array.from({ length: n }, () => this.call("generate", body, opts.trace)));
  }

  refine(previousResponseId: string, instruction: string, opts: { trace: Trace }): Promise<GeneratedImage> {
    const body = {
      model: MODELS.image,
      previous_response_id: previousResponseId,
      input: `${instruction}\n${KEEP_GUARD}`,
      tools: [IMAGE_TOOL],
    };
    return this.call("refine", body, opts.trace);
  }

  compose(prompt: string, refs: ImageRef[], opts: { trace: Trace }): Promise<GeneratedImage> {
    const body = {
      model: MODELS.image,
      input: [userMessage([{ type: "input_text", text: prompt }, ...refs.map(inputImage)])],
      tools: [IMAGE_TOOL],
    };
    return this.call("mockup", body, opts.trace);
  }

  edit(image: ImageRef, instruction: string, opts: { trace: Trace }): Promise<GeneratedImage> {
    return this.call("edit", editBody(image, instruction), opts.trace);
  }
}
