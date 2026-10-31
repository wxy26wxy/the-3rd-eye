import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { SelectView, type SelectViewProps } from "@/components/create/screens/SelectView";
import { ListingView, LISTING_FORM, type ListingViewProps } from "@/components/create/screens/ListingView";

const t = m.create.select;
const noop = () => {};
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** Visible text in document order (tags stripped), for order checks. */
const text = (out: string) => out.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const before = (out: string, a: string, b: string) => {
  const s = text(out);
  expect(s.indexOf(a), `missing "${a}"`).toBeGreaterThanOrEqual(0);
  expect(s.indexOf(b), `missing "${b}"`).toBeGreaterThanOrEqual(0);
  expect(s.indexOf(a), `"${a}" should come before "${b}"`).toBeLessThan(s.indexOf(b));
};

function select(over: Partial<SelectViewProps> = {}): string {
  const props: SelectViewProps = {
    uid: "s",
    lead: fmt(t.copyMany, { n: 3 }),
    retake: "/create/photo?mode=camera",
    productWord: "sticker",
    work: null,
    announce: "",
    photo: createElement("div", { "data-testid": "photo" }, "PHOTO"),
    photoState: "loading",
    noPieces: false,
    applied: null,
    canShowApplied: false,
    candidates: [{ id: "a", thumbUrl: "/a.png" }, { id: "b", thumbUrl: "/b.png" }, { id: "c", thumbUrl: "/c.png" }],
    selectedIds: ["a"],
    modes: [{ id: "add", label: t.modeAdd }, { id: "remove", label: t.modeRemove }, { id: "box", label: t.modeBox }],
    mode: "add",
    instruction: t.instructionAdd,
    keyboardHint: t.keyboardHint,
    wholePhoto: false,
    marks: [],
    hasMarksOrBox: false,
    notice: null,
    stuck: false,
    error: null,
    canUse: true,
    canApply: true,
    on: { toggle: noop, boxAround: noop, addAround: noop, mode: noop, wholePhoto: noop, removeMark: noop, clearMarks: noop, toggleApplied: noop, use: noop, apply: noop, retry: noop },
    ...over,
  };
  return html(createElement(SelectView, props));
}

