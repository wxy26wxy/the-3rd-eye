/** T134 ruling 2: contrast is a colour warning over opaque pixels; resolution (cleaned PNG, one ×2) is the only hard gate. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { checkResolution, measureContrast, measurePrintCheck, srgbToLab } from "@/lib/products/checks";

const svg = (w: number, h: number, body: string, bg = "#ffffff") => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ""}${body}</svg>`,
)).png().toBuffer();

/** A light pencil sketch on paper: thin grey strokes (#bdbdbd) over the white sheet, as a cut of the sheet. */
const pencilSketch = () => svg(1200, 1200,
  `<g stroke="#bdbdbd" stroke-width="5" fill="none"><circle cx="600" cy="600" r="400"/><path d="M300 400 Q600 100 900 400"/><path d="M350 800 L850 800"/></g>`);

describe("measureContrast (colour over opaque pixels)", () => {
  it("Lab conversion: white L 100, black L 0, saturated yellow has high chroma", () => {
    expect(srgbToLab(255, 255, 255)[0]).toBeCloseTo(100, 0);
    expect(srgbToLab(0, 0, 0)[0]).toBeCloseTo(0, 0);
    const [, a, b] = srgbToLab(255, 220, 0);
    expect(Math.hypot(a, b)).toBeGreaterThan(70);
  });

  it("a light pencil sketch warns", async () => {
    const c = await measureContrast(await pencilSketch());
    expect(c.ok).toBe(false);
    expect(c.warning).toBe(true);
  });

  it("an evenly toned dark piece passes (mean L* ≤ 50); an evenly toned light grey piece warns", async () => {
    expect((await measureContrast(await svg(400, 400, "", "#202020"))).ok).toBe(true);
    expect((await measureContrast(await svg(400, 400, "", "#c8c8c8"))).ok).toBe(false);
  });

  it("dark ink line art passes", async () => {
    expect((await measureContrast(await svg(800, 800, `<circle cx="400" cy="400" r="300" fill="none" stroke="#202020" stroke-width="40"/>`))).ok).toBe(true);
  });

  it("pastel yellow art and colourful art of one lightness pass (they failed the old greyscale rule)", async () => {
    expect((await measureContrast(await svg(600, 600, `<circle cx="300" cy="300" r="250" fill="#ffe680"/>`, "#fff6c0"))).ok).toBe(true);
    // red and green chosen with nearly the same lightness
    expect((await measureContrast(await svg(600, 600, `<rect width="300" height="600" fill="#e05050"/><rect x="300" width="300" height="600" fill="#5a9a3a"/>`, ""))).ok).toBe(true);
  });

  it("transparent pixels are ignored: an evenly toned blue piece on transparency passes on its colour", async () => {
    const piece = await sharp({ create: { width: 600, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await svg(300, 300, "", "#3060d0"), left: 150, top: 150 }]).png().toBuffer();
    const c = await measureContrast(piece);
    expect(c.lightnessSpread).toBeLessThan(5); // only the blue square is measured, not the transparent canvas
    expect(c.ok).toBe(true);
  });
});

describe("checkResolution / measurePrintCheck", () => {
  it("a 120 px cut is flagged as resolution (120 × 2 < 900), reported before a contrast warning", async () => {
    const check = await measurePrintCheck("sticker", await svg(120, 120, "", "#dddddd"));
    expect(check).toMatchObject({ version: 2, print_ok: false, check: "resolution" });
    expect(check.resolution.ok).toBe(false);
  });

  it("the pencil sketch at a good size: print_ok false with check contrast", async () => {
    const check = await measurePrintCheck("sticker", await pencilSketch());
    expect(check).toMatchObject({ print_ok: false, check: "contrast" });
    expect(check.resolution.ok).toBe(true);
  });

  it("one ×2 is allowed on the cleaned PNG", () => {
    expect(checkResolution({ productType: "sticker", width: 450, height: 450 }).ok).toBe(true);
    expect(checkResolution({ productType: "sticker", width: 449, height: 2000 }).ok).toBe(false);
  });
});

// ---------- approve with acceptPrintWarning ----------
type Row = Record<string, unknown>;
const st = { listing: null as Row | null, published: false, saved: [] as unknown[], cleaned: null as Buffer | null };
vi.mock("@/lib/db/queries", () => ({
  getListing: async () => st.listing,
  upsertListing: async (v: Row) => { st.listing = { ...st.listing, ...v }; return st.listing; },
  updateProduct: async (_id: string, patch: Row) => { st.published = patch.status === "published"; return { id: "p1", ...patch }; },
  getCreatorById: async () => ({ storyVideoUrl: "x" }),
  getArtwork: async () => ({ id: "a1", cleanedUrl: "cleaned.png" }),
  setListingPrintCheck: async (_id: string, c: unknown) => { st.saved.push(c); },
  setListingDraftCopy: async () => undefined, insertProduct: async () => null,
}));
vi.mock("@/lib/ai/registry", () => ({ ai: async () => ({ listingAgent: { moderate: async () => ({ ok: true, reason: "" }) } }) }));
vi.mock("@/lib/storage", () => ({ storage: () => ({ read: async () => st.cleaned! }), creatorPath: () => "" }));

import { approveListing } from "@/lib/pipeline/products";

const product = { id: "p1", creatorId: "c1", artworkId: "a1", type: "sticker", priceCents: 500, status: "draft" } as never;
const listingWith = async (cleaned: Buffer) => {
  st.cleaned = cleaned;
  st.listing = { productId: "p1", title: "Frog", description: "A frog.", tags: [], priceSuggestionCents: 500, moderation: { ok: true, reason: "" }, printCheck: await measurePrintCheck("sticker", cleaned) };
};

describe("approve: print warning and hard gate", () => {
  beforeEach(() => { st.listing = null; st.published = false; st.saved = []; });

  it("contrast warning: 409 check contrast without the flag, published with acceptPrintWarning (recorded)", async () => {
    await listingWith(await pencilSketch());
    await expect(approveListing(product, { approvedVia: "tap" })).rejects.toMatchObject({ status: 409, code: "print_check_failed", details: { check: "contrast" } });
    expect(st.published).toBe(false);
    await approveListing(product, { approvedVia: "tap", acceptPrintWarning: true });
    expect(st.published).toBe(true);
    expect(st.listing!.printCheck).toMatchObject({ check: "contrast", acceptedWarning: true });
  });

  it("resolution failure: 409 check resolution even with acceptPrintWarning", async () => {
    await listingWith(await svg(120, 120, "", "#222"));
    await expect(approveListing(product, { approvedVia: "tap", acceptPrintWarning: true })).rejects.toMatchObject({ status: 409, details: { check: "resolution" } });
    expect(st.published).toBe(false);
  });

  it("a check saved under the old greyscale rule is measured again (and saved) before the gate", async () => {
    st.cleaned = await svg(800, 800, `<circle cx="400" cy="400" r="300" fill="#ffe680"/>`, "#fff6c0"); // failed the old rule
    st.listing = { productId: "p1", title: "Frog", description: "A frog.", tags: [], priceSuggestionCents: 500, moderation: { ok: true, reason: "" }, printCheck: { print_ok: false, notes: "Low contrast" } };
    await approveListing(product, { approvedVia: "tap" });
    expect(st.published).toBe(true);
    expect(st.saved[0]).toMatchObject({ version: 2, print_ok: true, check: null });
  });
});
