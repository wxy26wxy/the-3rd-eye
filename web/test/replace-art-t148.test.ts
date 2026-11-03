import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { MetaSegmenter } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";
import {
  archivePrevious, boxToPixels, describePrintCheck, parseBox, parseReplaceArtArgs, phrasesFor, preparePicture, replaceArt,
  SHOP_BASE, type ReplaceArtDeps,
} from "@/lib/pipeline/replace-art";

const picture = (w: number, h: number) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#3060c0"/><rect x="${w / 2}" y="${h / 2}" width="${w / 2}" height="${h / 2}" fill="#e02020"/></svg>`)).png().toBuffer();

describe("pnpm replace-art: arguments", () => {
  it("parses the positionals and every option in any order", () => {
    expect(parseReplaceArtArgs(["june-park", "a.png", "tote", "--box", "0.1,0.2,0.9,0.95", "--phrase", "ivy plant in a pot", "--title", " Sad Ivy ", "--dry-run", "--keep-old"]))
      .toEqual({ slug: "june-park", file: "a.png", type: "tote", box: [0.1, 0.2, 0.9, 0.95], phrases: ["ivy plant in a pot"], title: "Sad Ivy", dryRun: true, keepOld: true });
    expect(parseReplaceArtArgs(["--dry-run", "june-park", "b.png", "sticker"]))
      .toEqual({ slug: "june-park", file: "b.png", type: "sticker", box: undefined, phrases: [], title: undefined, dryRun: true, keepOld: false });
  });

  it("collects repeated --phrase values (no duplicates)", () => {
    expect(parseReplaceArtArgs(["s", "f", "sticker", "--phrase", "drawing", "--phrase", "cactus in a pot", "--phrase", "drawing"]).phrases)
      .toEqual(["drawing", "cactus in a pot"]);
  });

  it("rejects a wrong type, missing positionals, unknown options and options without a value", () => {
    expect(() => parseReplaceArtArgs(["s", "f", "mug"])).toThrow(/sticker or tote/);
    expect(() => parseReplaceArtArgs(["s", "f"])).toThrow(/need <slug>/);
    expect(() => parseReplaceArtArgs(["s", "f", "tote", "extra"])).toThrow(/need <slug>/);
    expect(() => parseReplaceArtArgs(["s", "f", "tote", "--force"])).toThrow(/unknown option/);
    expect(() => parseReplaceArtArgs(["s", "f", "tote", "--phrase"])).toThrow(/needs a value/);
    expect(() => parseReplaceArtArgs(["s", "f", "tote", "--box", "--dry-run"])).toThrow(/needs a value/);
  });

  it("--box takes four fractions with x0 < x1 and y0 < y1", () => {
    expect(parseBox("0, 0.25 ,1,0.5")).toEqual([0, 0.25, 1, 0.5]);
    expect(() => parseBox("0.1,0.2,0.3")).toThrow(/four numbers/);
    expect(() => parseBox("0.1,0.2,0.3,x")).toThrow(/four numbers/);
    expect(() => parseBox("0.1,,0.3,0.4")).toThrow(/four numbers/);
    expect(() => parseBox("0.1,0.2,1.3,0.4")).toThrow(/between 0 and 1/);
    expect(() => parseBox("0.5,0.2,0.3,0.4")).toThrow(/x0 < x1/);
  });

  it("phrases: the app's default pair unless --phrase is given", () => {
    expect(phrasesFor([])).toBeUndefined();
    expect(phrasesFor(["cactus in a pot"])).toEqual(["cactus in a pot"]);
  });
});

