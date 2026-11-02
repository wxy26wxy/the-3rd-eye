import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { YourCutoutView, type YourCutoutViewProps } from "@/components/create/screens/YourCutoutView";
import { AdjustAreaView, type AdjustAreaViewProps } from "@/components/create/screens/AdjustAreaView";
import { AreaFrame } from "@/components/create/screens/AreaFrame";
import { sizeText } from "@/components/create/screens/AdjustArea";
import { StoryVideoRowView } from "@/components/create/StoryVideoRow";
import { MascotPicture } from "@/components/create/art";
import { ListingView, LISTING_FORM, type ListingViewProps } from "@/components/create/screens/ListingView";
import { ChoosePatternView, type ChoosePatternViewProps } from "@/components/create/screens/ChoosePatternView";
import { ChangeItView, CHANGE_FORM, type ChangeItViewProps } from "@/components/create/screens/ChangeItView";
import { BeforeAfterView, type BeforeAfterViewProps } from "@/components/create/screens/BeforeAfterView";
import { MakingCutoutView } from "@/components/create/screens/MakingCutoutView";
import { MakingProductView } from "@/components/create/screens/MakingProductView";
import { Welcome } from "@/components/create/screens/Welcome";
import { WelcomeAccountView } from "@/components/create/SignOut";

const t = m.create.select;
const btnDisabled = (label: string) => new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${label}`);
const noop = () => {};
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** Visible text in document order (tags stripped), for order checks. */
const text = (out: string) => out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
/** Raw-markup order (tags and attributes kept), for markup checks. */
const beforeRaw = (out: string, a: string, b: string) => {
  expect(out.indexOf(a), `missing "${a}"`).toBeGreaterThanOrEqual(0);
  expect(out.indexOf(a), `"${a}" should come before "${b}"`).toBeLessThan(out.indexOf(b));
};
const before = (out: string, a: string, b: string) => {
  const s = text(out);
  expect(s.indexOf(a), `missing "${a}"`).toBeGreaterThanOrEqual(0);
  expect(s.indexOf(b), `missing "${b}"`).toBeGreaterThanOrEqual(0);
  expect(s.indexOf(a), `"${a}" should come before "${b}"`).toBeLessThan(s.indexOf(b));
};

function cutoutView(over: Partial<YourCutoutViewProps> = {}): string {
  const props: YourCutoutViewProps = {
    title: m.create.cutout.title,
    lead: m.create.cutout.copy,
    back: "/create/change",
    cut: { src: "/cut.png", alt: t.cutoutAlt, aspectRatio: "4 / 3" },
    notice: null,
    on: { use: noop, startOver: noop },
    ...over,
  };
  return html(createElement(YourCutoutView, props));
}

describe("Your cutout view (R3, board 2038:4233 simplified)", () => {
  it("the cut-out on the checkerboard, the status line, then Use this / Start over; no edge tools", () => {
    const out = cutoutView();
    expect(out).toContain('aria-label="Back"');
    expect(out).toContain('alt="Your cutout"');
    before(out, m.create.cutout.title, m.create.cutout.copy);
    beforeRaw(out, 'alt="Your cutout"', t.applied);
    before(out, t.applied, t.use);
    before(out, t.use, m.common.startOver);
    for (const gone of ["Fix the edges", "Apply cutout", "Add area", "Remove area", "Draw a box", "Clear marks", "Box around this piece"]) expect(out).not.toContain(gone);
    expect(out).not.toContain('type="checkbox"');
    expect(out).not.toContain('type="radio"');
  });

  it("the product notice sits above the bar; without a cut-out Use this is off", () => {
    before(cutoutView({ notice: t.failedProducts }), t.failedProducts, t.use);
    expect(cutoutView({ cut: null })).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${t.use}`));
  });
});

const ad = m.create.adjust;
function adjust(over: Partial<AdjustAreaViewProps> = {}): string {
  const props: AdjustAreaViewProps = {
    hintId: "h", sizeId: "sz", sizeText: "Frame covers 54 by 61 percent of the photo", back: "/create/pattern", retake: "/create/photo?mode=camera", none: false, busy: false,
    photo: createElement("div", null, "PHOTO"), photoState: "loading", announce: "", canUse: true, error: null,
    on: { use: noop, reset: noop },
    ...over,
  };
  return html(createElement(AdjustAreaView, props));
}

