import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PREVIEW_MAX_PX } from "@/lib/image/sticker";
import { backfillPreviews, renderStickerPreview, type BackfillCandidate, type BackfillDeps } from "@/lib/pipeline/backfill-previews";

/** A dark disc on a transparent w × h canvas. */
async function disc(w: number, h: number) {
  const r = Math.min(w, h) / 2 - 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="#203040"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("renderStickerPreview", () => {
  it("builds the preview alone from a cleaned PNG, never enlarged", async () => {
    const png = await renderStickerPreview(await disc(300, 300));
    const meta = await sharp(png).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(PREVIEW_MAX_PX);
    expect(meta.hasAlpha).toBe(true);
  });
});

describe("backfillPreviews", () => {
  /** An in-memory products table: preview_url per sticker. */
  function fakeDb(initial: Record<string, string | null>) {
    const table = new Map(Object.entries(initial));
    const puts: string[] = [];
    let renders = 0;
    const deps: BackfillDeps = {
      list: async () => [...table.entries()].filter(([, v]) => v === null)
        .map(([productId]): BackfillCandidate => ({ productId, creatorId: "c1", cleanedUrl: `cleaned/${productId}.png` })),
      read: async () => Buffer.from("png"),
      render: async () => { renders++; return Buffer.from("preview"); },
      put: async () => { const u = `https://pub/previews/${puts.length + 1}.png`; puts.push(u); return u; },
      setIfMissing: async (id, url) => { if (table.get(id) !== null) return false; table.set(id, url); return true; },
    };
    return { table, deps, puts, renders: () => renders };
  }

  it("builds only the missing previews, and a second run changes nothing", async () => {
    const f = fakeDb({ p1: null, p2: "https://pub/previews/old.png", p3: null });
    const first = await backfillPreviews(f.deps);
    expect(first).toEqual({ found: 2, updated: 2, skipped: 0, failed: 0, dryRun: false });
    expect(f.table.get("p2")).toBe("https://pub/previews/old.png");
    expect(f.table.get("p1")).toMatch(/^https:\/\/pub\/previews\//);
    const snapshot = new Map(f.table);
    const second = await backfillPreviews(f.deps);
    expect(second).toEqual({ found: 0, updated: 0, skipped: 0, failed: 0, dryRun: false });
    expect(f.table).toEqual(snapshot);
    expect(f.renders()).toBe(2);
  });

  it("--dry-run writes nothing", async () => {
    const f = fakeDb({ p1: null });
    const out = await backfillPreviews(f.deps, { dryRun: true });
    expect(out).toEqual({ found: 1, updated: 0, skipped: 0, failed: 0, dryRun: true });
    expect(f.puts).toEqual([]);
    expect(f.renders()).toBe(0);
    expect(f.table.get("p1")).toBeNull();
  });

  it("a row that got a preview meanwhile is skipped; a failing render is counted and the run continues", async () => {
    const f = fakeDb({ p1: null, p2: null });
    const deps: BackfillDeps = {
      ...f.deps,
      render: async (png) => { if (f.puts.length === 0 && png) { f.table.set("p1", "https://pub/raced.png"); } return Buffer.from("x"); },
    };
    const out = await backfillPreviews(deps);
    expect(out.skipped).toBe(1);
    expect(out.updated).toBe(1);
    expect(f.table.get("p1")).toBe("https://pub/raced.png");

    const g = fakeDb({ p1: null, p2: null });
    let calls = 0;
    const out2 = await backfillPreviews({ ...g.deps, render: async () => { if (calls++ === 0) throw new Error("bad png"); return Buffer.from("x"); } });
    expect(out2).toMatchObject({ found: 2, updated: 1, failed: 1 });
  });
});
