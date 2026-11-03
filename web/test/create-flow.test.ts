import { describe, expect, it, vi } from "vitest";
import {
  STORY_REDO_RETURN, storyVideoDone, adjustBack, adjustWholePhoto, afterPhoto, applyMarks, areaRequest, busyWhile, changeItBack, changeRequest, changingEntry, changingVisit, cutArea,
  changeItCut, cutoutVisit, leaveChanging, makingCutoutBack, pickPiece, runAreaCut, runChange, runChangeCut, skipChange, submitChange, takeChange, takeCutout, yourCutoutBack, type FlowDeps,
} from "@/components/create/flow";
import { marksRequest } from "@/components/create/cutout";
import { dragFrame, initialFrame, keyFrame, moveFrame, resizeFrame, frameSize } from "@/components/create/area";
import { ApiError } from "@/components/create/api";
import { areaError } from "@/components/create/screens/AdjustArea";
import { m } from "@/components/messages";
import { addChange, backToOriginal, currentArtworkId, cutoutOf, once, productToMake, type ChangeStep, type CutoutState, type Draft } from "@/components/create/store";

/** A draft held in memory, a router that records calls, and an api answering by path. */
function harness(start: Draft, answers: Record<string, unknown> = {}) {
  let draft: Draft = { ...start };
  const calls: string[] = [];
  const api = vi.fn(async (path: string, init?: { json?: unknown }) => {
    calls.push(`api ${path} ${JSON.stringify(init?.json ?? null)}`);
    const a = Object.entries(answers).find(([suffix]) => path.endsWith(suffix))?.[1];
    if (a instanceof Error) throw a;
    return a;
  });
  const deps: FlowDeps = {
    api: api as unknown as FlowDeps["api"],
    getDraft: () => draft,
    update: (patch) => { calls.push(`update ${Object.keys(patch).join(",")}`); draft = { ...draft, ...patch }; },
    router: { push: (h) => calls.push(`push ${h}`), replace: (h) => calls.push(`replace ${h}`) },
  };
  return { deps, calls, api, get draft() { return draft; } };
}

const candidates = [{ id: "c1", bbox: [0, 0, 10, 10] as [number, number, number, number], score: 0.9, thumbUrl: "/c1.png" }, { id: "c2", bbox: [10, 10, 20, 20] as [number, number, number, number], score: 0.8, thumbUrl: "/c2.png" }];
const artwork = (over: Record<string, unknown> = {}) => ({
  id: "p1", creatorId: "me", source: "photo" as const, transcript: null, shapedPrompt: null, originalUrl: "o", cleanedUrl: null, altText: "A fern",
  spokenDescription: "A fern drawn in pen.", differencesFromPrompt: null, parentArtworkId: null, status: "draft", ...over,
});
const pieceCut: CutoutState = { artworkId: "p1", candidates, imageSize: { w: 100, h: 100 }, selectedIds: ["c1"], cleanedUrl: "/piece.png", altText: "A fern", box: [1, 2, 30, 40], points: [] };
const piece: Draft = {
  product: "sticker", method: "photo", photoArtworkId: "p1", candidates, imageSize: { w: 100, h: 100 }, area: { artworkId: "p1", candidateId: "c1" },
  pieceArtworkId: "p1", pieceCandidateId: "c1", pieceUrl: "/piece.png", pieceAlt: "A fern", pieceBox: [1, 2, 30, 40], cutoutArtworkId: "p1", cutouts: { p1: pieceCut },
};
const change = (id: string, parentId: string): ChangeStep => ({ artworkId: id, parentId, instruction: `do ${id}`, previewUrl: `/${id}.png`, alt: `alt ${id}`, spoken: null, differences: "" });
const changeAnswer = { artwork: { ...artwork({ id: "k2", parentArtworkId: "k1" }), previewUrl: "/k2.png" }, description: { alt: "A fern, bigger", spoken: "A big fern.", differences: "" } };

