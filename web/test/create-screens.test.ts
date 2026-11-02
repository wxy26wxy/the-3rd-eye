import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, m } from "@/components/messages";
import { SelectView, type SelectViewProps } from "@/components/create/screens/SelectView";
import { ListingView, LISTING_FORM, type ListingViewProps } from "@/components/create/screens/ListingView";
import { ChoosePatternView, type ChoosePatternViewProps } from "@/components/create/screens/ChoosePatternView";
import { ChangeItView, CHANGE_FORM, type ChangeItViewProps } from "@/components/create/screens/ChangeItView";
import { BeforeAfterView, type BeforeAfterViewProps } from "@/components/create/screens/BeforeAfterView";
import { MakingCutoutView } from "@/components/create/screens/MakingCutoutView";
import { MakingProductView } from "@/components/create/screens/MakingProductView";
import { Welcome } from "@/components/create/screens/Welcome";
import { WelcomeAccountView } from "@/components/create/SignOut";

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
    title: m.create.cutout.title,
    lead: m.create.cutout.adjustCopy,
    back: "/create/compare",
    retake: "/create/photo?mode=camera",
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
    instruction: t.instruction,
    keyboardHint: t.keyboardHint,
    wholePhoto: false,
    marks: [],
    hasMarksOrBox: false,
    notice: null,
    stuck: false,
    error: null,
    canUse: true,
    canApply: true,
    on: { toggle: noop, boxAround: noop, addAround: noop, mode: noop, wholePhoto: noop, removeMark: noop, clearMarks: noop, toggleApplied: noop, use: noop, apply: noop, retry: noop, startOver: noop },
    ...over,
  };
  return html(createElement(SelectView, props));
}

describe("Your cutout view (T113, boards 2038:4092 Fix the edges / 2038:4233 the cut)", () => {
  it("Fix the edges: photo card, piece strip, per-piece buttons, tools, hints, then the bar in board order", () => {
    const out = select();
    expect(out).toContain('aria-label="Back"');
    before(out, "PHOTO", fmt(t.candidate, { n: 1 }));
    before(out, fmt(t.candidate, { n: 3 }), t.boxAround);
    before(out, m.create.cutout.title, m.create.cutout.adjustCopy);
    before(out, t.addAround, t.modeAdd);
    before(out, t.modeBox, t.instruction);
    before(out, t.instruction, t.keyboardHint);
    before(out, t.keyboardHint, t.use);
    before(out, t.use, t.apply);
    before(out, t.apply, m.common.startOver);
    expect(out).not.toContain(">" + t.retake + "<");
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
    const out = select({ marks, hasMarksOrBox: true, stuck: true, mode: "remove", canUse: false, canApply: false });
    before(out, t.instruction, t.marksLabel);
    before(out, marks[0], marks[1]);
    before(out, marks[1], t.maxMarks);
    before(out, t.maxMarks, t.needPiece);
    before(out, t.needPiece, t.clearMarks);
    expect(out.match(/<button[^>]*>(?:(?!<\/button>).)*Remove this mark/g)?.length).toBe(2);
    // Use this and Apply cutout are off while only unsendable marks are left
    expect(out).toMatch(new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${t.use}`));
  });

  it("the cut (2038:4233): checkerboard cutout, the ready line, Fix the edges, the notice; Use this / Start over", () => {
    const out = select({ lead: m.create.cutout.copy, applied: { src: "/cut.png", alt: t.cutoutAlt }, canShowApplied: true, notice: t.failedProducts });
    expect(out).toContain('alt="Your cutout"');
    before(out, m.create.cutout.copy, t.applied);
    before(out, t.applied, t.backToPhoto);
    before(out, t.backToPhoto, t.failedProducts);
    before(out, t.failedProducts, t.use);
    before(out, t.use, m.common.startOver);
    expect(t.backToPhoto).toBe("Fix the edges");
    expect(out).not.toContain(t.apply);
    expect(out).not.toContain(t.modeAdd);
  });

  it("saving: no Back, the photo dimmed, the loading line, only Use this (dimmed) in the bar", () => {
    const out = select({ work: "apply" });
    expect(out).not.toContain('aria-label="Back"');
    expect(out).toContain(t.applying);
    expect(out).not.toContain(t.apply + "<");
    expect(out).not.toContain(m.common.startOver);
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

  it("saving before Use this shows the cutting line", () => {
    expect(select({ work: "use" })).toContain(t.applying);
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

const btnDisabled = (label: string) => new RegExp(`<button[^>]*disabled[^>]*>(?:(?!</button>).)*${label}`);

function pattern(over: Partial<ChoosePatternViewProps> = {}): string {
  const props: ChoosePatternViewProps = {
    lead: fmt(t.copyMany, { n: 3, product: "sticker" }),
    retake: "/create/photo?mode=camera",
    busy: false,
    photo: createElement("div", null, "PHOTO"),
    photoState: "loading",
    candidates: [{ id: "a", thumbUrl: "/a.png" }, { id: "b", thumbUrl: "/b.png" }, { id: "c", thumbUrl: "/c.png" }],
    picked: "a",
    error: null,
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
    for (const tool of [t.modeAdd, t.boxAround, t.apply]) expect(out).not.toContain(tool);
  });

  it("tote: the copy names the tote bag", () => {
    expect(text(pattern({ lead: fmt(t.copyMany, { n: 2, product: "tote bag" }) }))).toContain("turn into a tote bag.");
  });

  it("cutting: no Back, pieces locked, the cutting line, only Use this (dimmed)", () => {
    const out = pattern({ busy: true });
    expect(out).not.toContain('aria-label="Back"');
    expect(out).toMatch(/<fieldset[^>]*disabled/);
    expect(out).toContain(t.applying);
    expect(out).not.toContain(">" + t.retake + "<");
    expect(out).toMatch(btnDisabled(t.use));
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

  it("transcribing: the writing-down line", () => {
    expect(change({ phase: "transcribing" })).toContain(s.transcribing);
  });

  it("microphone off: the mic-off hint, the notice, the field, Make the change in the bar", () => {
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
  it("no logo or Back, title, copy, the art dimmed, the cutting line, Use this dimmed", () => {
    const out = html(createElement(MakingCutoutView, { art: { src: "/after.png", alt: "x" }, changed: true, error: null, back: "/create/compare", onRetry: noop }));
    expect(out).not.toContain('aria-label="Back"');
    before(out, m.create.cutout.makingTitle, m.create.cutout.makingCopy);
    before(out, m.create.cutout.makingCopy, t.applying);
    expect(out).toMatch(btnDisabled(t.use));
  });

  it("error: Back, the error card with Try again", () => {
    const out = html(createElement(MakingCutoutView, { art: { src: null, alt: "x" }, changed: false, error: { message: m.create.errors.timeout, action: "retry" }, back: "/create/change", onRetry: noop }));
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
