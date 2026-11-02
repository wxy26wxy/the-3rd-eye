import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { ASSETS } from "@/lib/assets";
import type { ShopProduct } from "@/lib/db/queries.contract";
import { ProductCard, toneAt } from "@/components/site/ProductCard";
import { FILTERS, FilterTabs } from "@/components/site/FilterTabs";
import { Hero, HeroChip } from "@/components/shop/Hero";
import { HowSteps, PhonePreview } from "@/components/shop/HowSteps";
import { MakerCard } from "@/components/shop/MeetArtist";
import { parseFilter } from "@/components/shop/Collection";
import { StoryVideo } from "@/components/site/StoryVideo";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { DieCut } from "@/components/site/DieCut";
import { Avatar, initials } from "@/components/site/Avatar";
import { Thread } from "@/components/storytag/Thread";
import { ThankYou } from "@/components/storytag/ThankYou";
import { NoteForm } from "@/components/storytag/NoteForm";
import { CreatorCard } from "@/components/site/CreatorCard";
import { StaticPage } from "@/components/pages/StaticPage";
import NotFound from "@/app/not-found";
import SiteNotFound from "@/app/(site)/not-found";
import type { CreatorSummary } from "@/lib/db/queries.contract";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const product = {
  id: "p1", type: "sticker", title: "Reading Monster Sticker", description: null, priceCents: 500,
  mockupUrl: "https://blob.example/mock.png", artworkUrl: "https://blob.example/art.png", cutPathSvg: null, altText: null, madeByVoice: true,
  creator: { id: "c1", slug: "rosa", displayName: "Rosa M.", studioName: "Sunny Studio" },
} as unknown as ShopProduct;

