import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import type { ShopProduct } from "@/lib/db/queries.contract";
import { ProductCard } from "@/components/site/ProductCard";
import { FilterTabs } from "@/components/site/FilterTabs";
import { Hero } from "@/components/shop/Hero";
import { HowSteps } from "@/components/shop/HowSteps";
import { StoryVideo } from "@/components/site/StoryVideo";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const product = {
  id: "p1", type: "sticker", title: "Reading Monster Sticker", description: null, priceCents: 500,
  mockupUrl: "https://blob.example/mock.png", artworkUrl: null, cutPathSvg: null, altText: null, madeByVoice: true,
  creator: { id: "c1", slug: "rosa", displayName: "Rosa M.", studioName: "Sunny Studio" },
} as unknown as ShopProduct;

describe("Shop (T106, boards 2018:1789 / 2018:1970)", () => {
  it("hero: decorative static photo, eyebrow outside the h1, white primary then secondary", () => {
    const out = html(createElement(Hero));
    expect(out).toContain(`src="${ASSETS.heroSky}" alt=""`);
    expect(out).not.toMatch(/<video|autoplay/i);
    expect(out).toMatch(new RegExp(`<p[^>]*>${m.shop.heroEyebrow}</p><h1[^>]*id="hero-title"[^>]*>${m.shop.heroTitle}</h1>`));
    expect(out.indexOf(m.shop.ctaShop)).toBeLessThan(out.indexOf(m.shop.ctaHow));
    expect(out).toContain('href="#collection"');
    expect(out).toContain('href="#how"');
  });

  it("product card: title link is the name, chips, artist before price, default alt", () => {
    const out = html(createElement(ProductCard, { product }));
    expect(out).toMatch(/<article[^>]*>.*<h3[^>]*><a[^>]*href="\/p\/p1"[^>]*>Reading Monster Sticker<\/a><\/h3>/);
    expect(out).toContain(m.common.sticker);
    expect(out).toContain(m.common.madeByVoice);
    expect(out.indexOf(fmt(m.common.by, { name: "Rosa M." }))).toBeLessThan(out.indexOf("$5.00"));
    expect(out).toContain(`alt="${fmt(m.product.mockupAlt, { title: product.title, type: m.common.sticker })}"`);
  });

  it("filter tabs: links in a labelled nav, the active one has aria-current and the check", () => {
    const out = html(createElement(FilterTabs, { active: "voice" }));
    expect(out).toContain(`aria-label="${m.shop.filtersLabel}"`);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/aria-current="page"[^>]*><svg[^>]*aria-hidden="true"/);
    expect(out).toContain('href="/?type=voice#collection"');
  });

  it("how steps: visible Step n eyebrow inside each h3; the third card is the accent card", () => {
    const out = html(createElement(HowSteps));
    expect(out.match(/<h3/g)).toHaveLength(3);
    expect(out).toContain(fmt(m.shop.stepLabel, { n: 3 }));
    expect(out).toMatch(/<li class="[^"]*stepAccent[^"]*"><h3[^>]*><span[^>]*>Step 3/);
  });

  it("story video: captions track, native controls, decorative play circle", () => {
    const out = html(createElement(StoryVideo, { creator: { id: "c1", displayName: "Rosa M.", storyVideoUrl: "creators/c1/story-video/a.mp4", storyVideoVtt: "WEBVTT" }, tagToken: "tok" }));
    expect(out).toContain('src="/media/creators/c1/story-video/a.mp4?tag=tok"');
    expect(out).toContain('<track kind="captions" src="/captions/c1"');
    expect(out).toMatch(/<video[^>]*controls/);
    expect(out).toMatch(/<span class="[^"]*play[^"]*" aria-hidden="true">/);
    const none = html(createElement(StoryVideo, { creator: { id: "c1", displayName: "Rosa M.", storyVideoUrl: null, storyVideoVtt: null } }));
    expect(none).toContain(m.common.noVideo);
  });
});