describe("pnpm replace-art: box crop maths", () => {
  it("maps fractions to pixels, rounding the edges outward", () => {
    expect(boxToPixels([0.51, 0.33, 0.94, 0.86], 1740, 2732)).toEqual({ left: 887, top: 901, width: 749, height: 1449 });
    expect(boxToPixels([0, 0, 1, 1], 100, 50)).toEqual({ left: 0, top: 0, width: 100, height: 50 });
    expect(boxToPixels([0.333, 0.333, 0.667, 0.667], 10, 10)).toEqual({ left: 3, top: 3, width: 4, height: 4 });
  });

  it("clamps to the picture and keeps at least one pixel", () => {
    expect(boxToPixels([0.999, 0.999, 1, 1], 10, 10)).toEqual({ left: 9, top: 9, width: 1, height: 1 });
    expect(boxToPixels([0.5, 0.5, 0.5001, 0.5001], 10, 10)).toEqual({ left: 5, top: 5, width: 1, height: 1 });
  });

  it("upscales ×2 (Lanczos) when the short side is under 1800, then crops", async () => {
    const out = await preparePicture(await picture(870, 1366), [0.5, 0.5, 1, 1]);
    expect(out.upscale).toBe(2);
    expect([out.width, out.height]).toEqual([870, 1366]);
    const meta = await sharp(out.png).metadata();
    expect([meta.width, meta.height]).toEqual([870, 1366]);
    // the crop is the red quarter (sampled away from the Lanczos edge)
    const { data, info } = await sharp(out.png).raw().toBuffer({ resolveWithObject: true });
    const i = (Math.round(info.height / 2) * info.width + Math.round(info.width / 2)) * info.channels;
    expect([data[i], data[i + 1], data[i + 2]]).toEqual([0xe0, 0x20, 0x20]);
  });

  it("leaves a big picture's size alone and caps the long side at 4096 px", async () => {
    const big = await preparePicture(await picture(2000, 1900));
    expect([big.width, big.height, big.upscale]).toEqual([2000, 1900, 1]);
    const huge = await preparePicture(await picture(5000, 2500));
    expect([huge.width, huge.height]).toEqual([4096, 2048]);
    // a long, narrow picture is upscaled ×2 and capped again after the upscale
    const narrow = await preparePicture(await picture(800, 3000));
    expect([narrow.width, narrow.height]).toEqual([1092, 4096]);
  });
});

type P = { id: string; type: string; status: string; artworkId: string };
function archiveDeps(products: P[]) {
  return {
    listCreatorProducts: vi.fn(async () => products),
    listArtworkProducts: vi.fn(async (artworkId: string) => products.filter((p) => p.artworkId === artworkId && p.status !== "archived")),
    archiveArtwork: vi.fn(async () => {}),
    archiveProduct: vi.fn(async () => {}),
  };
}

describe("pnpm replace-art: archive rule", () => {
  it("soft-deletes the artworks of the creator's other published products of that type only", async () => {
    const deps = archiveDeps([
      { id: "new", type: "sticker", status: "draft", artworkId: "a-new" },
      { id: "s1", type: "sticker", status: "published", artworkId: "a1" },
      { id: "s2", type: "sticker", status: "draft", artworkId: "a2" },
      { id: "s3", type: "sticker", status: "archived", artworkId: "a3" },
      { id: "t1", type: "tote", status: "published", artworkId: "a4" },
    ]);
    expect(await archivePrevious(deps, "c1", "sticker", "new")).toEqual(["s1"]);
    expect(deps.archiveArtwork.mock.calls).toEqual([["a1"]]);
    expect(deps.archiveProduct).not.toHaveBeenCalled();
  });

  it("never archives the new product, even once it is published", async () => {
    const deps = archiveDeps([{ id: "new", type: "tote", status: "published", artworkId: "a-new" }]);
    expect(await archivePrevious(deps, "c1", "tote", "new")).toEqual([]);
    expect(deps.archiveArtwork).not.toHaveBeenCalled();
  });

  it("archives only the product when its artwork also carries a live product of the other type", async () => {
    const deps = archiveDeps([
      { id: "s1", type: "sticker", status: "published", artworkId: "a1" },
      { id: "t1", type: "tote", status: "published", artworkId: "a1" },
    ]);
    expect(await archivePrevious(deps, "c1", "sticker", "new")).toEqual(["s1"]);
    expect(deps.archiveProduct.mock.calls).toEqual([["s1"]]);
    expect(deps.archiveArtwork).not.toHaveBeenCalled();
  });

  it("soft-deletes an artwork once for two published products of that type", async () => {
    const deps = archiveDeps([
      { id: "s1", type: "sticker", status: "published", artworkId: "a1" },
      { id: "s2", type: "sticker", status: "published", artworkId: "a1" },
    ]);
    expect(await archivePrevious(deps, "c1", "sticker", "new")).toEqual(["s1", "s2"]);
    expect(deps.archiveArtwork).toHaveBeenCalledTimes(1);
  });
});