describe("Adjust the area view (R2)", () => {
  it("title, copy, the photo with the frame, the keyboard hint (the frame's description), then Use this area / Reset", () => {
    const out = adjust();
    expect(out).toContain('aria-label="Back"');
    before(out, ad.title, ad.copy);
    before(out, ad.copy, "PHOTO");
    before(out, "PHOTO", ad.keyboardHint);
    before(out, ad.keyboardHint, ad.use);
    before(out, ad.use, ad.reset);
    expect(out).toContain('<p id="h"');
    expect(out).toContain('<p id="sz" class="visually-hidden">Frame covers 54 by 61 percent of the photo</p>');
    expect(out).toMatch(/role="status" aria-live="polite"/);
    expect([ad.title, ad.copy, ad.use, ad.reset, ad.frameLabel]).toEqual(["Adjust the area", "Drag the corners so the frame covers your drawing.", "Use this area", "Reset", "Area frame"]);
  });

  it("no drawing found: the whole-photo copy", () => {
    expect(text(adjust({ none: true }))).toContain(ad.copyNone);
  });

  it("cutting: no Back, the cutting line, only Use this area (dimmed)", () => {
    const out = adjust({ busy: true });
    expect(out).not.toContain('aria-label="Back"');
    expect(out).toContain(t.applying);
    expect(out).not.toContain(">" + ad.reset + "<");
    expect(out).toMatch(btnDisabled(ad.use));
  });

  it("a frame with nothing in it: the advice and no retake", () => {
    const out = adjust({ error: { message: ad.notFound, action: "none" } });
    expect(text(out)).toContain(ad.notFound);
    expect(out).toContain('role="alert"');
  });
});

describe("Adjust the area frame (R2)", () => {
  it("one focusable frame (Area frame, role description area frame) described by its size and the hint; 44 px corners and edges hidden from assistive tech", () => {
    const image = { w: 1000, h: 800 };
    expect(sizeText([100, 80, 600, 480], image)).toBe("Frame covers 50 by 50 percent of the photo");
    const out = html(createElement(AreaFrame, {
      src: "/o.jpg", image, box: [100, 80, 600, 480], disabled: false, label: ad.frameLabel, describedBy: "sz h", onChange: noop, onCommit: noop,
    }));
    expect(out).toMatch(/role="group" tabindex="0" aria-label="Area frame" aria-roledescription="area frame" aria-describedby="sz h"/);
    expect(out).toContain(`alt="${ad.photoLabel}"`);
    expect(out).toContain("left:10%;top:10%;width:50%;height:50%");
    expect(out.match(/data-corner=/g)?.length).toBe(4);
    expect(out.match(/data-side=/g)?.length).toBe(4);
    expect(out.match(/aria-hidden="true" data-handle/g)?.length).toBe(8);
    const css = readFileSync(resolve(__dirname, "../components/create/Create.module.css"), "utf8");
    expect(css).toMatch(/\.areaCorner \{[^}]*width: var\(--size-min-target\); height: var\(--size-min-target\)/);
  });
});

