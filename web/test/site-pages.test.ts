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
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BuyForm } from "@/components/product/BuyForm";
import { DieCut } from "@/components/site/DieCut";
import { Avatar, initials } from "@/components/site/Avatar";
import { Thread } from "@/components/storytag/Thread";
import { ThankYou } from "@/components/storytag/ThankYou";
import { NoteForm } from "@/components/storytag/NoteForm";

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

describe("Nav, drawer and footer (T106, 2010:467 / 2032:4004 / 2010:504)", () => {
  it("nav: wordmark link, labelled nav with four links, Menu button controlling a modal drawer", () => {
    const out = html(createElement(SiteNav));
    expect(out).toContain(`aria-label="${m.nav.home}"`);
    expect(out).toMatch(new RegExp(`<button[^>]*aria-expanded="false"[^>]*aria-controls="nav-drawer"[^>]*>.*${m.nav.menu}</button>`));
    expect(out).toMatch(/<dialog[^>]*id="nav-drawer"/);
    const drawer = out.slice(out.indexOf("<dialog"));
    expect(drawer).toContain(`>${m.common.close}</button>`);
    for (const l of [m.nav.shop, m.nav.artists, m.nav.howItWorks, m.nav.forStudios]) expect(drawer).toContain(l);
  });

  it("footer: contentinfo with the white wordmark, tagline and five links", () => {
    const out = html(createElement(SiteFooter));
    expect(out).toMatch(/<footer/);
    expect(out).toMatch(/class="[^"]*wordmarkWhite/);
    expect(out).toContain(m.footer.tagline);
    expect(out).toContain(`aria-label="${m.footer.label}"`);
    expect(out.match(/<li>/g)).toHaveLength(5);
    expect(out).toContain('href="/how-it-works#story-tags"');
  });
});

describe("Product page parts (T106, board 2019:2004)", () => {
  it("buy form: fields in board order, demo line above the primary submit", () => {
    const out = html(createElement(BuyForm, { action: async () => ({}), priceLabel: "Buy for $5.00" }));
    const order = [m.product.buyTitle, m.product.buyName, m.product.buyEmail, m.product.buyEmailHint, m.product.buyNote, m.product.buyStaged, "Buy for $5.00"].map((t) => out.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(out).toMatch(/<button type="submit"/);
    expect(out).not.toContain('role="alert"');
  });

  it("die-cut preview: titled card, labelled svg, caption", () => {
    const out = html(createElement(DieCut, { artworkUrl: "/a.png", cutPathSvg: "M0 0L10 10", alt: "Bus on a Sticker" }));
    expect(out).toContain('role="img" aria-label="Bus on a Sticker"');
    expect(out).toContain(m.product.dieCutCaption);
    expect(html(createElement(DieCut, { artworkUrl: null, cutPathSvg: null, alt: "x" }))).toBe("");
  });

  it("avatar: two initials on the accent, decorative", () => {
    expect(initials("Rosa M.")).toBe("RM");
    expect(initials("Leo")).toBe("L");
    expect(html(createElement(Avatar, { name: "Rosa M.", src: null, size: "l" }))).toMatch(/aria-hidden="true">RM</);
  });
});

describe("Story tag parts (T106, board 2024:2428)", () => {
  it("thread: sender line above each bubble, mine and theirs", () => {
    const out = html(createElement(Thread, { name: "Rosa M.", messages: [
      { id: "1", direction: "buyer_to_creator", body: "Thank you!", createdAt: new Date("2026-10-30T15:45:00Z") },
      { id: "2", direction: "creator_to_buyer", body: "So happy!", createdAt: new Date("2026-10-30T17:10:00Z") },
    ] }));
    expect(out).toMatch(new RegExp(`<li class="[^"]*mine[^"]*"><p[^>]*>${m.tag.fromYou} · <time`));
    expect(out).toMatch(/<\/time><\/p><p class="[^"]*bubble[^"]*">Thank you!<\/p>/);
    expect(out).toMatch(/<li class="[^"]*theirs[^"]*"><p[^>]*>Rosa M\. · /);
    expect(html(createElement(Thread, { name: "Rosa M.", messages: [] }))).toContain(m.tag.threadEmpty);
  });

  it("thank-you: the title is the card's h2 eyebrow; green only once there is a thank-you", () => {
    const sent = html(createElement(ThankYou, { name: "Rosa M.", token: "tok", thankYou: { text: "Thanks!", imageUrl: null, videoUrl: null, videoVtt: null } }));
    expect(sent).toMatch(new RegExp(`<h2 id="thanks-title" class="[^"]*">${fmt(m.tag.thankYouTitle, { name: "Rosa M." })}</h2>`));
    expect(sent).toMatch(/class="[^"]*thanksGreen/);
    const empty = html(createElement(ThankYou, { name: "Rosa M.", token: "tok", thankYou: null }));
    expect(empty).toContain(fmt(m.tag.thankYouEmpty, { name: "Rosa M." }));
    expect(empty).not.toMatch(/thanksGreen/);
  });

  it("note form: labelled field with the hint under it, Send note primary", () => {
    const out = html(createElement(NoteForm, { action: async () => ({}), name: "Rosa M." }));
    expect(out).toContain(fmt(m.tag.noteLabel, { name: "Rosa M." }));
    expect(out.indexOf("<textarea")).toBeLessThan(out.indexOf(m.tag.noteHint));
    expect(out).toMatch(new RegExp(`<button type="submit"[^>]*>.*${m.tag.noteSubmit}`));
  });
});
