/**
 * Offline registry (AI_FIXTURES=1): SYNTHETIC, deterministic results (procedural art, threshold
 * segmentation, templated text) so tests, local dev and a deployment without keys exercise every
 * pipeline. It does not replay recorded API responses: the live recordings in
 * `test/fixtures/<stage>/probe*` (written by scripts/probe_meta.ts) are used by unit tests that
 * parse real response shapes (e.g. test/sam.test.ts). Calls are traced with provider "fixture".
 */
import "server-only";
import sharp from "sharp";
import type { Registry } from "./registry";
import type { Description, GeneratedImage, ListingDraft, Segment, ShapedPrompt, StoryDraft } from "./types";
import { requestHash, traced } from "./trace";
import { placeholderArt } from "@/lib/image/placeholder";
import { loadImageRef } from "@/lib/image/ref";
import { thresholdSegments } from "@/lib/image/mask";
import { checkResolution } from "./meta/tools/check-resolution";
import { suggestPrice } from "./meta/tools/suggest-price";
import { normalizeListing } from "./meta/tools/finalize-listing";
import { cuesToVtt, estimateCues } from "./meta/captions";
import { pickByHint } from "./meta/sam";

function fx<T>(stage: string, key: unknown, make: () => Promise<T> | T): Promise<T> {
  return traced(stage, "fixture", "fixture", key, async () => make());
}

async function art(seed: string): Promise<GeneratedImage> {
  const png = await placeholderArt(seed);
  return { png, responseId: `fixture_${requestHash(seed).slice(0, 12)}`, width: 1024, height: 1024 };
}

export function fixtureRegistry(): Registry {
  return {
    transcribe: {
      transcribe: (_audio, opts) => fx("transcribe", { filename: opts.filename }, () => ({
        text: "A happy green frog wearing a tiny gold crown, sitting on a lily pad.", language: "en",
      })),
    },
    shaper: {
      shape: (transcript, opts) => fx<ShapedPrompt>("shape", { transcript, answers: opts.answers ?? [], product: opts.product }, () => ({
        prompt: `${transcript.trim().replace(/\.$/, "")}. Sticker illustration, single subject, bold outlines, flat colors, pure white background, no text.`,
        style_notes: "Bold outlines, flat colors, white background.",
        clarifying_question: null,
        spoken_confirmation: `Okay! I'll draw ${transcript.trim().replace(/\.$/, "")}.`,
      })),
    },
    image: {
      generate: async (prompt, opts) => Promise.all(Array.from({ length: Math.max(1, Math.min(4, opts.n)) }, (_, i) =>
        traced("generate", "fixture", "fixture", { prompt, i }, () => art(`${prompt}#${i}`), opts.trace))),
      refine: (responseId, instruction, opts) =>
        traced("refine", "fixture", "fixture", { responseId, instruction }, () => art(`${responseId}:${instruction}`), opts.trace),
      compose: (prompt, refs, opts) => traced("mockup", "fixture", "fixture", { prompt, refs: refs.length }, async () => {
        const { localMockup } = await import("./meta/mockup");
        const first = await loadImageRef(refs[0]);
        const png = await localMockup(refs.length > 1 ? "tote" : "sticker", first);
        return { png, responseId: "fixture_mockup", width: 1024, height: 1024 };
      }, opts.trace),
    },
    segmenter: {
      findAll: (image, phrase, opts) => traced("segment", "fixture", "threshold", { phrase }, async () =>
        (await thresholdSegments(await loadImageRef(image))).map((s): Segment => ({ ...s, svgPath: "" })), opts.trace),
      segment: (image, hint, opts) => traced("segment", "fixture", "threshold", hint, async () =>
        pickByHint((await thresholdSegments(await loadImageRef(image))).map((s): Segment => ({ ...s, svgPath: "" })), hint), opts.trace),
    },
    describer: {
      describe: (image, opts) => fx<Description>("describe", { prompt: opts.prompt ?? null }, async () => {
        const stats = await sharp(await loadImageRef(image)).stats();
        const d = stats.dominant;
        return {
          alt_text: opts.prompt ? `Sticker art: ${opts.prompt.split(".")[0]}`.slice(0, 125) : "Hand-drawn artwork cut out as a sticker",
          spoken: opts.prompt
            ? `This is ${opts.prompt.split(".")[0].toLowerCase()}, drawn with bold outlines and flat colors on white.`
            : "This is your drawing, cut out cleanly with a white border.",
          dominant_colors: [`rgb(${d.r}, ${d.g}, ${d.b})`],
          subject: (opts.prompt ?? "drawing").split(".")[0].slice(0, 60),
          differences_from_prompt: "",
        };
      }),
    },
    listingAgent: {
      moderate: (text, opts) => traced("moderate", "fixture", "fixture", text, async () => ({ ok: true, reason: "Offline mode: not checked by a model." }), opts.trace),
      run: async (ctx, opts) => traced("listing", "fixture", "fixture", { productId: ctx.productId }, async () => {
        const res = checkResolution(ctx);
        const price = suggestPrice(ctx.productType, "medium", ctx.creatorShareBps);
        const subject = ctx.altText.replace(/^Sticker art:\s*/i, "").slice(0, 40) || "Original artwork";
        const listing: ListingDraft = normalizeListing({
          title: subject.charAt(0).toUpperCase() + subject.slice(1),
          description: `${ctx.altText}. Made by an artist and printed when you order. Every piece comes with a story tag.`,
          tags: [ctx.productType, "original art", "story tag"],
          price_cents: price.price_cents, print_ok: res.ok, notes: res.ok ? "" : res.message,
        }, ctx.productType);
        return {
          listing,
          trace: [
            { step: 1, tool: "check_resolution", args: {}, result: res },
            { step: 2, tool: "suggest_price", args: { complexity: "medium" }, result: price },
            { step: 3, tool: "finalize_listing", args: listing, result: { ok: true, listing } },
          ],
        };
      }, opts.trace),
    },
    story: {
      draftStory: (transcript, opts) => fx<StoryDraft>("story", { transcript, mentionDisability: opts.mentionDisability }, () => ({
        headline: "Art from my own hands",
        bio_short: transcript.split(/[.!?]/)[0].slice(0, 140) || "An artist who loves to make things.",
        story_text: transcript.trim() || "I make art because it makes me happy.",
        provider: "meta-fallback",
      })),
      draftThankYou: (transcript, ctx) => fx("story", { transcript, ...ctx }, () => ({
        text: `Thank you so much, ${ctx.buyerName}! I hope "${ctx.productTitle}" makes you smile. ${transcript}`.trim(),
        provider: "meta-fallback" as const,
      })),
    },
    moderator: {
      // Offline: blocks only an explicit test marker so the rejection path can be exercised.
      checkNote: (text, opts) => traced("moderate", "fixture", "fixture", { text }, async () => (
        /\bblocked-note-test\b/i.test(text) ? { ok: false, reason: "Test marker" } : { ok: true, reason: "Offline mode: not checked by a model." }
      ), opts.trace),
    },
    captioner: {
      caption: (_video, opts) => fx("captions", { filename: opts.filename }, () => {
        const transcript = "Hi, I'm the artist. I made this for you, and I hope you love it.";
        return { transcript, vtt: cuesToVtt(estimateCues(transcript, 6)) };
      }),
    },
  };
}