describe("Photo routing (T113)", () => {
  it("one piece the server already cut → Adjust the area on that piece (R2, always); earlier changes are dropped", () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1" });
    afterPhoto(h.deps, { artwork: artwork({ id: "p9", cleanedUrl: "/p9.png" }), candidates: [candidates[0]], imageSize: { w: 50, h: 60 } });
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(h.draft).toMatchObject({ photoArtworkId: "p9", area: { artworkId: "p9", candidateId: "c1" }, imageSize: { w: 50, h: 60 } });
    expect(h.draft.area?.fromPattern).toBeUndefined();
    // the piece comes from Use this area, not from the server's cut
    expect(h.draft.pieceArtworkId).toBeUndefined();
    // never showed Choose a pattern: Back goes to the photo screen
    expect(adjustBack(h.draft)).toBe("/create/photo?mode=camera");
    expect(h.draft.changes).toBeUndefined();
    expect(h.draft.changedArtworkId).toBeUndefined();
  });

  it("several pieces (no cut yet) → Choose a pattern, no piece picked", () => {
    const h = harness(piece);
    afterPhoto(h.deps, { artwork: artwork({ id: "p9" }), candidates });
    expect(h.calls.at(-1)).toBe("push /create/pattern");
    expect(h.draft.pieceArtworkId).toBeUndefined();
    expect(h.draft.candidates).toHaveLength(2);
  });

  it("zero pieces, Draw a box → Adjust the area on that photo, no piece (the frame starts at the whole photo)", () => {
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c1" } });
    adjustWholePhoto(h.deps, "p9");
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(h.draft).toMatchObject({ photoArtworkId: "p9", candidates: [], area: { artworkId: "p9" } });
    expect(h.draft.area?.candidateId).toBeUndefined();
    expect(h.draft.pieceArtworkId).toBeUndefined();
    expect(adjustBack(h.draft)).toBe("/create/photo?mode=camera");
  });

  it("a new photo forgets the earlier area", () => {
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c1" } });
    afterPhoto(h.deps, { artwork: artwork({ id: "p9" }), candidates });
    expect(h.draft.area).toBeUndefined();
  });
});

