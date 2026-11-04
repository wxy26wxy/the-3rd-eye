import { describe, expect, it } from "vitest";
import { GlimmerStoryWriter, nativeOllamaUrl, parseGlimmerJson, rejectEcho, storyInstructions, thankYouInstructions } from "@/lib/ai/meta/story";
import type { ResponsesLike } from "@/lib/ai/meta/client";

const story = { headline: "H", bio_short: "B", story_text: "S" };
const genuine = {
  headline: "Painting the river I love",
  bio_short: "I paint slowly, a little every morning.",
  story_text: "I started painting after a long winter indoors. Every morning I sit by the window with my brushes and paint the river as I remember it. It is slow work, and I like that. Each piece takes me weeks, and I never hurry it along.",
};
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
    const w = new GlimmerStoryWriter("ollama", { native: async () => ({ message: { content: `${JSON.stringify(genuine)}<|eot|>` } }) });
    expect(await w.draftStory("t", { mentionDisability: false, trace })).toEqual({ ...genuine, provider: "ollama" });
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

describe("echoed instructions (T152)", () => {
  const echo = { headline: "At most 8 words.", bio_short: "One sentence, at most 140 characters.", story_text: "60–140 words, plain language." };
  const writer = (answer: unknown, sparkCalls: unknown[]) => new GlimmerStoryWriter("ollama", {
    native: async () => ({ message: { content: JSON.stringify(answer) } }),
    chat: () => ({ create: (async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }] })) as never }),
    responses: spark(sparkCalls),
  });

  it("falls back to Spark when the answer is the instruction sentences", async () => {
    const calls: unknown[] = [];
    const out = await writer(echo, calls).draftStory("t", { mentionDisability: false, trace });
    expect(out.provider).toBe("meta-fallback");
    expect(calls).toHaveLength(1);
  });

  it("falls back when story_text has 12 words", async () => {
    const calls: unknown[] = [];
    const short = { ...genuine, story_text: "I paint the river every morning before the town wakes up." + " Yes" };
    expect(short.story_text.split(/\s+/)).toHaveLength(12);
    expect((await writer(short, calls).draftStory("t", { mentionDisability: false, trace })).provider).toBe("meta-fallback");
    expect(calls).toHaveLength(1);
  });

  it("keeps a genuine answer without calling Spark", async () => {
    const calls: unknown[] = [];
    expect(await writer(genuine, calls).draftStory("t", { mentionDisability: false, trace })).toEqual({ ...genuine, provider: "ollama" });
    expect(calls).toHaveLength(0);
  });

  it("rejectEcho: substring match is case-insensitive and trimmed", () => {
    const system = storyInstructions(false);
    expect(() => rejectEcho({ ...genuine, headline: "  AT MOST 8 WORDS.  " }, system)).toThrow(/instructions/);
    expect(() => rejectEcho({ ...genuine, bio_short: "one sentence, at most 140 characters." }, system)).toThrow(/instructions/);
    expect(() => rejectEcho(genuine, system)).not.toThrow();
  });

  it("rejectEcho: a field equal to its own name is rejected", () => {
    expect(() => rejectEcho({ ...genuine, headline: "Headline" }, "x")).toThrow(/instructions/);
    expect(() => rejectEcho({ ...genuine, bio_short: " bio_short " }, "x")).toThrow(/instructions/);
  });

  it("rejectEcho: a thank-you that copies the instruction is rejected", () => {
    const system = thankYouInstructions({ buyerName: "Sam", productTitle: "River" });
    expect(() => rejectEcho({ text: "first person; 1–3 warm sentences; no emojis unless the artist used them." }, system)).toThrow(/instructions/);
    expect(() => rejectEcho({ text: "Thank you so much, Sam. I am glad River found a home with you." }, system)).not.toThrow();
  });

  it("rejectEcho: the schema text counts as prompt text", () => {
    expect(() => rejectEcho({ ...genuine, headline: "additionalProperties" }, 'x\n{"additionalProperties":false}')).toThrow(/instructions/);
  });
});

describe("hardTimeout", () => {
  it("gives up on a call that ignores its abort signal", async () => {
    const { hardTimeout } = await import("@/lib/ai/meta/story");
    const never = new Promise<string>(() => undefined);
    await expect(hardTimeout(never, 20, "stuck call")).rejects.toThrow(/stuck call timed out/);
    await expect(hardTimeout(Promise.resolve("ok"), 20, "fast")).resolves.toBe("ok");
  });
});