function pipelineDeps(over: Partial<ReplaceArtDeps> = {}) {
  const lines: string[] = [];
  const product = { id: "p-new", type: "sticker", status: "draft", artworkId: "a-new" };
  const deps: ReplaceArtDeps = {
    readFile: vi.fn(async () => picture(400, 600)),
    log: (l) => lines.push(l),
    previewCut: vi.fn(async (png: Buffer) => ({ cleaned: png, pieces: 2 })),
    writeLocal: vi.fn(async (name: string) => `.replace-art/${name}`),
    findCreator: vi.fn(async () => ({ id: "c1" })),
    uploadPhoto: vi.fn(async () => "https://pub.example/creators/c1/photo/x.png"),
    createFromImage: vi.fn(async () => ({ artwork: { id: "a-new", cleanedUrl: "https://pub.example/c.png" } })),
    createProduct: vi.fn(async () => product),
    runListingAgent: vi.fn(async () => ({ row: { printCheck: null } })),
    approveListing: vi.fn(async () => ({ product: { ...product, status: "published" }, listing: { printCheck: { print_ok: true, check: null, resolution: { ok: true } } } })),
    listCreatorProducts: vi.fn(async () => [{ id: "p-old", type: "sticker", status: "published", artworkId: "a-old" }, { ...product, status: "published" }]),
    listArtworkProducts: vi.fn(async () => [{ id: "p-old", type: "sticker", status: "published", artworkId: "a-old" }]),
    archiveArtwork: vi.fn(async () => {}),
    archiveProduct: vi.fn(async () => {}),
    ...over,
  };
  return { deps, lines };
}

const base = { slug: "june-park", file: "x.png", type: "sticker" as const, phrases: [] as string[], dryRun: false, keepOld: false };