describe("Choose a pattern → Adjust the area (R2)", () => {
  it("Use this opens Adjust the area on the picked piece, with no call", () => {
    const h = harness({ ...piece, pieceArtworkId: undefined, pieceUrl: undefined });
    pickPiece(h.deps, "p1", "c2");
    expect(h.api).not.toHaveBeenCalled();
    expect(h.draft.area).toEqual({ artworkId: "p1", candidateId: "c2", fromPattern: true });
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(adjustBack(h.draft)).toBe("/create/pattern");
  });

  it("Use this area → Making your cutout runs POST cleanup {candidateIds:[piece], box, clipToBox}; then Your cutout (T130)", async () => {
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c2" }, changes: [change("k1", "p1")], changedArtworkId: "k1" },
      { "/cleanup": { ...artwork({ cleanedUrl: "/c2-cut.png", altText: "A flower" }), details: { failedProductIds: [], unpublishedProductIds: [] } } });
    cutArea(h.deps, [8, 9, 22, 21]);
    // no call on Adjust the area: on to /create/cutout, which shows Making your cutout for this frame
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(cutoutVisit(h.draft)).toBe("area");
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(h.draft.pieceArtworkId).toBeUndefined();
    await runAreaCut(h.deps, h.draft.pendingArea!);
    expect(h.calls.find((c) => c.startsWith("api"))).toBe('api artworks/p1/cleanup {"candidateIds":["c2"],"box":[8,9,22,21],"clipToBox":true}');
    expect(h.draft).toMatchObject({ pieceArtworkId: "p1", pieceCandidateId: "c2", pieceBox: [8, 9, 22, 21], pieceUrl: "/c2-cut.png", pieceAlt: "A flower", cutoutArtworkId: "p1" });
    expect(cutoutOf(h.draft, "p1")).toMatchObject({ selectedIds: ["c2"], cleanedUrl: "/c2-cut.png", box: [8, 9, 22, 21], points: [] });
    expect(h.draft.pendingArea).toBeUndefined();
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(h.draft.cutoutNotice).toBeUndefined();
    // Back targets: Your cutout → Adjust the area (first pass); Change it → Your cutout
    expect(yourCutoutBack(h.draft, "p1")).toBe("/create/adjust");
    expect(changeItBack(h.draft)).toBe("/create/cutout");
    expect(makingCutoutBack("area")).toBe("/create/adjust");
    // Use this on Your cutout → Change it, on the piece
    takeCutout(h.deps, "p1");
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(currentArtworkId(h.draft)).toBe("p1");
  });

  it("a result for a frame that was replaced meanwhile (Back, a new frame) is dropped", async () => {
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c2" } }, { "/cleanup": artwork({ cleanedUrl: "/old.png" }) });
    cutArea(h.deps, [8, 9, 22, 21]);
    const first = h.draft.pendingArea!;
    cutArea(h.deps, [5, 5, 25, 25]);
    expect(h.draft.pendingArea?.nonce).not.toBe(first.nonce);
    await runAreaCut(h.deps, first);
    expect(h.draft.pieceUrl).toBeUndefined();
    expect(h.draft.pendingArea?.box).toEqual([5, 5, 25, 25]);
  });

  it("no drawing found: only the box is sent", async () => {
    expect(areaRequest({}, [0, 0, 100, 80])).toEqual({ box: [0, 0, 100, 80], clipToBox: true });
    const h = harness({ ...piece, candidates: [], pieceArtworkId: undefined, cutouts: undefined, area: { artworkId: "p9" } }, { "/cleanup": artwork({ id: "p9", cleanedUrl: "/p9.png" }) });
    cutArea(h.deps, [0, 0, 100, 80]);
    await runAreaCut(h.deps, h.draft.pendingArea!);
    expect(h.calls.find((c) => c.startsWith("api"))).toBe('api artworks/p9/cleanup {"box":[0,0,100,80],"clipToBox":true}');
    expect(h.draft).toMatchObject({ pieceArtworkId: "p9", pieceUrl: "/p9.png", cutoutArtworkId: "p9" });
    expect(h.draft.pieceCandidateId).toBeUndefined();
  });

  it("the same piece and frame again → no call, and Your cutout opens on the piece, not on an earlier change (review M5)", () => {
    const h = harness({ ...piece, pieceBox: [1, 2, 3, 4], changes: [change("k1", "p1")], changedArtworkId: "k1", cutoutArtworkId: "k1" });
    cutArea(h.deps, [1, 2, 3, 4]);
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(h.draft.cutoutArtworkId).toBe("p1");
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(currentArtworkId(h.draft)).toBe("p1");
    // a moved frame cuts again
    cutArea(h.deps, [1, 2, 3, 5]);
    expect(cutoutVisit(h.draft)).toBe("area");
  });

  it("a frame with no drawing in it (or one that clips everything away, T126 422): the advice to move or grow the frame (not Retake)", () => {
    expect(areaError(new ApiError(422, "no_drawing_found", "Nothing found"))).toEqual({ message: m.create.adjust.notFound, action: "none" });
    expect(areaError(new ApiError(504, "deadline_exceeded", "late")).action).toBe("retry");
  });
});

