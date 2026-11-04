/**
 * Story and thank-you drafts on the open-weight Muse Glimmer model (`muse-glimmer`) via Ollama.
 * The schema goes in the system prompt; output is validated with zod. Attempts, 30 s each:
 *   1. native `POST <OLLAMA_BASE_URL minus /v1>/api/chat` with think:false, `format` = the JSON
 *      Schema (structured outputs), num_predict 700 — fast; the reply ends with a literal `<|eot|>` that is stripped;
 *   2. OpenAI-compatible `/v1/chat/completions` with response_format json_object,
 *      max_tokens 1500 (the model spends 100–300 tokens on `message.reasoning` before content)
 *      and reasoning_effort "low";
 *   3. Muse Spark 1.3 strict JSON, reported as `provider: "meta-fallback"` (always on Vercel).
 */
import "server-only";
import { z } from "zod";
import type OpenAI from "openai";
import type { StoryDraft, StoryWriter, Trace } from "../types";
import { traced } from "../trace";
import { MODELS, OLLAMA_DEFAULT_BASE_URL, metaResponses, ollamaClient, type ResponsesLike } from "./client";
import { callSignal } from "@/lib/deadline";
import { obj, parseJsonOutput, str, strictFormat, type JsonSchema } from "./responses";

const STORY = z.object({ headline: z.string().min(1), bio_short: z.string().min(1), story_text: z.string().min(1) });
const THANKS = z.object({ text: z.string().min(1) });
const STORY_SCHEMA = obj({ headline: str(), bio_short: str(), story_text: str() });
const THANKS_SCHEMA = obj({ text: str() });

type Provider = StoryDraft["provider"];
type ChatLike = Pick<OpenAI["chat"]["completions"], "create">;
type NativeChat = (body: Record<string, unknown>) => Promise<{ message?: { content?: string } }>;

/** `http://host:11434/v1` → `http://host:11434/api`. */
export function nativeOllamaUrl(base = process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_BASE_URL): string {
  return `${base.replace(/\/+$/, "").replace(/\/v1$/, "")}/api`;
}

/** Strips the trailing `<|eot|>` token (and code fences) Glimmer appends, then parses JSON. */
export function parseGlimmerJson(content: string): unknown {
  const cleaned = content.replace(/<\|eot\|>/g, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Rejects after `ms` even when the underlying request ignores its abort signal (seen live: a
 * `/v1` call with a 30 s timeout and signal ran for 15 minutes while Ollama was busy).
 */
export function hardTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms); });
  return Promise.race([p, expired]).finally(() => clearTimeout(timer));
}
const OLLAMA_MS = 30_000;

const defaultNative: NativeChat = async (body) => {
  const res = await fetch(`${nativeOllamaUrl()}/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: callSignal(OLLAMA_MS),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  return res.json();
};

export function storyInstructions(mentionDisability: boolean): string {
  return [
    "You help an artist write the short story shown next to their art in an online shop.",
    "Use only facts from the transcript; do not add places, objects, feelings or events the artist did not mention. Keep the artist's own words and voice; write in the first person.",
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

/**
 * The local model sometimes answers the instructions instead of the task (seen live, T152:
 * `{"headline":"At most 8 words.", …}`). Throws when any field, trimmed and case-insensitive, is
 * a piece of the prompt (instructions plus appended JSON Schema), equals its own field name, or
 * when `story_text` is under 20 words; `draft()` then falls back to Spark.
 */
export function rejectEcho(value: Record<string, string>, systemPrompt: string): void {
  const prompt = systemPrompt.toLowerCase();
  for (const [name, raw] of Object.entries(value)) {
    const text = raw.trim().toLowerCase();
    const tooShort = name === "story_text" && text.split(/\s+/).filter(Boolean).length < 20;
    if (!text || text === name.toLowerCase() || prompt.includes(text) || tooShort) throw new Error("ollama answered the instructions, not a story");
  }
}

export class GlimmerStoryWriter implements StoryWriter {
  constructor(
    private mode: "ollama" | "meta" = "ollama",
    private deps: { native?: NativeChat; chat?: () => ChatLike; responses?: () => ResponsesLike } = {},
  ) {}

  private chat(): ChatLike {
    return this.deps.chat ? this.deps.chat() : ollamaClient().chat.completions;
  }

  private async viaOllama<T>(stage: string, system: string, user: string, schema: JsonSchema, validator: z.ZodType<T>, trace: Trace): Promise<T> {
    const systemPrompt = `${system}\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(schema)}`;
    const parse = (content: string): T => {
      const value = validator.parse(parseGlimmerJson(content));
      rejectEcho(value as Record<string, string>, systemPrompt);
      return value;
    };
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: user },
    ];
    // `format` as the JSON Schema (Ollama structured outputs): with plain "json" Glimmer often answered `{}` (live, 2026-10-29).
    const native = { model: MODELS.glimmer, messages, think: false, stream: false, format: schema, options: { num_predict: 700 } };
    try {
      return await traced(stage, "ollama", MODELS.glimmer, native, async () => {
        const res = await hardTimeout((this.deps.native ?? defaultNative)(native), OLLAMA_MS + 2_000, "ollama native");
        return parse(res.message?.content ?? "");
      }, trace);
    } catch (err) {
      console.warn("[story] Ollama native endpoint failed, retrying via /v1:", err instanceof Error ? err.message : err);
    }
    const compat = { model: MODELS.glimmer, messages, response_format: { type: "json_object" as const }, max_tokens: 1500, reasoning_effort: "low" as const };
    return traced(stage, "ollama", MODELS.glimmer, compat, async () => {
      const res = await hardTimeout(this.chat().create(compat, { timeout: OLLAMA_MS, signal: callSignal(OLLAMA_MS) }), OLLAMA_MS + 2_000, "ollama /v1");
      return parse(res.choices?.[0]?.message?.content ?? "");
    }, trace);
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
