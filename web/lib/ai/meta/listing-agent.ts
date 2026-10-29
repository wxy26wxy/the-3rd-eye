/**
 * Listing agent: Muse Spark 1.3 tool loop (tool_choice "auto", ≤ 8 model turns).
 * Tools: check_resolution, check_contrast, suggest_price, moderate_content, finalize_listing.
 * Tool results go back as function_call_output with previous_response_id. If the model never
 * calls finalize_listing, one final strict-JSON call forces the listing. Returns the full trace.
 * verified: 2026-10-28 — function tools, function_call_output + previous_response_id and
 * tool_choice "auto" work live. The publish gate does not trust the model's print_ok or
 * moderation claims: lib/pipeline/products.ts recomputes both from the tool results (T050).
 */
import "server-only";
import type { AgentStep, ListingAgent, ListingDraft, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, type ResponsesLike } from "./client";
import { bool, functionCalls, inputImage, obj, outputText, parseJsonOutput, responseId, str, strictFormat, userMessage } from "./responses";
import { LISTING_TOOLS, toolSpecs, type ToolContext, type ToolDef } from "./tools";
import { LISTING_SCHEMA, normalizeListing } from "./tools/finalize-listing";
import { loadImageRef } from "@/lib/image/ref";

export const MAX_ITERATIONS = 8;

const INSTRUCTIONS = [
  "You prepare a shop listing for an artist's product. Be warm, concrete and honest; never invent facts about the artist.",
  "Steps: call check_resolution and check_contrast, then suggest_price, then draft a title (≤ 60 chars), a 2–4 sentence description and up to 8 tags,",
  "call moderate_content on the draft, and finally call finalize_listing once. print_ok is true only if resolution and contrast are ok.",
  "Put anything the artist should fix in notes.",
].join("\n");

type RunCtx = Parameters<ListingAgent["run"]>[0];

export class MetaListingAgent implements ListingAgent {
  constructor(
    private responses: ResponsesLike = metaResponses(),
    private tools: ToolDef[] = LISTING_TOOLS,
    private loadImage: (url: string) => Promise<Buffer> = (url) => loadImageRef({ url }),
  ) {}

  /** Spark second call used by moderate_content. */
  async moderate(text: { title: string; description: string; tags: string[] }, opts: { trace: Trace }): Promise<{ ok: boolean; reason: string }> {
    const trace = { ...opts.trace, stage: "moderate" };
    const body = {
      model: MODELS.spark,
      instructions: "You review shop listings. ok=false only for hateful, sexual, violent, harassing or misleading content. reason is one short sentence.",
      input: JSON.stringify(text),
      reasoning: { effort: "minimal" },
      text: strictFormat("moderation", obj({ ok: bool(), reason: str() })),
    };
    const resp = await traced("moderate", "meta", MODELS.spark, body, () => this.responses.create(body), trace);
    const out = parseJsonOutput<{ ok: boolean; reason: string }>(resp);
    return { ok: Boolean(out.ok), reason: String(out.reason ?? "") };
  }

  async run(ctx: RunCtx, opts: { trace: Trace }): Promise<{ listing: ListingDraft; trace: AgentStep[] }> {
    const trace = { ...opts.trace, stage: "listing" };
    let imageBytes: Promise<Buffer> | null = null;
    const toolCtx: ToolContext = {
      productType: ctx.productType, width: ctx.width, height: ctx.height, creatorShareBps: ctx.creatorShareBps,
      loadImage: () => (imageBytes ??= this.loadImage(ctx.imageUrl)),
      moderate: (text) => this.moderate(text, { trace }),
    };
    const specs = toolSpecs(this.tools);
    const steps: AgentStep[] = [];
    const call = (body: Record<string, unknown>) => traced("listing", "meta", MODELS.spark, body, () => this.responses.create(body), trace);

    const context = [
      `Product: ${ctx.productType}. Artwork size: ${ctx.width}×${ctx.height}px.`,
      `Artwork description: ${ctx.altText}`,
      ctx.creatorStory ? `About the artist (their words): ${ctx.creatorStory}` : "",
      `The artist earns ${ctx.creatorShareBps / 100}% of each sale.`,
    ].filter(Boolean).join("\n");

    let resp = await call({
      model: MODELS.spark, instructions: INSTRUCTIONS, tools: specs, tool_choice: "auto",
      input: [userMessage([{ type: "input_text", text: context }, inputImage({ url: ctx.imageUrl })])],
    });
    let final: ListingDraft | null = null;
    let pending: { type: "function_call_output"; call_id: string; output: string }[] = [];

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const text = outputText(resp);
      if (text) steps.push({ step: steps.length + 1, text });
      const calls = functionCalls(resp);
      if (!calls.length) break;
      pending = [];
      for (const fc of calls) {
        const tool = this.tools.find((t) => t.name === fc.name);
        let result: unknown;
        try {
          result = tool ? await tool.handler(fc.args, toolCtx) : { error: `Unknown tool ${fc.name}` };
        } catch (err) {
          result = { error: err instanceof Error ? err.message : String(err) };
        }
        steps.push({ step: steps.length + 1, tool: fc.name, args: fc.args, result });
        pending.push({ type: "function_call_output", call_id: fc.callId, output: JSON.stringify(result) });
        if (fc.name === "finalize_listing" && (result as { listing?: ListingDraft })?.listing) final = (result as { listing: ListingDraft }).listing;
      }
      if (final || iteration === MAX_ITERATIONS) break;
      resp = await call({ model: MODELS.spark, previous_response_id: responseId(resp), tools: specs, tool_choice: "auto", input: pending });
      pending = [];
    }

    if (!final) {
      const forced = await call({
        model: MODELS.spark,
        previous_response_id: responseId(resp),
        input: [...pending, userMessage([{ type: "input_text", text: "Return the final listing now as JSON." }])],
        text: strictFormat("listing", LISTING_SCHEMA),
      });
      final = normalizeListing(parseJsonOutput(forced), ctx.productType);
      steps.push({ step: steps.length + 1, text: "Final listing (forced JSON)", result: final });
    }
    return { listing: final, trace: steps };
  }
}