describe("Adjust the area geometry (R2)", () => {
  const img = { w: 1000, h: 800 };
  it("starts on the bbox grown by 8 % (centred, clamped), or on the whole photo", () => {
    expect(initialFrame([100, 100, 600, 500], img)).toEqual([80, 84, 620, 516]);
    expect(initialFrame([0, 0, 1000, 800], img)).toEqual([0, 0, 1000, 800]);
    expect(initialFrame(null, img)).toEqual([0, 0, 1000, 800]);
    expect(initialFrame([5, 5, 5, 9], img)).toEqual([0, 0, 1000, 800]);
  });

  it("corners move two sides, edges one, the inside moves the frame; never off the photo or inside out", () => {
    const b: [number, number, number, number] = [100, 100, 500, 400];
    expect(dragFrame(b, "se", 50, 20, img)).toEqual([100, 100, 550, 420]);
    expect(dragFrame(b, "nw", -200, -200, img)).toEqual([0, 0, 500, 400]);
    expect(dragFrame(b, "e", 10, 99, img)).toEqual([100, 100, 510, 400]);
    expect(dragFrame(b, "n", 0, 900, img)).toEqual([100, 200, 500, 400]); // minimum 25 % of 800 = 200 (review M2)
    expect(dragFrame(b, "move", 900, 900, img)).toEqual([600, 500, 1000, 800]);
    expect(moveFrame(b, -500, 0, img)).toEqual([0, 100, 400, 400]);
  });

  it("keyboard: arrows move by 5 %, Shift + arrows resize around the centre; other keys are left alone", () => {
    const b: [number, number, number, number] = [100, 100, 500, 400];
    expect(keyFrame(b, "ArrowRight", false, img)).toEqual([150, 100, 550, 400]);
    expect(keyFrame(b, "ArrowUp", false, img)).toEqual([100, 60, 500, 360]);
    expect(keyFrame(b, "ArrowRight", true, img)).toEqual([50, 100, 550, 400]);
    expect(keyFrame(b, "ArrowUp", true, img)).toEqual([100, 140, 500, 360]);
    expect(keyFrame(b, "Enter", false, img)).toBeNull();
    expect(resizeFrame([0, 0, 1000, 800], 100, 100, img)).toEqual([0, 0, 1000, 800]);
    // at the edge (or the smallest size) a key changes nothing: the frame announces the limit instead
    expect(keyFrame([0, 0, 400, 300], "ArrowLeft", false, img)).toEqual([0, 0, 400, 300]);
    expect(keyFrame([0, 0, 200, 200], "ArrowLeft", true, img)).toEqual([0, 0, 200, 200]);
    // a smaller start is lifted to the minimum, so the inside stays large enough to drag
    expect(initialFrame([10, 10, 20, 20], img)).toEqual([10, 10, 210, 210]);
  });

  it("the size is said in whole percentages of the photo", () => {
    expect(frameSize([100, 80, 600, 480], img)).toEqual({ width: 50, height: 50, left: 10, top: 10 });
  });
});

describe("Change it (T113)", () => {
  it("Make the change: the trimmed request goes to Changing; the transcript only when the spoken text was not retyped", () => {
    const h = harness(piece);
    expect(submitChange(h.deps, "  Make the book red ", "Make the book red")).toBe(true);
    expect(h.draft).toMatchObject({ changeInstruction: "Make the book red", changeTranscript: "Make the book red" });
    expect(h.calls.at(-1)).toBe("push /create/changing");
    submitChange(h.deps, "Make it blue", "Make the book red");
    expect(h.draft.changeTranscript).toBeUndefined();
    expect(submitChange(h.deps, "   ", null)).toBe(false);
  });

  it("Looks good as is on the piece → Making your sticker (the cut was reviewed on Your cutout; no call, T130)", () => {
    const h = harness(piece);
    skipChange(h.deps);
    expect(h.api).not.toHaveBeenCalled();
    expect(h.draft.artworkId).toBe("p1");
    expect(h.calls.at(-1)).toBe("push /create/making");
  });

  it("Looks good as is on a change that was cut already → Making; on one never cut (Back to my original onto it) → its cutout first", () => {
    const k1Cut: CutoutState = { ...pieceCut, artworkId: "k1", cleanedUrl: "/k1-cut.png" };
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: k1Cut } });
    skipChange(h.deps);
    expect(h.draft.artworkId).toBe("k1");
    expect(h.calls.at(-1)).toBe("push /create/making");
    const g = harness({ ...piece, ...addChange(piece, change("k1", "p1")) });
    skipChange(g.deps);
    expect(g.draft.cutoutArtworkId).toBe("k1");
    expect(g.calls.at(-1)).toBe("push /create/cutout");
    expect(cutoutVisit(g.draft)).toBe("change");
  });
});