describe("Mascot pictures (R7)", () => {
  it("Take a photo shows the card mascot, You're live the shop mascot, both described, through next/image", () => {
    const card = html(createElement(MascotPicture, { kind: "card" }));
    expect(card).toContain(`alt="${m.create.photo.mascotAlt}"`);
    expect(card).toMatch(/src="\/_next\/image\?url=%2Fassets%2Fmascot-card\.png/);
    const shop = html(createElement(MascotPicture, { kind: "shop" }));
    expect(shop).toContain(`alt="${m.create.live.mascotAlt}"`);
    expect(shop).toMatch(/mascot-shop\.png/);
  });
});

describe("My story video row (R6)", () => {
  const r6 = m.create.myStory;
  const base = { id: "cr1", storyVideoUrl: "creators/cr1/story-video/a b.mp4", storyVideoVtt: "WEBVTT" };
  it("with a video: thumbnail, My story video, where buyers see it, Watch and Record again (redo mode)", () => {
    const out = html(createElement(StoryVideoRowView, { creator: base, watching: false, onWatch: noop }));
    before(out, r6.row, r6.saved);
    before(out, r6.watch, r6.recordAgain);
    expect(r6.saved).toBe("Buyers see it when they tap your story tag.");
    expect(out).toContain('src="/media/creators/cr1/story-video/a%20b.mp4#t=0.1"');
    expect(out).toContain('href="/create/story-video?redo=1"');
    expect(out).toContain('aria-expanded="false"');
  });

  it("watching: the player with the captions track; a failed load says so", () => {
    const out = html(createElement(StoryVideoRowView, { creator: base, watching: true, onWatch: noop }));
    expect(out).toMatch(/<video[^>]*controls/);
    expect(out).toContain('<track kind="captions" src="/captions/cr1"');
    expect(text(html(createElement(StoryVideoRowView, { creator: base, watching: true, failed: true, onWatch: noop })))).toContain(r6.missing);
  });

  it("no video: the icon, No story video yet, Record a video", () => {
    const out = html(createElement(StoryVideoRowView, { creator: { ...base, storyVideoUrl: null }, watching: false, onWatch: noop }));
    expect(out).toContain(r6.none);
    expect(out).toContain(m.create.story.record);
    expect(out).not.toContain(r6.watch);
    expect(out).not.toContain("<video");
  });
});

function listing(over: Partial<ListingViewProps> = {}): string {
  const props: ListingViewProps = {
    uid: "l",
    mockup: { src: "/m.png", alt: "Your Sticker preview" },
    drafting: false,
    improving: false,
    submitting: false,
    title: "Reading Monster Sticker",
    description: "A fuzzy green monster who never puts its book down.",
    price: "5.00",
    errors: {},
    earnCents: 250,
    printOk: true,
    trace: [{ step: 1, tool: "check_print", text: "ok" }] as ListingViewProps["trace"],
    showTrace: false,
    error: null,
    on: { title: noop, description: noop, price: noop, improve: noop, retry: noop, toggleTrace: noop, submit: noop },
    ...over,
  };
  return html(createElement(ListingView, props));
}

describe("Listing view (T105, board 2030:3752: element order follows the board)", () => {
  it("T127: a sticker preview gets the soft shadow so its white border reads; a tote's art does not", () => {
    expect(listing({ mockup: { src: "/p.png", alt: "x", shadow: true } })).toMatch(/class="[^"]*mockupArt[^"]*stickerShadow/);
    expect(listing({ mockup: { src: "/p.png", alt: "x" } })).not.toContain("stickerShadow");
    const css = readFileSync(resolve(__dirname, "../components/create/Create.module.css"), "utf8");
    expect(css).toMatch(/\.stickerShadow img \{ filter: drop-shadow\(var\(--shadow-soft\)\); \}/);
    expect(css).toMatch(/\.readyCard \{[^}]*background: var\(--surface-alt\)/);
  });

  it("mockup → Improve with AI → Name → Description → Price → earn → print check → trace → submit", () => {
    const l = m.create.listing;
    const out = listing();
    const order = ['alt="Your Sticker preview"', l.improve, l.name, l.description, l.price, l.earn, l.printOk, l.showTrace, l.submit];
    for (let i = 1; i < order.length; i++) expect(out.indexOf(order[i - 1]), `${order[i - 1]} before ${order[i]}`).toBeLessThan(out.indexOf(order[i]));
    // the bar's submit button submits the form by its id
    expect(out).toContain(`id="${LISTING_FORM}"`);
    expect(out).toMatch(new RegExp(`<button[^>]*type="submit"[^>]*form="${LISTING_FORM}"|<button[^>]*form="${LISTING_FORM}"[^>]*type="submit"`));
  });

  it("drafting (R5): the picture, the creating-cutout animation and the writing line; no fields; submit dimmed", () => {
    const out = listing({ drafting: true });
    beforeRaw(out, 'alt="Your Sticker preview"', "<video");
    expect(out).toMatch(/<video[^>]*src="\/assets\/sticker-loading\.mp4"/);
    beforeRaw(out, "<video", m.create.listing.drafting);
    expect(out).not.toContain(m.create.listing.improve);
    expect(out).not.toContain(m.create.listing.name);
    expect(out).not.toContain("<input");
    expect(text(out)).toContain("We'll show the name, price and description when it's ready.");
    expect(m.create.listing.drafting).toBe("Writing your listing…");
    expect(out).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${m.create.listing.submit}`));
  });

  it("409 print check / moderation: the error card sits after the print check, above the bar", () => {
    const message = fmt(m.create.errors.printCheck, { reason: "the picture is too small for a 3 inch sticker." });
    const out = listing({ printOk: undefined, trace: [], error: { message, action: "fix" } });
    before(out, m.create.listing.earn, message);
    before(out, message, m.create.listing.submit);
    expect(out).toContain('role="alert"');
  });

  it("missing name: the field error sits under the Name field", () => {
    const out = listing({ title: "", errors: { title: m.create.listing.nameRequired } });
    before(out, m.create.listing.name, m.create.listing.nameRequired);
    before(out, m.create.listing.nameRequired, m.create.listing.description);
  });
});


function pattern(over: Partial<ChoosePatternViewProps> = {}): string {
  const props: ChoosePatternViewProps = {
    lead: fmt(t.copyMany, { n: 3, product: "sticker" }),
    retake: "/create/photo?mode=camera",
    photo: createElement("div", null, "PHOTO"),
    photoState: "loading",
    candidates: [{ id: "a", thumbUrl: "/a.png" }, { id: "b", thumbUrl: "/b.png" }, { id: "c", thumbUrl: "/c.png" }],
    picked: "a",
    on: { pick: noop, use: noop },
    ...over,
  };
  return html(createElement(ChoosePatternView, props));
}

describe("Choose a pattern view (T113, board 2027:3254)", () => {
  it("title, copy, photo, the Drawings found radio strip, then Use this / Retake; no cutout tools", () => {
    const out = pattern();
    expect(t.title).toBe("Tap the one you want.");
    expect(text(out)).toContain("We found 3 drawings in your photo. Pick one to change and turn into a sticker.");
    before(out, t.title, "PHOTO");
    before(out, "PHOTO", fmt(t.candidate, { n: 1 }));
    before(out, fmt(t.candidate, { n: 3 }), t.use);
    before(out, t.use, t.retake);
    // single pick: one radio group, one checked
    expect(out.match(/type="radio"/g)?.length).toBe(3);
    expect(out.match(/type="radio"[^>]*checked/g)?.length).toBe(1);
    expect(out).toContain(`<legend class="visually-hidden">${t.groupLabel}</legend>`);
    for (const tool of ["Add area", "Box around this piece", "Apply cutout"]) expect(out).not.toContain(tool);
  });

  it("tote: the copy names the tote bag", () => {
    expect(text(pattern({ lead: fmt(t.copyMany, { n: 2, product: "tote bag" }) }))).toContain("turn into a tote bag.");
  });

});

const s = m.create.speak;
const r = m.create.result;
function change(over: Partial<ChangeItViewProps> = {}): string {
  const props: ChangeItViewProps = {
    back: "/create/pattern",
    phase: "idle",
    micOff: null,
    art: { src: "/piece.png", alt: "A fern" },
    shows: "A fern drawn in pen.",
    instruction: "",
    seconds: 0,
    error: null,
    announce: "",
    on: { instruction: noop, record: noop, stop: noop, typeInstead: noop, submit: noop, skip: noop, retry: noop, tryDifferent: noop },
    ...over,
  };
  return html(createElement(ChangeItView, props));
}

describe("Change it view (T113, boards 2027:3138 / 2026:3067 / 2026:3135 / 2038:4060)", () => {
  it("entry: Change your art?, YOUR ART, what it shows, then the panel: field, Start talking, Make the change, Looks good as is", () => {
    const out = change();
    expect(out).toContain('aria-label="Back"');
    before(out, r.titleEntry, s.artLabel);
    before(out, s.artLabel, r.shows);
    before(out, r.shows, s.textLabel);
    before(out, s.textLabel, s.start);
    before(out, s.start, s.done);
    before(out, s.done, r.skip);
    expect(out).toContain(`placeholder="${s.textPlaceholder}"`);
    // the art is described by the card next to it
    expect(out).toContain('alt=""');
    // Make the change submits the field's form and is off while the field is empty
    expect(out).toContain(`id="${CHANGE_FORM}"`);
    expect(out).toMatch(btnDisabled(s.done));
    expect(change({ instruction: "Make the book red" })).not.toMatch(btnDisabled(s.done));
  });

  it("R4: Make the change and Looks good as is share one row at the bottom of the change card; no pinned bar", () => {
    const out = change();
    const card = out.match(/<div class="[^"]*changeCard[^"]*">([\s\S]*)$/)?.[1] ?? "";
    const row = card.match(/<div class="[^"]*changeActions[^"]*">(.*?)<\/div><\/div>/)?.[1] ?? "";
    before(row, s.done, r.skip);
    expect(row.match(/<button/g)?.length).toBe(2);
    expect(out).not.toMatch(/class="[^"]*footer/);
    for (const variant of [change({ micOff: s.micDenied }), change({ phase: "error", error: { message: "x", action: "none" } })]) expect(variant).not.toMatch(/class="[^"]*footer/);
    const css = readFileSync(resolve(__dirname, "../components/create/Create.module.css"), "utf8");
    expect(css).toMatch(/\.changeActions \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(css).toMatch(/\.changeActions > \* \{[^}]*min-height: var\(--size-min-target\)/);
    expect(css).toMatch(/@media \(max-width: 24rem\) \{\s*\.changeActions \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });

  it("typing: the typed (or transcribed) request sits in the field", () => {
    expect(change({ instruction: "Make the book red" })).toContain(">Make the book red</textarea>");
  });

  it("listening: Change your art + hint, YOUR ART, LISTENING, seconds, Stop, Type instead; no field", () => {
    const out = change({ phase: "listening", seconds: 12 });
    before(out, s.title, s.hint);
    before(out, s.hint, s.artLabel);
    before(out, s.artLabel, s.listening);
    before(out, s.listening, fmt(s.seconds, { s: 12 }));
    before(out, fmt(s.seconds, { s: 12 }), m.create.typeInstead);
    expect(out).toContain(`aria-label="${s.stop}"`);
    expect(out).not.toContain(s.textLabel);
  });

  it("one persistent polite live region, first in every phase, says Listening while recording (review M7)", () => {
    const region = /<div class="[^"]*body[^"]*"><p class="visually-hidden" role="status" aria-live="polite">([^<]*)<\/p>/;
    for (const phase of ["idle", "transcribing", "error"] as const) expect(change({ phase }).match(region)?.[1]).toBe("");
    expect(change({ micOff: s.micDenied }).match(region)?.[1]).toBe("");
    const listening = change({ phase: "listening", announce: s.listening });
    expect(listening.match(region)?.[1]).toBe(s.listening);
    // the LISTENING card itself is no longer a live region
    expect(listening.match(/role="status"/g)?.length).toBe(1);
  });

  it("transcribing: the writing-down line", () => {
    expect(change({ phase: "transcribing" })).toContain(s.transcribing);
  });

  it("microphone off: the mic-off hint, the notice, the field, Make the change under it", () => {
    const out = change({ micOff: s.micDenied });
    before(out, s.hintMicOff, s.artLabel);
    before(out, s.artLabel, s.micDenied);
    before(out, s.micDenied, s.textLabel);
    before(out, s.textLabel, s.done);
    expect(out).not.toContain(`aria-label="${s.start}"`);
    expect(out).toMatch(new RegExp(`<button[^>]*form="${CHANGE_FORM}"`));
  });

  it("error: the error card with Try again, then Looks good as is / Try a different change", () => {
    const out = change({ phase: "error", error: { message: m.create.errorGeneric, action: "retry" } });
    before(out, s.artLabel, m.create.errorGeneric);
    before(out, m.create.errorGeneric, m.create.errors.retry);
    before(out, m.create.errors.retry, r.skip);
    before(out, r.skip, r.tryDifferent);
    expect(out).toContain('role="alert"');
  });

  it("copy follows the v3 boards", () => {
    expect([r.titleEntry, s.title, s.done, r.skip, r.tryDifferent]).toEqual(["Change your art?", "Change your art", "Make the change", "Looks good as is", "Try a different change"]);
  });
});

function compare(over: Partial<BeforeAfterViewProps> = {}): string {
  const props: BeforeAfterViewProps = {
    asked: "Make the book red",
    before: { src: "/before.png", alt: "A monster reading a blue book" },
    after: { src: "/after.png", alt: "A monster reading a red book" },
    shows: "A fuzzy green monster reads a red book.",
    differences: "",
    playing: false,
    on: { hear: noop, use: noop, again: noop, original: noop },
    ...over,
  };
  return html(createElement(BeforeAfterView, props));
}

describe("Before and after view (T113, board 2027:3091)", () => {
  it("YOU ASKED, Before, After, what it shows, Hear; Use this / Change it again / Back to my original", () => {
    const out = compare();
    expect(out).toContain('aria-label="Back"');
    before(out, r.title, r.youSaid);
    before(out, "Make the book red", r.before);
    before(out, r.before, r.after);
    before(out, r.after, r.shows);
    before(out, r.shows, r.hear);
    before(out, r.hear, r.use);
    before(out, r.use, r.change);
    before(out, r.change, r.backToPictures);
    expect(out).toContain('alt="A monster reading a blue book"');
    expect(out).toContain('alt="A monster reading a red book"');
    expect([r.title, r.youSaid, r.change, r.backToPictures]).toEqual(["Here's the change", "You asked", "Change it again", "Back to my original"]);
  });

  it("differences from the request are shown under the description; reading aloud toggles to Stop", () => {
    const out = compare({ differences: "The book is red but the cover title is missing.", playing: true });
    before(out, "reads a red book.", "cover title is missing");
    expect(out).toContain('aria-pressed="true"');
    expect(out).toContain(">" + r.stop + "<");
  });
});

describe("Making your cutout view (T113, board 2038:4369)", () => {
  it("no logo or Back, title, copy, the creating-cutout animation (R7), the cutting line, Use this dimmed", () => {
    const out = html(createElement(MakingCutoutView, { changed: true, error: null, back: "/create/compare", onRetry: noop }));
    expect(out).not.toContain('aria-label="Back"');
    before(out, m.create.cutout.makingTitle, m.create.cutout.makingCopy);
    beforeRaw(out, m.create.cutout.makingCopy, "<video");
    expect(out).toMatch(/<video[^>]*src="\/assets\/sticker-loading\.mp4"/);
    beforeRaw(out, "<video", t.applying);
    expect(out).toMatch(btnDisabled(t.use));
  });

  it("error: Back, the error card with Try again", () => {
    const out = html(createElement(MakingCutoutView, { changed: false, error: { message: m.create.errors.timeout, action: "retry" }, back: "/create/change", onRetry: noop }));
    expect(out).toContain('aria-label="Back"');
    expect(out).toContain(m.create.cutout.makingCopyOriginal);
    expect(out).toContain(m.create.errors.retry);
  });
});

describe("Making your sticker / tote bag view (T113, boards 4031:4378 / 4038:4628)", () => {
  const status = (p: string) => fmt(r.making, { product: p });
  it("sticker: title, copy, the decorative loading animation, the status line, Use this dimmed; no Back", () => {
    const out = html(createElement(MakingProductView, { tote: false, status: status("sticker"), error: null, onRetry: noop }));
    expect(out).not.toContain('aria-label="Back"');
    before(out, m.create.making.titleSticker, m.create.making.copySticker);
    expect(out.indexOf(m.create.making.copySticker)).toBeLessThan(out.indexOf("<video"));
    expect(out.indexOf("<video")).toBeLessThan(out.indexOf("Making your sticker… this can take a minute."));
    expect(out).toMatch(/<video[^>]*aria-hidden="true"/);
    expect(out).toMatch(/<video[^>]*src="\/assets\/sticker-loading\.mp4"/);
    expect(out).toMatch(/<video[^>]*muted/);
    expect(out).toMatch(btnDisabled(t.use));
  });

  it("tote: the tote bag title, copy and status", () => {
    const out = html(createElement(MakingProductView, { tote: true, status: status("tote bag"), error: null, onRetry: noop }));
    expect(out).toContain("Making your tote bag");
    expect(out).toContain("Placing your art on the bag and getting it ready to print.");
    expect(out).toContain("Making your tote bag… this can take a minute.");
  });
});

describe("Welcome (T113, board 2026:2865 v3)", () => {
  it("the title on the bare sky in three lines, then Start creating; no panels or promises", () => {
    const out = html(createElement(Welcome));
    expect(text(out)).toContain("Your art, on things people love.");
    expect(out.match(/class="[^"]*welcomeLine/g)?.length).toBe(3);
    before(out, "people love.", m.create.welcome.cta);
    expect(out).not.toMatch(/class="[^"]*scrim/);
    expect(out).not.toContain("<ol");
  });

  it("signed out: the ink text action I already have an account, linking to the code screen", () => {
    const out = html(createElement(WelcomeAccountView, { signedIn: false }));
    expect(out).toContain(m.create.welcome.haveAccount);
    expect(out).toContain('href="/create/code"');
    expect(out).not.toContain(m.create.signOut);
  });

  it("signed in: Sign out, a form POST to the session route with the signout intent", () => {
    const out = html(createElement(WelcomeAccountView, { signedIn: true }));
    expect(out).toContain(m.create.signOut);
    expect(out).toMatch(/<form[^>]*method="post"[^>]*action="\/create\/code\/session"|<form[^>]*action="\/create\/code\/session"[^>]*method="post"/);
    expect(out).toContain('name="intent" value="signout"');
    expect(out).not.toContain(m.create.welcome.haveAccount);
  });
});

describe("Choose method (T113, board 2026:2998)", () => {
  it("no voice option and the v3 title", () => {
    expect(m.create.method.title).toBe("How do you want to add your art?");
    expect(m.create.method).not.toHaveProperty("speak");
  });
});
