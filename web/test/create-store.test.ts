import { describe, expect, it } from "vitest";
import {
  addChange, backToOriginal, currentArtworkId, currentChange, getDraft, pieceCutout, resetDraft, updateDraft, type ChangeStep, type Draft,
} from "@/components/create/store";

const piece: Draft = {
  product: "sticker", method: "photo", photoArtworkId: "p1",
  candidates: [{ id: "c1", bbox: [0, 0, 10, 10], score: 0.9, thumbUrl: "/c1.png" }, { id: "c2", bbox: [10, 10, 20, 20], score: 0.8, thumbUrl: "/c2.png" }],
  imageSize: { w: 100, h: 100 },
  pieceArtworkId: "p1", pieceCandidateId: "c2", pieceUrl: "/piece.png", pieceAlt: "A fern", pieceSpoken: "A fern drawn in pen.",
};
const step = (id: string, parentId: string): ChangeStep => ({
  artworkId: id, parentId, instruction: `change ${id}`, previewUrl: `/${id}.png`, alt: `alt ${id}`, spoken: `spoken ${id}`, differences: "",
});

describe("creator draft v3 (T113): piece, changes, cutout", () => {
  it("no change yet: the piece is on screen, and its cut-out from select is ready without a call", () => {
    expect(currentChange(piece)).toBeNull();
    expect(currentArtworkId(piece)).toBe("p1");
    expect(pieceCutout(piece)).toEqual({
      artworkId: "p1", candidates: piece.candidates, imageSize: { w: 100, h: 100 }, selectedIds: ["c2"], cleanedUrl: "/piece.png", altText: "A fern",
    });
  });

  it("a change goes on screen; Change it again edits the child; Back to my original walks to the parent", () => {
    let d: Draft = { ...piece, ...addChange(piece, step("k1", "p1")) };
    expect(d.changedArtworkId).toBe("k1");
    expect(currentArtworkId(d)).toBe("k1");
    // a change result has no cut-out yet: the cutout screen makes it
    expect(pieceCutout(d)).toBeNull();
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
