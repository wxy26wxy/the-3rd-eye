import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const files = new Map<string, Buffer>();
const state = { product: null as Record<string, unknown> | null, printCheck: null as unknown, patch: null as Record<string, unknown> | null };
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => files.get(p)!,
    putPublic: async (p: string, d: Buffer) => { files.set(p, d); return { pathname: p, url: p }; },
    putPrivate: async (p: string, d: Buffer) => { files.set(p, d); return { pathname: p, url: p }; },
  }),
  creatorPath: (_c: string, kind: string, ext: string) => `creators/c1/${kind}/new-${++n}.${ext}`,
}));
vi.mock("@/lib/db/queries", () => ({
  getProduct: async () => state.product,
  getArtwork: async () => ({ id: "a1", creatorId: "c1", cleanedUrl: "cleaned.png" }),
  setListingPrintCheck: async (_id: string, c: unknown) => { state.printCheck = c; },
  updateProduct: async (id: string, patch: Record<string, unknown>) => { state.patch = patch; return { ...state.product, id, ...patch }; },
}));
vi.mock("@/lib/ai/registry", () => ({ ai: async () => ({ mockups: { make: async () => sharp({ create: { width: 64, height: 64, channels: 3, background: "#eee" } }).png().toBuffer() } }) }));

import { rebuildProductFiles } from "@/lib/pipeline/products";

/** A two-colour art with good contrast on transparent background. */
async function art(w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2 - 2}" fill="#111"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#fc0"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("rebuildProductFiles", () => {
  beforeEach(() => { files.clear(); state.printCheck = null; state.patch = null; });

  it("replaces print files and mockup, keeps status, writes a passing print check", async () => {
    files.set("cleaned.png", await art(1000, 1000));
    state.product = { id: "p1", artworkId: "a1", creatorId: "c1", type: "sticker", status: "published", printPngUrl: "old.png", printSvgUrl: "old.svg", mockupUrl: "old-m.png" };
    const out = await rebuildProductFiles("p1");
    expect(out.unpublished).toBe(false);
    expect(state.patch?.printPngUrl).not.toBe("old.png");
    expect(state.patch?.printSvgUrl).toMatch(/\.svg$/);
    expect(state.patch?.mockupUrl).not.toBe("old-m.png");
    expect(state.patch?.status).toBeUndefined();
    expect((state.printCheck as { print_ok: boolean }).print_ok).toBe(true);
  });

  it("a published product whose new cut is too small goes back to draft", async () => {
    files.set("cleaned.png", await art(60, 60)); // ×2 upscale caps → far under the sticker's minimum
    state.product = { id: "p1", artworkId: "a1", creatorId: "c1", type: "sticker", status: "published" };
    const out = await rebuildProductFiles("p1");
    expect(out.unpublished).toBe(true);
    expect(state.patch?.status).toBe("draft");
    expect((state.printCheck as { print_ok: boolean }).print_ok).toBe(false);
  });
});