describe("After a change (T130): Before and after → Making your cutout → Your cutout → Making", () => {
  const cutoutAnswer = { artwork: artwork({ id: "k1", cleanedUrl: "/k1-cut.png", altText: "A blue fern" }), candidates: [{ ...candidates[0], id: "k1c" }], imageSize: { w: 200, h: 150 } };

  it("Use this: `cutout` on the change result once per artwork, the box for marks is the whole picture; Back → Before and after", async () => {
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")) }, { "/cutout": cutoutAnswer });
    takeChange(h.deps, "k1");
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(cutoutVisit(h.draft)).toBe("change");
    await runChangeCut(h.deps, "k1");
    expect(h.calls.find((c) => c.startsWith("api"))).toBe("api artworks/k1/cutout {}");
    expect(cutoutOf(h.draft, "k1")).toMatchObject({ selectedIds: ["k1c"], cleanedUrl: "/k1-cut.png", box: [0, 0, 200, 150], points: [] });
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(yourCutoutBack(h.draft, "k1")).toBe("/create/compare");
    expect(makingCutoutBack("change")).toBe("/create/compare");
    // the piece's cut is kept too; a second Use this on k1 is cached (no second cutout)
    expect(cutoutOf(h.draft, "p1")?.cleanedUrl).toBe("/piece.png");
    takeChange(h.deps, "k1");
    expect(cutoutVisit(h.draft)).toBe("cut");
    // Use this on Your cutout → Making your sticker for the change result
    takeCutout(h.deps, "k1");
    expect(h.calls.at(-1)).toBe("push /create/making");
    expect(h.draft.artworkId).toBe("k1");
  });

  it("Apply cutout on the change result: cleanup {candidateIds:[candidates[0]], box: whole picture, points, clipToBox}", async () => {
    const k1Cut: CutoutState = { artworkId: "k1", candidates: [{ ...candidates[0], id: "k1c" }], imageSize: { w: 200, h: 150 }, selectedIds: ["k1c"], cleanedUrl: "/k1-cut.png", altText: null, box: [0, 0, 200, 150], points: [] };
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: k1Cut } }, { "/cleanup": artwork({ id: "k1", cleanedUrl: "/k1-cut-2.png" }) });
    const points = [{ x: 10, y: 20, label: "positive" as const }, { x: 50, y: 60, label: "negative" as const }];
    await applyMarks(h.deps, k1Cut, marksRequest(k1Cut.selectedIds, k1Cut.box!, points));
    expect(h.calls[0]).toBe('api artworks/k1/cleanup {"candidateIds":["k1c"],"box":[0,0,200,150],"points":[{"x":10,"y":20,"label":"positive"},{"x":50,"y":60,"label":"negative"}],"clipToBox":true}');
    expect(cutoutOf(h.draft, "k1")).toMatchObject({ cleanedUrl: "/k1-cut-2.png", points });
    // the piece is untouched
    expect(h.draft.pieceUrl).toBe("/piece.png");
  });
});

