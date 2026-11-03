import { describe, expect, it } from "vitest";
import {
  addChange, backToOriginal, currentArtworkId, currentChange, cutoutOf, getDraft, madeFor, productPlan, recordProduct, resetDraft, updateDraft, withCutout, type ChangeStep, type CutoutState, type Draft,
} from "@/components/create/store";

const piece: Draft = {
  product: "sticker", method: "photo",
  pieceArtworkId: "p1", pieceUrl: "/piece.png", pieceAlt: "A fern", pieceSpoken: "A fern drawn in pen.",
};
const step = (id: string, parentId: string): ChangeStep => ({
  artworkId: id, parentId, instruction: `change ${id}`, previewUrl: `/${id}.png`, alt: `alt ${id}`, spoken: `spoken ${id}`, differences: "",
});

describe("creator draft v3 (T113): piece, changes, cutout", () => {
  it("no change yet: the piece is on screen; cuts are kept per artwork (T130)", () => {
    expect(currentChange(piece)).toBeNull();
    expect(currentArtworkId(piece)).toBe("p1");
    const cut: CutoutState = { artworkId: "k1", candidates: [], imageSize: { w: 10, h: 10 }, selectedIds: [], cleanedUrl: "/k1-cut.png", altText: null, box: [0, 0, 10, 10], points: [] };
    const d = { ...piece, ...withCutout({ ...piece, cutouts: { p1: { ...cut, artworkId: "p1" } } }, cut) };
    expect(Object.keys(d.cutouts ?? {})).toEqual(["p1", "k1"]);
    expect(cutoutOf(d, "k1")?.cleanedUrl).toBe("/k1-cut.png");
    expect(cutoutOf(d, "k2")).toBeNull();
    expect(cutoutOf(d, undefined)).toBeNull();
  });

  it("a change goes on screen; Change it again edits the child; Back to my original walks to the parent", () => {
    let d: Draft = { ...piece, ...addChange(piece, step("k1", "p1")) };
    expect(d.changedArtworkId).toBe("k1");
    expect(currentArtworkId(d)).toBe("k1");
    d = { ...d, ...addChange(d, step("k2", "k1")) };
    expect(d.changes?.map((c) => c.artworkId)).toEqual(["k1", "k2"]);
    expect(currentArtworkId(d)).toBe("k2");
    d = { ...d, ...backToOriginal(d) };
    expect(currentArtworkId(d)).toBe("k1");
    d = { ...d, ...backToOriginal(d) };
    expect(d.changedArtworkId).toBeUndefined();
    expect(currentArtworkId(d)).toBe("p1");
    // nothing to go back to on the piece
    expect(backToOriginal(d)).toEqual({});
  });

  it("the same child recorded twice is kept once", () => {
    const d = { ...piece, ...addChange(piece, step("k1", "p1")) };
    expect(addChange(d, step("k1", "p1")).changes).toHaveLength(1);
  });

  it("the store keeps the new fields and drops nothing it was not asked to (resetDraft keeps what it is given)", () => {
    resetDraft({ product: "tote" });
    updateDraft({ pieceArtworkId: "p1", changedArtworkId: "k1", changeInstruction: "Make the book red", cutoutArtworkId: "k1" });
    expect(getDraft()).toEqual({ product: "tote", pieceArtworkId: "p1", changedArtworkId: "k1", changeInstruction: "Make the book red", cutoutArtworkId: "k1" });
    resetDraft({ product: "tote" });
    expect(getDraft()).toEqual({ product: "tote" });
  });
});

describe("R1 + T130: the product picture on creator screens", () => {
  it("round 3 ruling 1: the AI photo for both types; else a sticker's bordered preview; else the cut-out art", async () => {
    const { pictureOf } = await import("@/components/create/store");
    expect(pictureOf({ type: "sticker", previewUrl: "/preview.png", mockupUrl: "/m.png" }, { cleanedUrl: "/cut.png" })).toEqual({ src: "/m.png", kind: "photo" });
    expect(pictureOf({ type: "sticker", previewUrl: "/preview.png", mockupUrl: null }, { cleanedUrl: "/cut.png" })).toEqual({ src: "/preview.png", kind: "sticker" });
    expect(pictureOf({ type: "sticker", previewUrl: null, mockupUrl: null }, { cleanedUrl: "/cut.png" })).toEqual({ src: "/cut.png", kind: "art" });
    expect(pictureOf({ type: "tote", previewUrl: null, mockupUrl: "/tote-mockup.png" }, { cleanedUrl: "/cut.png" })).toEqual({ src: "/tote-mockup.png", kind: "photo" });
    expect(pictureOf({ type: "tote", previewUrl: null, mockupUrl: null }, { cleanedUrl: "/cut.png" })).toEqual({ src: "/cut.png", kind: "art" });
    expect(pictureOf(null, null)).toEqual({ src: null, kind: "art" });
  });
});

describe("round 4 ruling 2: one draft product per artwork and type, made before Change it", () => {
  const product = { id: "pr1", artworkId: "p1", creatorId: "me", type: "sticker" as const, mockupUrl: "/m.png", printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: "/pv.png" };
  const cut: CutoutState = { artworkId: "p1", candidates: [], imageSize: null, selectedIds: [], cleanedUrl: "/cut-1.png", altText: null, box: null, points: [] };
  const made: Draft = { ...piece, made: { p1: { ...product, cut: "/cut-1.png" } }, cutouts: { p1: cut } };
  it("the same artwork and type is ready (no second POST); another artwork or type makes one", () => {
    expect(productPlan(made, "p1")).toBe("ready");
    expect(madeFor(made, "p1")?.id).toBe("pr1");
    expect(productPlan(made, "k1")).toBe("make");
    expect(productPlan({ ...made, product: "tote" }, "p1")).toBe("make");
    expect(madeFor({ ...made, product: "tote" }, "p1")).toBeNull();
    expect(productPlan({ ...made, made: undefined }, "p1")).toBe("make");
  });
  it("a later cut on that artwork (the server rebuilt its files) without the new pictures: refresh", () => {
    expect(productPlan({ ...made, cutouts: { p1: { ...cut, cleanedUrl: "/cut-2.png" } } }, "p1")).toBe("refresh");
  });
  it("review m4: recording a rebuilt product that is on the listing drops the old listing (its print check is stale)", () => {
    const listed: Draft = { ...made, productRecord: product, listing: { title: "Old", description: "", tags: [], price_cents: 500, print_ok: false, print_check: "resolution", notes: "" }, listingRun: "r1", trace: [] };
    const patch = recordProduct(listed, "p1", { ...product, mockupUrl: "/m2.png", cut: "/cut-2.png" });
    expect(patch).toMatchObject({ productRecord: { ...product, mockupUrl: "/m2.png" }, listing: undefined, listingRun: undefined, trace: undefined });
    expect(patch.productRecord).not.toHaveProperty("cut");
    expect(patch.made?.p1).toMatchObject({ mockupUrl: "/m2.png", cut: "/cut-2.png" });
    // another product: the listing is left alone
    expect(recordProduct(listed, "k1", { ...product, id: "pr2", cut: null })).not.toHaveProperty("listing");
  });
});
