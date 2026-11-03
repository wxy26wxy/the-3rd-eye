/** T143: `POST /products` on a change result builds from that row's own cut (Changing = change → cutout → products). */
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const files = new Map<string, Buffer>();
const inserted: Record<string, unknown>[] = [];
const reads: string[] = [];
let n = 0;
vi.mock("@/lib/storage", () => ({
  storage: () => ({
    read: async (p: string) => { reads.push(p); const b = files.get(p); if (!b) throw new Error(`missing ${p}`); return b; },
    putPublic: async (p: string, d: Buffer) => { files.set(p, d); return { pathname: p, url: `https://pub/${p}` }; },
    putPrivate: async (p: string, d: Buffer) => { files.set(p, d); return { pathname: p, url: p }; },
  }),
  creatorPath: (_c: string, kind: string, ext: string) => `creators/c1/${kind}/new-${++n}.${ext}`,
}));
vi.mock("@/lib/db/queries", () => ({
  insertProduct: async (v: Record<string, unknown>) => { inserted.push(v); return { id: "prC", ...v }; },
  getProductByClientRequest: async () => null,
  isUniqueViolation: () => false,
}));
vi.mock("@/lib/ai/registry", () => ({ ai: async () => ({ mockups: { make: async () => sharp({ create: { width: 64, height: 64, channels: 3, background: "#eee" } }).png().toBuffer() } }) }));

import { createProductOnce } from "@/lib/pipeline/products";

describe("createProductOnce on a change result", () => {
  it("uses the change result's cleaned PNG (not the parent's, not the edited picture) and stores the product on the child row", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><circle cx="500" cy="500" r="480" fill="#609"/><circle cx="500" cy="500" r="200" fill="#fc0"/></svg>`;
    files.set("child-cut.png", await sharp(Buffer.from(svg)).png().toBuffer());
    const child = {
      id: "ch1", creatorId: "c1", parentArtworkId: "a1", changeInstruction: "make it purple", source: "photo",
      originalUrl: "edited-only-private.png", cleanedUrl: "child-cut.png", status: "ready",
    };
    const { row, repeated } = await createProductOnce(child as never, "sticker", "T143", "k-ch");
    expect(repeated).toBe(false);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ artworkId: "ch1", creatorId: "c1", type: "sticker", status: "draft", clientRequestId: "k-ch" });
    expect((row as { mockupUrl: string }).mockupUrl).toMatch(/^https:\/\/pub\/creators\/c1\/mockups\//);
    expect((row as { previewUrl: string }).previewUrl).toMatch(/^https:\/\/pub\/creators\/c1\/previews\//);
    expect(reads).toEqual(["child-cut.png"]); // the product comes from the cut, never the edited picture
  });
});
