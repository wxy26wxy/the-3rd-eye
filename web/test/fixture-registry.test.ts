import { describe, expect, it } from "vitest";
import { fixtureRegistry } from "@/lib/ai/fixtures";
import { pngRef } from "@/lib/image/ref";

const trace = { stage: "test" };

describe("offline fixture registry (AI_FIXTURES=1)", () => {
  it("runs shape → generate → segment → describe → listing → story without keys", async () => {
    const ai = fixtureRegistry();
    const shaped = await ai.shaper.shape("a happy frog", { product: "sticker", trace });
    expect(shaped.clarifying_question).toBeNull();
    const [img] = await ai.image.generate(shaped.prompt, { n: 1, trace });
    expect(img.png.length).toBeGreaterThan(1000);
    const segs = await ai.segmenter.findAll(pngRef(img.png), "frog", { trace });
    expect(segs.length).toBeGreaterThanOrEqual(1);
    const d = await ai.describer.describe(pngRef(img.png), { prompt: shaped.prompt, trace });
    expect(d.alt_text.length).toBeLessThanOrEqual(125);
    const { listing, trace: steps } = await ai.listingAgent.run({
      productId: "p", productType: "tote", altText: d.alt_text, imageUrl: "", width: 1024, height: 1024, creatorShareBps: 5000,
    }, { trace });
    expect(listing.price_cents).toBeGreaterThanOrEqual(2200);
    expect(listing.print_ok).toBe(false);
    expect(steps.at(-1)?.tool).toBe("finalize_listing");
    const mock = await ai.image.compose("p", [pngRef(img.png), pngRef(img.png)], { trace });
    expect(mock.width).toBe(1024);
    expect((await ai.story.draftStory("I paint birds.", { mentionDisability: false, trace })).provider).toBe("meta-fallback");
    expect((await ai.captioner.caption(Buffer.alloc(0), { filename: "v.mp4", trace })).vtt.startsWith("WEBVTT")).toBe(true);
  });
});
