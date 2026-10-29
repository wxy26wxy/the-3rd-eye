import { describe, expect, it } from "vitest";
import { GlimmerStoryWriter, nativeOllamaUrl, parseGlimmerJson } from "@/lib/ai/meta/story";
import type { ResponsesLike } from "@/lib/ai/meta/client";

const story = { headline: "H", bio_short: "B", story_text: "S" };
const trace = { stage: "story" };
const spark = (calls: unknown[]): (() => ResponsesLike) => () => ({
  create: async (b) => { calls.push(b); return { id: "r", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(story) }] }] }; },
});

describe("Glimmer story writer", () => {
  it("derives the native endpoint and strips the <|eot|> token", () => {
    expect(nativeOllamaUrl("http://localhost:11434/v1")).toBe("http://localhost:11434/api");
    expect(nativeOllamaUrl("http://box:11434/v1/")).toBe("http://box:11434/api");
    expect(parseGlimmerJson('{"a":1}<|eot|>\n')).toEqual({ a: 1 });
  });

  it("uses the native Ollama endpoint first", async () => {
    const w = new GlimmerStoryWriter("ollama", { native: async () => ({ message: { content: `${JSON.stringify(story)}<|eot|>` } }) });
    expect(await w.draftStory("t", { mentionDisability: false, trace })).toEqual({ ...story, provider: "ollama" });
  });

  it("falls back to /v1 then to Spark with provider meta-fallback", async () => {
    const sparkCalls: unknown[] = [];
    const w = new GlimmerStoryWriter("ollama", {
      native: async () => { throw new Error("ECONNREFUSED"); },
      chat: () => ({ create: (async () => ({ choices: [{ message: { content: "" } }] })) as never }),
      responses: spark(sparkCalls),
    });
    expect(await w.draftStory("t", { mentionDisability: false, trace })).toEqual({ ...story, provider: "meta-fallback" });
    expect(sparkCalls).toHaveLength(1);
  });

  it("AI_STORY=meta goes straight to Spark", async () => {
    const sparkCalls: unknown[] = [];
    const w = new GlimmerStoryWriter("meta", { native: async () => { throw new Error("should not be called"); }, responses: spark(sparkCalls) });
    expect((await w.draftStory("t", { mentionDisability: true, trace })).provider).toBe("meta-fallback");
  });
});
