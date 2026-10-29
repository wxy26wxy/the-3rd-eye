/**
 * Story and thank-you drafts on the open-weight Muse Glimmer model through Ollama's
 * OpenAI-compatible endpoint (OLLAMA_BASE_URL, default http://localhost:11434/v1).
 * JSON via `response_format: { type: "json_object" }` with the schema in the system prompt,
 * validated with zod; 30 s timeout, 1 retry. When Ollama is unreachable or the output is
 * invalid (always the case on Vercel), falls back to Muse Spark 1.3 strict JSON and reports
 * `provider: "meta-fallback"`. UNVERIFIED: Ollama path (not reachable during the build).
 */
import "server-only";
import { z } from "zod";
import type OpenAI from "openai";
import type { StoryDraft, StoryWriter, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, metaResponses, ollamaClient, type ResponsesLike } from "./client";
import { obj, parseJsonOutput, str, strictFormat, type JsonSchema } from "./responses";

const STORY = z.object({ headline: z.string().min(1), bio_short: z.string().min(1), story_text: z.string().min(1) });
const THANKS = z.object({ text: z.string().min(1) });
const STORY_SCHEMA = obj({ headline: str(), bio_short: str(), story_text: str() });
const THANKS_SCHEMA = obj({ text: str() });

type Provider = StoryDraft["provider"];
type ChatLike = Pick<OpenAI["chat"]["completions"], "create">;

export function storyInstructions(mentionDisability: boolean): string {
  return [
    "You help an artist write the short story shown next to their art in an online shop.",
    "Use only facts from the transcript. Keep the artist's own words and voice; write in the first person.",
    "headline: at most 8 words. bio_short: one sentence, at most 140 characters. story_text: 60–140 words, plain language.",
    mentionDisability
      ? "The artist chose to mention their disability: include it only as they described it, respectfully, never as the main point."
      : "Do NOT mention disability, diagnosis, or support needs, even if the transcript does.",
  ].join("\n");
}

export function thankYouInstructions(ctx: { buyerName: string; productTitle: string }): string {
  return [
    `Write a short thank-you note from the artist to ${ctx.buyerName}, who bought "${ctx.productTitle}".`,
    "Use the artist's own words from the transcript; first person; 1–3 warm sentences; no emojis unless the artist used them.",
  ].join("\n");
}

export class GlimmerStoryWriter implements StoryWriter {
  constructor(
    private mode: "ollama" | "meta" = "ollama",
    private deps: { chat?: () => ChatLike; responses?: () => ResponsesLike; sleep?: (ms: number) => Promise<void> } = {},
  ) {}

  private chat(): ChatLike {
    return this.deps.chat ? this.deps.chat() : ollamaClient().chat.completions;
  }

  private async viaOllama<T>(stage: string, system: string, user: string, schema: JsonSchema, validator: z.ZodType<T>, trace: Trace): Promise<T> {
    const body = {
      model: MODELS.glimmer,
      response_format: { type: "json_object" as const },
      messages: [
        { role: "system" as const, content: `${system}\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}` },
        { role: "user" as const, content: user },
      ],
    };
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await traced(stage, "ollama", MODELS.glimmer, body, async () => {
          const res = await this.chat().create(body, { timeout: 30_000 });
          const content = res.choices?.[0]?.message?.content ?? "";
          return validator.parse(JSON.parse(content));
        }, trace);
      } catch (err) {
        lastErr = err;
        if (attempt === 0) await sleep(500);
      }
    }
    throw lastErr;
  }

  private async viaSpark<T>(stage: string, system: string, user: string, name: string, schema: JsonSchema, validator: z.ZodType<T>, trace: Trace): Promise<T> {
    const responses = this.deps.responses ? this.deps.responses() : metaResponses();
    const body = { model: MODELS.spark, instructions: system, input: user, reasoning: { effort: "low" }, text: strictFormat(name, schema) };
    const resp = await traced(stage, "meta-fallback", MODELS.spark, body, () => responses.create(body), trace);
    return validator.parse(parseJsonOutput(resp));
  }

  private async draft<T>(stage: string, system: string, user: string, name: string, schema: JsonSchema, validator: z.ZodType<T>, trace: Trace): Promise<{ value: T; provider: Provider }> {
    if (this.mode === "ollama") {
      try {
        return { value: await this.viaOllama(stage, system, user, schema, validator, trace), provider: "ollama" };
      } catch (err) {
        console.warn("[story] Ollama unavailable or invalid, falling back to Spark:", err instanceof Error ? err.message : err);
      }
    }
    return { value: await this.viaSpark(stage, system, user, name, schema, validator, trace), provider: "meta-fallback" };
  }

  async draftStory(transcript: string, opts: { mentionDisability: boolean; trace: Trace }): Promise<StoryDraft> {
    const { value, provider } = await this.draft("story", storyInstructions(opts.mentionDisability), `Transcript:\n${transcript}`, "story", STORY_SCHEMA, STORY, opts.trace);
    return { ...value, provider };
  }

  async draftThankYou(transcript: string, ctx: { buyerName: string; productTitle: string }, opts: { trace: Trace }): Promise<{ text: string; provider: Provider }> {
    const { value, provider } = await this.draft("story", thankYouInstructions(ctx), `Transcript:\n${transcript}`, "thank_you", THANKS_SCHEMA, THANKS, opts.trace);
    return { text: value.text, provider };
  }
}