describe("Select view (T105, boards 2027:3254 / 2038:4092 / 2038:4233 / 2038:4369)", () => {
  it("default: photo card, piece strip, per-piece buttons, tools, hints, then the bar in board order", () => {
    const out = select();
    expect(out).toContain('aria-label="Back"');
    before(out, "PHOTO", fmt(t.candidate, { n: 1 }));
    before(out, fmt(t.candidate, { n: 3 }), t.boxAround);
    before(out, t.addAround, t.modeAdd);
    before(out, t.modeBox, t.instructionAdd);
    before(out, t.instructionAdd, t.keyboardHint);
    before(out, t.keyboardHint, t.use);
    before(out, t.use, t.apply);
    before(out, t.apply, t.retake);
    // three pieces, each with its own labelled group of two buttons
    expect(out.match(/role="group"/g)?.length).toBe(3);
    expect(out.match(new RegExp(t.boxAround, "g"))?.length).toBe(3);
    // the chosen piece is a checked checkbox; the others are not
    expect(out.match(/type="checkbox"[^>]*checked/g)?.length).toBe(1);
    // no marks yet: no marks list, no Clear marks
    expect(out).not.toContain(t.marksLabel);
    expect(out).not.toContain(t.clearMarks);
  });

  it("marks: the marks list as buttons, the 10-mark note, the needPiece card and Clear marks", () => {
    const marks = [fmt(t.markAdded, { n: 1 }), fmt(t.markRemoved, { n: 2 })];
    const out = select({ marks, hasMarksOrBox: true, stuck: true, mode: "remove", instruction: t.instructionRemove, canUse: false, canApply: false });
    before(out, t.instructionRemove, t.marksLabel);
    before(out, marks[0], marks[1]);
    before(out, marks[1], t.maxMarks);
    before(out, t.maxMarks, t.needPiece);
    before(out, t.needPiece, t.clearMarks);
    expect(out.match(/<button[^>]*>(?:(?!<\/button>).)*Remove this mark/g)?.length).toBe(2);
    // Use this and Apply cutout are off while only unsendable marks are left
    expect(out).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${t.use}`));
  });

  it("applied: checkerboard cutout, the saved line, Back to photo, the product notice; no Apply in the bar", () => {
    const out = select({ applied: { src: "/cut.png", alt: t.cutoutAlt }, canShowApplied: true, notice: t.failedProducts });
    expect(out).toContain('alt="Your cutout"');
    before(out, t.applied, t.backToPhoto);
    before(out, t.backToPhoto, t.failedProducts);
    expect(out).not.toContain(t.apply);
    expect(out).not.toContain(t.modeAdd);
    expect(out).toContain(t.retake);
  });

  it("saving: no Back, the photo dimmed, the loading line, only Use this (dimmed) in the bar", () => {
    const out = select({ work: "apply" });
    expect(out).not.toContain('aria-label="Back"');
    expect(out).toContain(t.applying);
    expect(out).not.toContain(t.apply + "<");
    expect(out).not.toContain(t.retake);
    expect(out).not.toContain(t.boxAround);
    expect(out).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${t.use}`));
  });

  it("piece tiles: muted boundary when not chosen, 2 px ink when chosen (M8)", () => {
    const css = readFileSync(resolve(__dirname, "../components/create/Create.module.css"), "utf8");
    const rule = (sel: string) => css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    expect(rule(".pieceThumb")).toMatch(/border:\s*var\(--border-thin\) solid var\(--text-muted\)/);
    expect(rule(".piece:has(input:checked) .pieceThumb")).toMatch(/solid var\(--text\)/);
    // and the strip renders one tile per piece
    expect(select().match(/class="[^"]*pieceThumb/g)?.length).toBe(3);
  });

  it("Result picture row wraps three per row, so a refine (5th picture) never clips", () => {
    const css = readFileSync(resolve(__dirname, "../components/create/Create.module.css"), "utf8");
    const tiles = css.match(/\n\.tiles\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(tiles).toMatch(/grid-template-columns:\s*repeat\(3,/);
    expect(tiles).not.toMatch(/grid-auto-flow:\s*column/);
  });

  it("making the product shows the making line", () => {
    expect(select({ work: "use" })).toContain(fmt(m.create.result.making, { product: "sticker" }));
  });

  it("unpublished notice and errors keep their copy", () => {
    expect(select({ notice: t.unpublishedProducts })).toContain(t.unpublishedProducts);
    const out = select({ error: { message: m.create.errors.timeout, action: "retry" } });
    expect(out).toContain('role="alert"');
    expect(out).toContain(m.create.errors.retry);
  });

  it("no pieces: box mode only, the whole-photo button, no piece strip", () => {
    const out = select({ noPieces: true, candidates: [], selectedIds: [], modes: [{ id: "add", label: t.modeAdd }, { id: "box", label: t.modeBox }], mode: "box", instruction: t.instructionBoxNone, keyboardHint: t.keyboardHintNone, wholePhoto: true });
    expect(out).toContain(t.wholePhoto);
    expect(out).not.toContain(t.modeRemove);
    expect(out).not.toContain(t.boxAround);
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
  it("mockup → Improve with AI → Name → Description → Price → earn → print check → trace → submit", () => {
    const l = m.create.listing;
    const out = listing();
    const order = ['alt="Your Sticker preview"', l.improve, l.name, l.description, l.price, l.earn, l.printOk, l.showTrace, l.submit];
    for (let i = 1; i < order.length; i++) expect(out.indexOf(order[i - 1]), `${order[i - 1]} before ${order[i]}`).toBeLessThan(out.indexOf(order[i]));
    // the bar's submit button submits the form by its id
    expect(out).toContain(`id="${LISTING_FORM}"`);
    expect(out).toMatch(new RegExp(`<button[^>]*type="submit"[^>]*form="${LISTING_FORM}"|<button[^>]*form="${LISTING_FORM}"[^>]*type="submit"`));
  });

  it("drafting: mockup and the writing line only, submit dimmed", () => {
    const out = listing({ drafting: true });
    expect(out).toContain(m.create.listing.drafting);
    expect(out).not.toContain(m.create.listing.improve);
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