describe("pnpm replace-art: the run (pipeline mocked)", () => {
  it("dry run: cuts and writes the crop and the cut only; no creator lookup, upload or database call", async () => {
    const { deps, lines } = pipelineDeps();
    const out = await replaceArt(deps, { ...base, dryRun: true, box: [0, 0, 0.5, 0.5], phrases: ["cactus in a pot"] });
    expect(out).toEqual({ dryRun: true, cropPath: ".replace-art/june-park-sticker-crop.png", cutPath: ".replace-art/june-park-sticker-cut.png", pieces: 2 });
    expect(vi.mocked(deps.previewCut).mock.calls[0][1]).toEqual(["cactus in a pot"]);
    for (const f of [deps.findCreator, deps.uploadPhoto, deps.createFromImage, deps.createProduct, deps.approveListing, deps.listCreatorProducts, deps.archiveArtwork]) {
      expect(f).not.toHaveBeenCalled();
    }
    expect(lines.join("\n")).toMatch(/upscaled x2/);
  });

  it("uploads, cuts framed, lists, approves with the warning accepted, archives the old one and prints the shop URL", async () => {
    const { deps, lines } = pipelineDeps();
    const out = await replaceArt(deps, { ...base, phrases: ["cactus in a pot"], title: "Grumpy Cactus" });
    expect(vi.mocked(deps.createFromImage).mock.calls[0]).toEqual(["c1", {
      source: "photo", imageUrl: "https://pub.example/creators/c1/photo/x.png", product: "sticker", framed: true, phrases: ["cactus in a pot"],
    }]);
    expect(vi.mocked(deps.approveListing).mock.calls[0][1]).toEqual({ approvedVia: "tap", acceptPrintWarning: true, edits: { title: "Grumpy Cactus" } });
    expect(deps.archiveArtwork).toHaveBeenCalledWith("a-old");
    expect(out).toEqual({ dryRun: false, artworkId: "a-new", productId: "p-new", printCheck: "ok", shopUrl: `${SHOP_BASE}/p/p-new`, archived: ["p-old"] });
    expect(lines).toContain(`shop: ${SHOP_BASE}/p/p-new`);
  });

  it("--keep-old archives nothing; no --phrase sends no phrases", async () => {
    const { deps } = pipelineDeps();
    const out = await replaceArt(deps, { ...base, keepOld: true });
    expect(out.dryRun === false && out.archived).toEqual([]);
    expect(deps.listCreatorProducts).not.toHaveBeenCalled();
    expect(vi.mocked(deps.createFromImage).mock.calls[0][1]).not.toHaveProperty("phrases");
  });

  it("a resolution block is reported and nothing is archived", async () => {
    const { deps, lines } = pipelineDeps({
      runListingAgent: vi.fn(async () => ({ row: { printCheck: { print_ok: false, check: "resolution", resolution: { ok: false, message: "too small" } } } })),
      approveListing: vi.fn(async () => { throw new Error("print_check_failed"); }),
    });
    await expect(replaceArt(deps, base)).rejects.toThrow("print_check_failed");
    expect(lines).toContain("print check: resolution: too small");
    expect(deps.archiveArtwork).not.toHaveBeenCalled();
  });

  it("a hidden creator is refused before any upload", async () => {
    const { deps } = pipelineDeps({ findCreator: vi.fn(async () => ({ id: "c1", hidden: true })) });
    await expect(replaceArt(deps, base)).rejects.toThrow(/is hidden/);
    expect(deps.uploadPhoto).not.toHaveBeenCalled();
  });

  it("an archive failing partway after publishing names the products still live and fails the run", async () => {
    const { deps, lines } = pipelineDeps({
      listCreatorProducts: vi.fn(async () => [
        { id: "p-old1", type: "sticker", status: "published", artworkId: "a1" },
        { id: "p-old2", type: "sticker", status: "published", artworkId: "a2" },
      ]),
      listArtworkProducts: vi.fn(async (artworkId: string) => [{ id: artworkId === "a1" ? "p-old1" : "p-old2", type: "sticker", status: "published", artworkId }]),
      archiveArtwork: vi.fn(async (artworkId: string) => { if (artworkId === "a2") throw new Error("db down"); }),
    });
    await expect(replaceArt(deps, base)).rejects.toThrow(/archive incomplete: db down/);
    expect(lines).toContain("published p-new; archive incomplete; still live: p-old2 — archive them by hand, do not re-run");
  });

  it("an unknown slug stops before any upload", async () => {
    const { deps } = pipelineDeps({ findCreator: vi.fn(async () => null) });
    await expect(replaceArt(deps, base)).rejects.toThrow(/no creator with slug june-park/);
    expect(deps.uploadPhoto).not.toHaveBeenCalled();
  });

  it("describes the print check in one line", () => {
    expect(describePrintCheck(null)).toBe("not measured");
    expect(describePrintCheck({ print_ok: false, check: "contrast", resolution: { ok: true } })).toBe("contrast warning (accepted)");
    expect(describePrintCheck({ print_ok: true, check: null, resolution: { ok: true } })).toBe("ok");
  });
});

describe("findCandidates phrases override (T148)", () => {
  const load = (name: string) => JSON.parse(readFileSync(join(__dirname, `fixtures/segment/${name}`), "utf8")) as { type: string }[];
  async function* replay(list: { type: string }[]) { for (const e of list) yield e; }
  const textOf = (body: Record<string, unknown>) => ((body.input as { content: { type: string; text?: string }[] }[])[0].content.find((c) => c.type === "input_text")?.text ?? "");

  it("searches only the given phrases", async () => {
    const sent: string[] = [];
    const sam = new MetaSegmenter(async (body) => { sent.push(textOf(body)); return replay(load("probe-box-events.json")); });
    await sam.findCandidates(pngRef(await picture(320, 256)), { trace: { stage: "segment" }, phrases: ["cactus in a pot"] });
    expect(sent).toEqual(["cactus in a pot"]);
  });
});
