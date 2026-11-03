import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/pipeline/public", () => ({ placeOrder: async () => null, sendReply: async () => null, tap: async () => null }));
// No query may pick a story tag (a real buyer's order): the query module is empty, so any call throws.
vi.mock("@/lib/db/queries", () => ({}));

const { getDemoStoryTagHref, STORY_TAG_FALLBACK_HREF } = await import("@/lib/db/queries.contract");
const { HowSteps, STORY_TAG_FALLBACK, StoryTagCta } = await import("@/components/shop/HowSteps");
const { PaysArtistNote } = await import("@/components/product/ProductParts");
const { m } = await import("@/components/messages");
const { DEFAULT_SPLIT, splitPercents } = await import("@/lib/split");
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const text = (out: string) => out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");

describe("T128: claims a judge can check", () => {
  it("the hero trust line states the rule, not a payout", () => {
    expect(m.shop.heroTrust).toBe("By default, half of every sale goes to the artist.");
    expect(JSON.stringify(m)).not.toContain("pays the artist directly");
  });

  it("the product page shows the maker's split under the pays-the-artist note, from the split (default 50/30/20)", () => {
    const out = text(html(createElement(PaysArtistNote, { name: "Leo", type: "sticker", split: { ...DEFAULT_SPLIT } })));
    expect(out).toContain("Leo earns from every sticker sold.");
    expect(out.indexOf("earns from every sticker sold")).toBeLessThan(out.indexOf("50% artist · 30% studio · 20% production"));
    expect(text(html(createElement(PaysArtistNote, { name: "Maya", type: "tote", split: { creator_bps: 6000, org_bps: 2500, production_bps: 1500 } }))))
      .toContain("60% artist · 25% studio · 15% production");
    expect(splitPercents(null)).toEqual({ artist: 50, studio: 30, production: 20 });
    // a partial split never mixes with the default (60 + 30 + 20 would be 110 %): the whole default is shown
    expect(splitPercents({ creator_bps: 6000 })).toEqual({ artist: 50, studio: 30, production: 20 });
    // /how-it-works promises it
    expect(m.how.earn).toContain("The share is shown on every product page.");
  });

  it("See a story tag in action opens the demo tag only when DEMO_STORY_TAG_TOKEN is set, else How it works; no order is queried", async () => {
    const before = process.env.DEMO_STORY_TAG_TOKEN;
    try {
      process.env.DEMO_STORY_TAG_TOKEN = "ABCD2345EFGH";
      expect(await getDemoStoryTagHref()).toBe("/t/ABCD2345EFGH");
      delete process.env.DEMO_STORY_TAG_TOKEN;
      expect(await getDemoStoryTagHref()).toBe("/how-it-works#story-tags");
      process.env.DEMO_STORY_TAG_TOKEN = "not a token!";
      expect(await getDemoStoryTagHref()).toBe("/how-it-works#story-tags");
    } finally {
      if (before === undefined) delete process.env.DEMO_STORY_TAG_TOKEN; else process.env.DEMO_STORY_TAG_TOKEN = before;
    }
    expect(STORY_TAG_FALLBACK).toBe(STORY_TAG_FALLBACK_HREF);
    expect(html(createElement(HowSteps, { cta: createElement(StoryTagCta, { href: "/t/ABCD2345EFGH" }) }))).toContain('href="/t/ABCD2345EFGH"');
    expect(html(createElement(HowSteps))).toContain('href="/how-it-works#story-tags"');
  });

  it("the accessibility page describes how captions are made instead of promising every video has them", () => {
    expect(m.a11y.captions).toBe("Captions: story videos are captioned automatically with Muse Voice Transcribe when they are uploaded.");
  });
});