describe("Your cutout marks (T130)", () => {
  it("Apply cutout on the piece: cleanup {candidateIds:[piece], box: the frame, points, clipToBox}; the piece's picture follows", async () => {
    const h = harness(piece, { "/cleanup": { ...artwork({ cleanedUrl: "/piece-2.png", altText: "A fern, fuller" }), details: { failedProductIds: ["pr1"], unpublishedProductIds: [] } } });
    const out = await applyMarks(h.deps, pieceCut, marksRequest(["c1"], [1, 2, 30, 40], [{ x: 5, y: 6, label: "positive" }]));
    expect(h.calls[0]).toBe('api artworks/p1/cleanup {"candidateIds":["c1"],"box":[1,2,30,40],"points":[{"x":5,"y":6,"label":"positive"}],"clipToBox":true}');
    expect(h.draft).toMatchObject({ pieceUrl: "/piece-2.png", pieceAlt: "A fern, fuller", cutoutNotice: m.create.select.failedProducts });
    expect(out.notice).toBe(m.create.select.failedProducts);
    expect(cutoutOf(h.draft, "p1")?.points).toEqual([{ x: 5, y: 6, label: "positive" }]);
  });

  it("the body: no piece → no candidateIds; at most 10 marks; no marks → no points key", () => {
    expect(marksRequest([], [0, 0, 9, 9], [])).toEqual({ box: [0, 0, 9, 9], clipToBox: true });
    const many = Array.from({ length: 12 }, (_, i) => ({ x: i, y: i, label: "positive" as const }));
    expect(marksRequest(["c1"], [0, 0, 9, 9], many).points).toHaveLength(10);
  });

  it("consistency item 6: Use this again after browser back reuses the draft product (no second POST products)", () => {
    const product = { id: "pr1", artworkId: "k1", creatorId: "me", type: "sticker" as const, mockupUrl: null, printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: null };
    const k1Cut: CutoutState = { ...pieceCut, artworkId: "k1", cleanedUrl: "/k1-cut.png" };
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: k1Cut }, cutoutArtworkId: "k1" });
    takeCutout(h.deps, "k1");
    expect(productToMake(h.draft)).toBe("make");
    // Making your sticker made it; then browser back to Your cutout and Use this again
    h.deps.update({ productRecord: product, productCut: "/k1-cut.png" });
    takeCutout(h.deps, "k1");
    expect(h.draft.productRecord).toEqual(product);
    expect(productToMake(h.draft)).toBe("reuse");
    expect(h.api).not.toHaveBeenCalled();
  });
});

describe("Changing your art (T113)", () => {
  it("decides once on arrival: a waiting request runs, a finished one goes to compare, nothing → start over", () => {
    expect(changingEntry({ ...piece, changeInstruction: "x" })).toBe("run");
    // "Change it again": a change is on screen AND a new request waits → run, not compare
    expect(changingEntry({ ...piece, changedArtworkId: "k1", changeInstruction: "x" })).toBe("run");
    expect(changingEntry({ ...piece, changedArtworkId: "k1" })).toBe("compare");
    expect(changingEntry(piece)).toBe("missing");
    expect(changeRequest({ ...piece, ...addChange(piece, change("k1", "p1")), changeInstruction: "Make it bigger" })).toEqual({ base: "k1", instruction: "Make it bigger", transcript: undefined });
  });

  it("Change it again: POST change on the child; the new child goes on screen; Back to my original returns to the first change", async () => {
    const start = { ...piece, ...addChange(piece, change("k1", "p1")), changeInstruction: "Make it bigger" };
    const h = harness(start, { "/change": changeAnswer });
    const req = changeRequest(start)!;
    await runChange(h.deps, req);
    expect(h.calls[0]).toBe('api artworks/k1/change {"instruction":"Make it bigger"}');
    expect(h.calls.at(-1)).toBe("replace /create/compare");
    expect(h.draft).toMatchObject({ changedArtworkId: "k2", changeInstruction: undefined });
    expect(h.draft.changes?.map((c) => [c.artworkId, c.parentId])).toEqual([["k1", "p1"], ["k2", "k1"]]);
    expect(currentArtworkId({ ...h.draft, ...backToOriginal(h.draft) })).toBe("k1");
  });

  it("Back to my art after a failed Change it again lands on Change it, and arrival is not re-decided (review I1)", async () => {
    const start = { ...piece, ...addChange(piece, change("k1", "p1")), changeInstruction: "Make it bigger" };
    const h = harness(start, { "/change": Object.assign(new Error("model"), { status: 502 }) });
    const entry = changingEntry(h.draft);
    await expect(runChange(h.deps, changeRequest(h.draft)!)).rejects.toThrow("model");
    leaveChanging(h.deps);
    // navigation first, then the request is dropped, and nothing sends the creator to compare
    expect(h.calls.slice(-2)).toEqual(["replace /create/change", "update changeInstruction,changeTranscript"]);
    expect(h.calls).not.toContain("replace /create/compare");
    // the screen keeps the decision it made on arrival ("run"); re-deciding now would say "compare"
    expect(entry).toBe("run");
    expect(changingEntry(h.draft)).toBe("compare");
    expect(h.draft.changedArtworkId).toBe("k1");
  });

  it("Back to my art after a failed first change: Change it on the piece, no start-over", async () => {
    const h = harness({ ...piece, changeInstruction: "Make the book red" }, { "/change": new Error("model") });
    await expect(runChange(h.deps, changeRequest(h.draft)!)).rejects.toThrow();
    leaveChanging(h.deps);
    expect(h.calls.at(-2)).toBe("replace /create/change");
    expect(currentArtworkId(h.draft)).toBe("p1");
  });
});