describe("Shop v3 (board 2018:1789)", () => {
  it("hero: eyebrow outside the h1, two-line title, primary then secondary, trust line, decorative photo card", () => {
    const out = html(createElement(Hero));
    expect(out).toMatch(/<img alt=""[^>]*>/);
    expect(out).toMatch(/<link rel="preload" as="image"[^>]*>/);
    expect(out).toContain(encodeURIComponent(ASSETS.heroSky));
    expect(out).not.toMatch(/<video|autoplay/i);
    expect(out).toMatch(new RegExp(`<p[^>]*>${m.shop.heroEyebrow.replace("&", "&amp;")}</p><h1[^>]*id="hero-title"[^>]*>${m.shop.heroTitle1} <span[^>]*>${m.shop.heroTitle2}</span></h1>`));
    expect(out.indexOf(m.shop.ctaShop)).toBeLessThan(out.indexOf(m.shop.ctaHow));
    expect(out).toContain('href="#collection"');
    expect(out).toContain('href="#how"');
    expect(out).toContain(m.shop.heroTrust);
    // Text sits on the page, never on the photo: the copy comes before the photo card and has no scrim panel.
    expect(out.indexOf(m.shop.heroCopy)).toBeLessThan(out.indexOf("<img"));
    expect(out).not.toMatch(/heroPanel|scrim/);
  });

  it("hero chip: the featured creator's page, or how story tags work without one", () => {
    const withCreator = html(createElement(HeroChip, { creator: { slug: "rosa", displayName: "Rosa M." } }));
    expect(withCreator).toMatch(/<a[^>]*href="\/c\/rosa"/);
    expect(withCreator).toContain(m.shop.heroChipTitle);
    expect(withCreator).toContain(fmt(m.shop.heroChipMeet, { name: "Rosa M." }));
    expect(withCreator).toMatch(/aria-hidden="true"><svg/);
    const none = html(createElement(HeroChip, { creator: null }));
    expect(none).toContain('href="/how-it-works#story-tags"');
    expect(none).toContain(m.shop.heroChipFallback);
  });

  it("product tile (Size=Tile 4006:4357): title link is the name, price on the title row, caption, decorative STORY TAG pill, no voice chip", () => {
    const out = html(createElement(ProductCard, { product, tone: "soft" }));
    expect(out).toMatch(/<article[^>]*>.*<h3[^>]*><a[^>]*href="\/p\/p1"[^>]*>Reading Monster Sticker<\/a><\/h3><p[^>]*>\$5\.00<\/p>/);
    expect(out).toMatch(new RegExp(`<span class="[^"]*tag[^"]*" aria-hidden="true">.*${m.product.storyTagShort}</span>`));
    expect(out).toContain(`>${m.common.sticker}</span> · Rosa M. · Sunny Studio`);
    expect(out).not.toMatch(/Made by voice/i);
    expect(out).toMatch(/class="[^"]*soft/);
    // A sticker shows its cutout (contained); the default alt names the piece.
    expect(out).toMatch(/<img src="https:\/\/blob\.example\/art\.png"[^>]*class="[^"]*cutout/);
    expect(out).toContain(`alt="${fmt(m.product.mockupAlt, { title: product.title, type: m.common.sticker })}"`);
    // A tote shows its mockup photo.
    const tote = html(createElement(ProductCard, { product: { ...product, type: "tote" } as ShopProduct }));
    expect(tote).toMatch(/<img src="https:\/\/blob\.example\/mock\.png"[^>]*class="[^"]*photo/);
  });

  it("tile tones cycle in board order", () => {
    expect([0, 1, 2, 3, 4].map(toneAt)).toEqual(["accent", "white", "soft", "alt", "accent"]);
  });

  it("filter tabs: All / Stickers / Tote bags in a labelled nav, no voice tab, the active one has aria-current and the check", () => {
    const out = html(createElement(FilterTabs, { active: "sticker" }));
    expect(out).toContain(`aria-label="${m.shop.filtersLabel}"`);
    expect(out.match(/<a /g)).toHaveLength(3);
    expect(FILTERS.map((f) => f.key)).toEqual(["all", "sticker", "tote"]);
    expect(out).not.toMatch(/voice/i);
    expect(out.match(/aria-current="page"/g)).toHaveLength(1);
    expect(out).toMatch(/<a aria-current="page"[^>]*href="\/\?type=sticker#collection"><svg[^>]*aria-hidden="true"/);
    expect(out).not.toContain("type=voice"); // "Made by voice" filter retired (T111)
  });

  it("parseFilter drops the retired voice filter", () => {
    expect(parseFilter("voice")).toBe("all");
    expect(parseFilter(["tote", "x"])).toBe("tote");
    expect(parseFilter(undefined)).toBe("all");
  });

  it("story tags band: eyebrow, two-line h2, numbered steps as an ordered list with h3s, CTA, hidden phone preview", () => {
    const out = html(createElement(HowSteps));
    expect(out).toMatch(/<section id="how" aria-labelledby="how-title"/);
    expect(out).toMatch(new RegExp(`<h2[^>]*id="how-title"[^>]*>${m.shop.bandTitle1} <span[^>]*>${m.shop.bandTitle2}</span></h2>`));
    expect(out).toMatch(/<ol[^>]*role="list"/);
    expect(out.match(/<h3/g)).toHaveLength(3);
    expect(out).toMatch(new RegExp(`<span class="[^"]*stepNum[^"]*" aria-hidden="true">1</span><div[^>]*><h3[^>]*>${m.shop.step1Title}</h3>`));
    expect(out).toContain('href="/how-it-works#story-tags"');
    expect(out).toContain(m.shop.bandCta);
    const preview = out.slice(out.indexOf('class="' + out.match(/class="([^"]*phone[^"]*)"/)![1]));
    expect(preview).toMatch(/^class="[^"]*" aria-hidden="true"/);
    expect(preview).not.toMatch(/<a |<button|tabindex="0"/);
  });

  it("phone preview shows the featured creator and their piece", () => {
    const out = html(createElement(PhonePreview, { name: "Rosa M.", studio: "Sunny Studio", bio: "I draw monsters.", product: { title: "Reading Monster", imageUrl: "/a.png", type: "tote" } }));
    expect(out).toContain(fmt(m.shop.previewProduct, { type: m.common.tote }));
    expect(out).toContain(fmt(m.shop.previewHi, { name: "Rosa M." }).replace("'", "&#x27;"));
    expect(out).toContain(`${m.shop.previewEyebrow} · Sunny Studio`);
    expect(out).toContain("Reading Monster");
  });

  it("maker card: the poster link's name starts with the visible Watch story and adds the maker; decorative initials, name, studio, method chip", () => {
    const out = html(createElement(MakerCard, { creator: { slug: "rosa", displayName: "Rosa M.", studioName: "Sunny Studio", isExample: false } }));
    expect(out).toMatch(new RegExp(`<a[^>]*href="/c/rosa"[^>]*>.*<span[^>]*>${m.shop.watchStory}<span class="visually-hidden">, Rosa M\\.</span></span>`));
    expect(out).not.toMatch(/<a[^>]*aria-label=/);
    expect(out).toMatch(/aria-hidden="true">RM</);
    expect(out).toMatch(/<h3[^>]*>Rosa M\.<\/h3>/);
    expect(out).toContain(m.shop.makerMethod);
    expect(out).not.toMatch(/voice/i);
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

describe("Die-cut preview (admin trace) and avatar", () => {
  it("die-cut preview: titled card, labelled svg, caption", () => {
    const out = html(createElement(DieCut, { artworkUrl: "/a.png", cutPathSvg: "M0 0L10 10", alt: "Bus on a Sticker" }));
    expect(out).toContain('role="img" aria-label="Bus on a Sticker"');
    expect(out).toContain(m.product.dieCutCaption);
    expect(html(createElement(DieCut, { artworkUrl: null, cutPathSvg: null, alt: "x" }))).toBe("");
  });

  it("die-cut preview draws every piece of a multi-piece cut (one path, all subpaths)", () => {
    const d = "M2 30 C2 10, 38 10, 38 30 Z M62 40 C62 20, 88 20, 88 40 Z";
    const out = html(createElement(DieCut, { artworkUrl: "/a.png", cutPathSvg: d, alt: "Two pieces" }));
    expect(out).toContain(`d="${d}"`);
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

describe("Artists, static pages, 404 (T106, 2024:2597 / 2025:2682 / 2025:2886)", () => {
  it("creator card: h2 name, studio, visible Meet {name} link to the profile", () => {
    const creator = { id: "c1", slug: "rosa", displayName: "Rosa M.", studioName: "Sunny Studio", avatarUrl: null, isExample: false, bioShort: null, split: null } as unknown as CreatorSummary;
    const out = html(createElement(CreatorCard, { creator }));
    expect(out).toMatch(/<h2[^>]*>Rosa M\.<\/h2>/);
    expect(out).toMatch(new RegExp(`<a[^>]*href="/c/rosa"[^>]*>${fmt(m.artists.viewProfile, { name: "Rosa M." })}</a>`));
    expect(out).toContain(">RM<");
  });

  it("static page: h1, intro, decorative sky, checked list with the story-tags anchor, closing note", () => {
    const out = html(createElement(StaticPage, { title: m.how.title, intro: m.how.intro, items: [m.how.draw, { text: m.how.tap, id: "story-tags" }], note: "Bye" }));
    expect(out).toMatch(new RegExp(`<h1[^>]*>${m.how.title}</h1>`));
    expect(out).toMatch(/<li id="story-tags"[^>]*><span[^>]*aria-hidden="true"><svg/);
    expect(out).toContain(m.how.tap);
    expect(out).toMatch(/aria-hidden="true"[^>]*style="background-image|style="background-image[^"]*"[^>]*aria-hidden="true"/);
    expect(out.indexOf("</ul>")).toBeLessThan(out.indexOf("Bye"));
  });

  it("404: site nav, main with the h1 and Go to the shop, footer", () => {
    const out = html(createElement(NotFound));
    expect(out.indexOf("<header")).toBeLessThan(out.indexOf('<main id="main"'));
    expect(out).toMatch(new RegExp(`<h1[^>]*>${m.notFound.title}</h1>`));
    expect(out).toContain(m.notFound.home);
    expect(out.indexOf("</main>")).toBeLessThan(out.indexOf("<footer"));
    expect(out.match(/<header/g)).toHaveLength(1);
    expect(out.match(/id="nav-drawer"/g)).toHaveLength(1);
  });

  it("(site) 404 is the body only: the (site) layout supplies nav, main and footer", () => {
    const out = html(createElement(SiteNotFound));
    expect(out).toMatch(new RegExp(`<h1[^>]*>${m.notFound.title}</h1>`));
    expect(out).toContain(m.notFound.home);
    expect(out).not.toMatch(/<header|<main|<footer|nav-drawer/);
  });
});