describe("T117: kept-mounted routes (cacheComponents) never re-send or come back locked", () => {
  it("a second Make the change gets a new nonce and sends the new instruction once, on the child", async () => {
    const answers: Record<string, unknown> = { "/change": { artwork: { ...artwork({ id: "k1", parentArtworkId: "p1" }), previewUrl: "/k1.png" }, description: { alt: "blue", spoken: "", differences: "" } } };
    const h = harness({ ...piece }, answers);
    submitChange(h.deps, "make it blue", null);
    const first = h.draft.changeNonce;
    await once(`change:${first}:0`, () => runChange(h.deps, changeRequest(h.draft)!));
    // Before and after → Change it again → a new request
    answers["/change"] = changeAnswer;
    submitChange(h.deps, "make the stem red", null);
    const second = h.draft.changeNonce;
    expect(second).not.toBe(first);
    expect(changingVisit(h.draft, second)).toBe("send");
    // the screen opened with the first nonce (kept mounted) must not send anything
    expect(changingVisit(h.draft, first)).toBe("compare");
    const sent = () => h.calls.filter((c) => c.startsWith("api") && c.includes("/change"));
    await once(`change:${second}:0`, () => runChange(h.deps, changeRequest(h.draft)!));
    expect(sent()).toEqual([
      'api artworks/p1/change {"instruction":"make it blue"}',
      'api artworks/k1/change {"instruction":"make the stem red"}',
    ]);
  });

  it("a revisit after the request finished goes to compare and does not post again", async () => {
    const h = harness({ ...piece }, { "/change": changeAnswer });
    submitChange(h.deps, "make it bigger", null);
    const nonce = h.draft.changeNonce;
    expect(changingVisit(h.draft, nonce)).toBe("send");
    await runChange(h.deps, changeRequest(h.draft)!);
    expect(changingVisit(h.draft, nonce)).toBe("compare");
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it("Back to my art keeps the nonce (no remount, I1) and a revisit of the dropped request goes to Change it", () => {
    const h = harness({ ...piece });
    submitChange(h.deps, "make it blue", null);
    const nonce = h.draft.changeNonce;
    leaveChanging(h.deps);
    expect(h.draft.changeNonce).toBe(nonce);
    expect(h.calls.at(-2)).toBe("replace /create/change");
    expect(changingVisit(h.draft, nonce)).toBe("change");
  });

  it("busy flags (Adjust the area busy, Photo phase) are clear after a navigation and after a failure", async () => {
    const seen: (string | boolean | null)[] = [];
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c2" } }, { "/cleanup": artwork({ cleanedUrl: "/c2.png" }) });
    let busy = false;
    cutArea(h.deps, [1, 1, 9, 9]);
    await busyWhile((v: boolean) => { busy = v; seen.push(v); }, true, false, () => runAreaCut(h.deps, h.draft.pendingArea!));
    expect(h.calls.at(-1)).toBe("update pendingArea,pieceArtworkId,pieceCandidateId,pieceBox,pieceUrl,pieceAlt,pieceSpoken,cutouts,cutoutArtworkId,cutoutNotice");
    expect(busy).toBe(false);
    let work: string | null = null;
    await busyWhile<string | null>((v) => { work = v; seen.push(v); }, "use", null, async () => { throw new Error("cut failed"); }).catch(() => {});
    expect(work).toBeNull();
    expect(seen).toEqual([true, false, "use", null]);
  });
});

describe("T118 / T130: Back from Change it", () => {
  it("goes to Your cutout even with a change on screen, and leaves the change chain intact", () => {
    const d: Draft = { ...piece, area: { artworkId: "p1", candidateId: "c1" }, ...addChange(piece, change("k1", "p1")) };
    d.changes = [...(d.changes ?? []), change("k2", "k1")];
    d.changedArtworkId = "k2";
    const before = JSON.stringify(d);
    expect(changeItBack(d)).toBe("/create/cutout");
    expect(JSON.stringify(d)).toBe(before);
    expect(currentArtworkId(d)).toBe("k2");
    // a draft without a cut (an old session) goes back to Adjust the area, or the photo screen
    const old = { ...piece, cutouts: undefined, cutoutArtworkId: undefined };
    expect(changeItBack(old)).toBe("/create/adjust");
    expect(changeItBack({ ...old, area: undefined, method: "upload" })).toBe("/create/photo?mode=upload");
    expect(changeItBack({ ...old, area: undefined })).toBe("/create/photo?mode=camera");
  });
});

describe("T133: review minors", () => {
  it("Change it's Back opens the cut of the art on screen: after Back to my original from a cut change, the piece's cut", async () => {
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")) }, { "/cutout": { artwork: artwork({ id: "k1", cleanedUrl: "/k1-cut.png" }), candidates: [{ ...candidates[0], id: "k1c" }], imageSize: { w: 200, h: 150 } } });
    // piece → change k1 → Use this → Your cutout on k1
    takeChange(h.deps, "k1");
    await runChangeCut(h.deps, "k1");
    expect(h.draft.cutoutArtworkId).toBe("k1");
    // Back to Before and after → Back to my original → Change it shows the piece
    h.deps.update(backToOriginal(h.draft));
    expect(currentArtworkId(h.draft)).toBe("p1");
    expect(changeItCut(h.draft)).toBe("p1");
    expect(changeItBack(h.draft)).toBe("/create/cutout");
    // Change it keeps cutoutArtworkId on that cut, so Back opens the piece's cut (whose Back is Adjust the area)
    h.deps.update({ cutoutArtworkId: changeItCut(h.draft)! });
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(yourCutoutBack(h.draft, h.draft.cutoutArtworkId!)).toBe("/create/adjust");
    // a change on screen that was cut opens its own cut; one never cut falls back to the piece's cut
    expect(changeItCut({ ...h.draft, changedArtworkId: "k1" })).toBe("k1");
    const k2 = { ...h.draft, ...addChange(h.draft, change("k2", "k1")) };
    expect(changeItCut(k2)).toBe("p1");
  });

  it("a double tap on Use this area sends one cleanup", async () => {
    const h = harness({ ...piece, area: { artworkId: "p1", candidateId: "c2" } }, { "/cleanup": artwork({ cleanedUrl: "/c2.png" }) });
    cutArea(h.deps, [8, 9, 22, 21]);
    const job = h.draft.pendingArea!;
    cutArea(h.deps, [8, 9, 22, 21]);
    expect(h.draft.pendingArea?.nonce).toBe(job.nonce);
    expect(h.calls.filter((c) => c === "push /create/cutout")).toHaveLength(2);
    // Making your cutout runs the job once per nonce (both visits share the in-flight call)
    await Promise.all([once(`area:${job.nonce}:0`, () => runAreaCut(h.deps, job)), once(`area:${h.draft.pendingArea!.nonce}:0`, () => runAreaCut(h.deps, h.draft.pendingArea!))]);
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it("marks are sent as whole pixels", () => {
    const req = marksRequest(["c1"], [0, 0, 400, 300], [{ x: 119.205, y: 118.894, label: "positive" }, { x: 279.5, y: 179.82, label: "negative" }]);
    expect(req.points).toEqual([{ x: 119, y: 119, label: "positive" }, { x: 280, y: 180, label: "negative" }]);
  });
});

describe("Story video return (R6)", () => {
  it("after the first listing → You're live; Record again (redo) → back to Choose a product", () => {
    expect(storyVideoDone(false)).toBe("/create/live");
    expect(storyVideoDone(true)).toBe("/create/product");
    expect(STORY_REDO_RETURN).toBe("/create/product");
  });
});
