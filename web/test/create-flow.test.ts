import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  STORY_REDO_RETURN, storyVideoDone, canRedoListing, canRedoCutout, redoCutout, redoListing, redoTarget, adjustBack, takeNewPhoto, afterPhoto, applyMarks, areaNotFound, busyWhile, pickRequest, showsPieces, changeItBack, changeRequest, changingEntry, changingVisit, cutArea,
  changeItCut, cutoutVisit, leaveChanging, makingCutoutBack, runAreaCut, runChange, runChangeCut, skipChange, submitChange, takeChange, takeCutout, yourCutoutBack, type FlowDeps,
  areaFrame, cutoutNewPhoto, hasLocalPhoto, largestFirst, photoGone, PhotoGoneError, sameNotFound,
  changeItProduct, fixCutout, productPicture, runProduct, discardNotFoundRow, dropRow, hasPublishedProduct,
} from "@/components/create/flow";
import { stageLine } from "@/components/create/screens/Changing";
import { CropError } from "@/components/create/crop";
import { putPhoto } from "@/components/create/localPhoto";
import { marksRequest, type Box } from "@/components/create/cutout";
import { dragFrame, initialFrame, keyFrame, moveFrame, resizeFrame, frameSize } from "@/components/create/area";
import { ApiError } from "@/components/create/api";
import { areaError, isNotFound } from "@/components/create/screens/AdjustArea";
import { m } from "@/components/messages";
import { addChange, backToOriginal, currentArtworkId, cutoutOf, once, productPlan, type ChangeStep, type CutoutState, type Draft } from "@/components/create/store";

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
/** The photo on the device (round 4): a key in the in-memory map, its size, and the last frame. */
const PHOTO = "ph1";
const photoFile = new Blob(["photo"], { type: "image/jpeg" });
putPhoto(PHOTO, photoFile);
const area = { photoKey: PHOTO, size: { w: 400, h: 300 } };
const pieceCut: CutoutState = { artworkId: "p1", candidates, imageSize: { w: 100, h: 100 }, selectedIds: ["c1"], cleanedUrl: "/piece.png", altText: "A fern", box: [0, 0, 100, 100], points: [] };
const piece: Draft = {
  product: "sticker", method: "photo", area: { ...area, frame: [1, 2, 30, 40] },
  pieceArtworkId: "p1", pieceUrl: "/piece.png", pieceAlt: "A fern", piecePhotoKey: PHOTO, pieceBox: [1, 2, 30, 40], cutoutArtworkId: "p1", cutouts: { p1: pieceCut },
};
const change = (id: string, parentId: string): ChangeStep => ({ artworkId: id, parentId, instruction: `do ${id}`, previewUrl: `/${id}.png`, alt: `alt ${id}`, spoken: null, differences: "" });
const changeAnswer = { artwork: { ...artwork({ id: "k2", parentArtworkId: "k1" }), previewUrl: "/k2.png" }, description: { alt: "A fern, bigger", spoken: "A big fern.", differences: "" } };
/** The cutout and product answers that finish a change on Changing (round 4: change → cutout → products). */
const chainRest = (id: string) => ({
  "/cutout": { artwork: artwork({ id, cleanedUrl: `/${id}-cut.png` }), candidates: [], imageSize: { w: 10, h: 10 } },
  products: { id: `pr-${id}`, artworkId: id, creatorId: "me", type: "sticker", mockupUrl: `/${id}-photo.png`, printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: null },
});

/** `POST /artworks {framed: true}` on the crop (T143): candidates largest first, `candidates[0]` cut, `imageSize` = the stored crop. */
const createAnswer = (over: Record<string, unknown> = {}) => ({
  artwork: artwork({ id: "p2", cleanedUrl: "/p2-cut.png", altText: "A flower", status: "ready" }), candidates: [candidates[0]],
  imageSize: { w: 140, h: 120 }, ...over,
});
/** A crop upload that records what it was asked to crop. */
function uploader(url = "https://blob/crop.jpg") {
  const seen: { file: Blob; box: number[] }[] = [];
  const upload = vi.fn(async (file: Blob, box: number[]) => { seen.push({ file, box: [...box] }); return url; });
  return { upload, seen };
}

describe("Photo routing (round 4 ruling 1: the photo stays on the device)", () => {
  it("a picked photo goes straight to Adjust the area with no call; the frame starts at the whole photo; earlier pieces and changes are dropped", () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1", areaNotFound: { photoKey: PHOTO, box: [0, 0, 1, 1] }, photoLost: true });
    afterPhoto(h.deps, { key: PHOTO, size: { w: 50, h: 60 } });
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(h.draft.area).toEqual({ photoKey: PHOTO, size: { w: 50, h: 60 } });
    expect(areaFrame(h.draft)).toEqual([0, 0, 50, 60]);
    expect(h.draft.pieceArtworkId).toBeUndefined();
    expect(h.draft.cutouts).toBeUndefined();
    expect(h.draft.areaNotFound).toBeUndefined();
    expect(h.draft.photoLost).toBeUndefined();
    expect(h.draft.changes).toBeUndefined();
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(adjustBack(h.draft)).toBe("/create/photo?mode=camera");
    expect(adjustBack({ ...h.draft, method: "upload" })).toBe("/create/photo?mode=upload");
    expect(takeNewPhoto(h.draft)).toBe("/create/photo?mode=camera");
    expect(takeNewPhoto({ ...h.draft, method: "upload" })).toBe("/create/photo?mode=upload");
  });

  it("the frame starts at the whole photo; Back to Adjust the area shows the last frame", () => {
    expect(initialFrame(undefined, { w: 400, h: 300 })).toEqual([0, 0, 400, 300]);
    expect(areaFrame({ area })).toEqual([0, 0, 400, 300]);
    expect(areaFrame(piece)).toEqual([1, 2, 30, 40]);
    expect(areaFrame({})).toBeNull();
  });

  it("a reload loses the local photo: Adjust the area sends the creator to the photo step with the notice", () => {
    const h = harness({ ...piece, area: { photoKey: "gone", size: { w: 10, h: 10 } }, pendingArea: { photoKey: "gone", box: [0, 0, 5, 5], nonce: "n" } });
    expect(hasLocalPhoto(h.draft)).toBe(false);
    expect(hasLocalPhoto(piece)).toBe(true);
    photoGone(h.deps, h.draft);
    expect(h.calls.at(-1)).toBe("replace /create/photo?mode=camera");
    expect(h.draft.photoLost).toBe(true);
    expect(h.draft.pendingArea).toBeUndefined();
  });
});

describe("Adjust the area → crop on the device → POST /artworks (round 4 ruling 1)", () => {
  it("Use this area: no call on Adjust the area; Making your cutout crops the local photo to the frame, uploads it once and sends POST /artworks {source, imageUrl, product, framed: true} (no detect)", async () => {
    const h = harness({ product: "sticker", method: "photo", area, changes: [change("k1", "p1")], changedArtworkId: "k1" }, { artworks: createAnswer() });
    const u = uploader();
    expect(cutArea(h.deps, [8, 9, 222, 121])).toBe(true);
    expect(h.api).not.toHaveBeenCalled();
    expect(u.upload).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(cutoutVisit(h.draft)).toBe("area");
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(h.draft.area?.frame).toEqual([8, 9, 222, 121]);
    await runAreaCut({ ...h.deps, upload: u.upload }, h.draft.pendingArea!);
    expect(u.seen).toEqual([{ file: photoFile, box: [8, 9, 222, 121] }]);
    expect(h.calls.filter((c) => c.startsWith("api"))).toEqual(['api artworks {"source":"photo","imageUrl":"https://blob/crop.jpg","product":"sticker","framed":true}']);
    expect(h.calls.some((c) => c.includes("/detect"))).toBe(false);
    expect(h.draft).toMatchObject({ pieceArtworkId: "p2", piecePhotoKey: PHOTO, pieceBox: [8, 9, 222, 121], pieceUrl: "/p2-cut.png", pieceAlt: "A flower", cutoutArtworkId: "p2" });
    // Your cutout works on the crop: its size, the whole picture as the box, no frame
    expect(cutoutOf(h.draft, "p2")).toMatchObject({ selectedIds: ["c1"], cleanedUrl: "/p2-cut.png", box: [0, 0, 140, 120], points: [], imageSize: { w: 140, h: 120 } });
    expect(h.draft.pendingArea).toBeUndefined();
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(h.draft.cutoutNotice).toBeUndefined();
    // Back targets: Your cutout → Adjust the area (the local photo, the last frame); Change it → Your cutout
    expect(yourCutoutBack(h.draft, "p2")).toBe("/create/adjust");
    expect(cutoutNewPhoto(h.draft, "p2")).toBeNull();
    expect(changeItBack(h.draft)).toBe("/create/cutout");
    expect(makingCutoutBack()).toBe("/create/adjust");
  });

  it("several pieces and no cut from the server: the largest is cut with cleanup {candidateIds:[largest], box: the whole crop, clipToBox}", async () => {
    const big = { id: "big", bbox: [0, 0, 100, 90] as [number, number, number, number], score: 0.7, thumbUrl: "/big.png" };
    const h = harness({ product: "tote", method: "upload", area }, {
      artworks: createAnswer({ artwork: artwork({ id: "p3" }), candidates: [candidates[0], big] }),
      "/cleanup": { ...artwork({ id: "p3", cleanedUrl: "/big-cut.png", altText: "A big fern" }), details: { failedProductIds: [], unpublishedProductIds: [] } },
    });
    cutArea(h.deps, [0, 0, 400, 300]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    expect(h.calls.filter((c) => c.startsWith("api"))).toEqual([
      'api artworks {"source":"photo","imageUrl":"https://blob/crop.jpg","product":"tote","framed":true}',
      'api artworks/p3/cleanup {"candidateIds":["big"],"box":[0,0,140,120],"clipToBox":true}',
    ]);
    expect(cutoutOf(h.draft, "p3")).toMatchObject({ selectedIds: ["big"], cleanedUrl: "/big-cut.png", box: [0, 0, 140, 120] });
    expect(cutoutOf(h.draft, "p3")?.candidates.map((c) => c.id)).toEqual(["big", "c1"]);
    expect(largestFirst([candidates[0], big]).map((c) => c.id)).toEqual(["big", "c1"]);
  });

  it("T143 framed: the server's order (largest first) and its cut of candidates[0] are kept; no second call", async () => {
    const h = harness({ product: "sticker", area }, { artworks: createAnswer({ candidates: [candidates[0], candidates[1]] }) });
    cutArea(h.deps, [0, 0, 400, 300]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(cutoutOf(h.draft, "p2")).toMatchObject({ selectedIds: ["c1"], cleanedUrl: "/p2-cut.png" });
    expect(cutoutOf(h.draft, "p2")?.candidates.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("a result for a frame that was replaced meanwhile (Back, a new frame) is dropped", async () => {
    const h = harness({ product: "sticker", area }, { artworks: createAnswer() });
    cutArea(h.deps, [8, 9, 222, 121]);
    const first = h.draft.pendingArea!;
    cutArea(h.deps, [5, 5, 250, 250]);
    expect(h.draft.pendingArea?.nonce).not.toBe(first.nonce);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, first);
    expect(h.draft.pieceUrl).toBeUndefined();
    expect(h.draft.pendingArea?.box).toEqual([5, 5, 250, 250]);
  });

  it("nothing found in the crop (422 no_drawing_found): back to Adjust the area with the move-or-grow advice; the same frame sends nothing again; a new frame clears it", () => {
    const h = harness({ product: "sticker", area });
    cutArea(h.deps, [0, 0, 100, 100]);
    const job = h.draft.pendingArea!;
    areaNotFound(h.deps, job);
    expect(h.calls.at(-1)).toBe("replace /create/adjust");
    expect(h.draft.areaNotFound).toEqual({ photoKey: PHOTO, box: [0, 0, 100, 100] });
    expect(h.draft.pendingArea).toBeUndefined();
    expect(areaFrame(h.draft)).toEqual([0, 0, 100, 100]);
    // the same frame: nothing is started (the advice stays on screen)
    const before = h.calls.length;
    expect(cutArea(h.deps, [0, 0, 100, 100])).toBe(false);
    expect(h.calls).toHaveLength(before);
    expect(sameNotFound(h.draft, [0, 0, 100, 100])).toBe(true);
    // a stale job does nothing; a moved frame cuts again
    expect(cutArea(h.deps, [0, 0, 150, 150])).toBe(true);
    expect(h.draft.areaNotFound).toBeUndefined();
    areaNotFound(h.deps, job);
    expect(h.draft.pendingArea).toBeDefined();
    expect(isNotFound(new ApiError(422, "no_drawing_found", "Nothing"))).toBe(true);
    expect(isNotFound(new ApiError(504, "deadline_exceeded", "late"))).toBe(false);
  });

  it("the same photo and frame again → no upload and no call; Your cutout opens on the piece, not on an earlier change (review M5)", () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1", cutoutArtworkId: "k1" });
    cutArea(h.deps, [1, 2, 30, 40]);
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(h.draft.cutoutArtworkId).toBe("p1");
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(currentArtworkId(h.draft)).toBe("p1");
    // a moved frame crops again; so does the same frame on a new photo
    cutArea(h.deps, [1, 2, 30, 41]);
    expect(cutoutVisit(h.draft)).toBe("area");
    const g = harness({ ...piece, area: { ...area, photoKey: "other" } });
    cutArea(g.deps, [1, 2, 30, 40]);
    expect(cutoutVisit(g.draft)).toBe("area");
  });

  it("the local photo is gone when the crop should run: PhotoGoneError, nothing uploaded", async () => {
    const h = harness({ product: "sticker", area: { photoKey: "gone", size: { w: 10, h: 10 } } });
    cutArea(h.deps, [0, 0, 10, 10]);
    const u = uploader();
    await expect(runAreaCut({ ...h.deps, upload: u.upload }, h.draft.pendingArea!)).rejects.toBeInstanceOf(PhotoGoneError);
    expect(u.upload).not.toHaveBeenCalled();
    expect(h.api).not.toHaveBeenCalled();
  });

  it("a frame with no drawing in it: the advice to move or grow the frame (not Retake); a picture the browser cannot open asks for another", () => {
    expect(areaError(new ApiError(422, "no_drawing_found", "Nothing found"))).toEqual({ message: m.create.adjust.notFound, action: "none" });
    expect(areaError(new ApiError(504, "deadline_exceeded", "late")).action).toBe("retry");
    expect(areaError(new CropError())).toEqual({ message: m.create.photo.cannotOpen, action: "none" });
  });
});

describe("Your cutout candidate strip (round 3)", () => {
  it("shows only for two pieces or more; picking another sends cleanup {candidateIds:[picked], box: the frame, clipToBox} with no marks", async () => {
    expect(showsPieces({ candidates })).toBe(true);
    expect(showsPieces({ candidates: [candidates[0]] })).toBe(false);
    expect(showsPieces({ candidates: [] })).toBe(false);
    const h = harness({ ...piece }, { "/cleanup": { ...artwork({ cleanedUrl: "/c2.png" }), details: { failedProductIds: [], unpublishedProductIds: [] } } });
    const out = await applyMarks(h.deps, { ...pieceCut, points: [{ x: 1, y: 1, label: "positive" }], selectedIds: ["c2"] }, pickRequest("c2", pieceCut.box!));
    expect(h.calls.find((c) => c.startsWith("api"))).toBe('api artworks/p1/cleanup {"candidateIds":["c2"],"box":[0,0,100,100],"clipToBox":true}');
    expect(out.cut).toMatchObject({ selectedIds: ["c2"], cleanedUrl: "/c2.png", points: [] });
    expect(h.draft.pieceUrl).toBe("/c2.png");
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

});

const prod = (id: string, artworkId: string, over: Record<string, unknown> = {}) => ({
  id, artworkId, creatorId: "me", type: "sticker" as const, mockupUrl: `/${id}-photo.png`, printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: `/${id}-pv.png`, ...over,
});
const listItem = (id: string, over: Record<string, unknown> = {}) => ({ id, type: "sticker" as const, status: "draft", priceCents: 500, title: null, description: null, mockupUrl: `/${id}-photo.png`, previewUrl: `/${id}-pv.png`, ...over });

describe("Round 4 ruling 2: the product is made before Change it", () => {
  it("Your cutout Use this → Change it at once, in the making state: one POST /products {artworkId, type, clientRequestId}, then the product photo", async () => {
    const h = harness({ ...piece }, { products: prod("pr1", "p1") });
    takeCutout(h.deps, "p1");
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(h.calls).not.toContain("push /create/making");
    expect(changeItProduct(h.draft)).toMatchObject({ artworkId: "p1", plan: "make", product: null });
    const id = h.draft.productJob?.requestId;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // Change it's effect: shared by key, so a remount joins the call in flight (no double POST)
    const run = () => runProduct(h.deps, "p1");
    await Promise.all([once("product:p1:make:/piece.png:0", run), once("product:p1:make:/piece.png:0", run)]);
    expect(h.calls.filter((c) => c.startsWith("api"))).toEqual([`api products {"artworkId":"p1","type":"sticker","clientRequestId":"${id}"}`]);
    expect(changeItProduct(h.draft).plan).toBe("ready");
    expect(productPicture(h.draft, "p1")).toEqual({ src: "/pr1-photo.png", kind: "photo" });
    // nothing more to do once it is made
    await runProduct(h.deps, "p1");
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it("reuse: Back to Your cutout and Use this again → Change it shows the product at once; no second POST", () => {
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } });
    takeCutout(h.deps, "p1");
    expect(changeItProduct(h.draft).plan).toBe("ready");
    expect(h.draft.productJob).toBeUndefined();
    expect(h.api).not.toHaveBeenCalled();
    // another type is another product
    expect(productPlan({ ...h.draft, product: "tote" }, "p1")).toBe("make");
  });

  it("a failed POST /products: Try again sends the same clientRequestId, and so does a second Use this", async () => {
    const h = harness({ ...piece }, { products: new ApiError(504, "deadline_exceeded", "late") });
    takeCutout(h.deps, "p1");
    const first = h.draft.productJob!.requestId;
    await expect(runProduct(h.deps, "p1")).rejects.toThrow();
    await expect(runProduct(h.deps, "p1")).rejects.toThrow();
    const ids = h.calls.filter((c) => c.startsWith("api products")).map((c) => JSON.parse(c.slice(c.indexOf("{"))).clientRequestId);
    expect(ids).toEqual([first, first]);
  });

  it("review m3: a second Use this while the product is still to be made keeps the clientRequestId (the server may have the row); another artwork's job is replaced", () => {
    const h = harness({ ...piece });
    takeCutout(h.deps, "p1");
    const first = h.draft.productJob!.requestId;
    takeCutout(h.deps, "p1");
    expect(h.draft.productJob!.requestId).toBe(first);
    // a job for another artwork is replaced by a new one
    h.deps.update({ productJob: { artworkId: "k9", requestId: "old" } });
    takeCutout(h.deps, "p1");
    expect(h.draft.productJob!.requestId).not.toBe("old");
    expect(h.draft.productJob!.artworkId).toBe("p1");
  });

  it("review m4: a creator who left Changing mid-run still gets the draft updates, so a retry repeats no cutout and sends the same product id", async () => {
    const answers: Record<string, unknown> = {
      "/change": { artwork: { ...artwork({ id: "k1", parentArtworkId: "p1" }), previewUrl: "/k1.png" }, description: { alt: "blue", spoken: "", differences: "" } },
      "/cutout": { artwork: artwork({ id: "k1", cleanedUrl: "/k1-cut.png" }), candidates: [], imageSize: { w: 200, h: 150 } },
      products: new ApiError(504, "deadline_exceeded", "late"),
    };
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } }, answers);
    submitChange(h.deps, "make it blue", null);
    // the screen is gone: navigation is dropped, draft updates still land (Changing.tsx passes `update` through)
    const away = { ...h.deps, router: { push: () => {}, replace: () => {} } };
    await expect(runChange(away, changeRequest(h.draft)!)).rejects.toThrow();
    expect(cutoutOf(h.draft, "k1")?.cleanedUrl).toBe("/k1-cut.png");
    const firstId = h.draft.productJob?.requestId;
    expect(h.draft.productJob?.artworkId).toBe("k1");
    answers.products = prod("pr2", "k1");
    await runChange(h.deps, changeRequest(h.draft)!);
    const api = h.calls.filter((c) => c.startsWith("api"));
    expect(api.filter((c) => c.includes("/change"))).toHaveLength(1);
    expect(api.filter((c) => c.includes("/cutout"))).toHaveLength(1);
    const ids = api.filter((c) => c.startsWith("api products")).map((c) => JSON.parse(c.slice(c.indexOf("{"))).clientRequestId);
    expect(ids).toEqual([firstId, firstId]);
    const src = readFileSync(resolve(__dirname, "../components/create/screens/Changing.tsx"), "utf8");
    expect(src).not.toMatch(/if \(here\.current\) update\(/);
  });

  it("Looks good as is → Ready on that product with no call (its listing kept for the same product); nothing while it is being made", () => {
    const making = harness({ ...piece });
    expect(skipChange(making.deps)).toBe(false);
    expect(making.calls).toEqual([]);
    const listing = { title: "Fern", description: "", tags: [], price_cents: 500, print_ok: true, notes: "" };
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } }, productRecord: prod("pr1", "p1"), listing });
    expect(skipChange(h.deps)).toBe(true);
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/ready");
    expect(h.draft).toMatchObject({ artworkId: "p1", productRecord: prod("pr1", "p1"), listing });
    expect(h.draft.productRecord).not.toHaveProperty("cut");
    // another product on screen: its own listing is drafted later
    const g = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: { ...pieceCut, artworkId: "k1", cleanedUrl: "/k1.png" } }, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" }, k1: { ...prod("pr2", "k1"), cut: "/k1.png" } }, productRecord: prod("pr1", "p1"), listing });
    skipChange(g.deps);
    expect(g.draft.productRecord?.id).toBe("pr2");
    expect(g.draft.artworkId).toBe("k1");
    expect(g.draft.listing).toBeUndefined();
  });

  it("Make the change → Changing runs change → cutout → products, in that order, then Before and after compares the two product photos", async () => {
    const answers = {
      "/change": { artwork: { ...artwork({ id: "k1", parentArtworkId: "p1" }), previewUrl: "/k1.png" }, description: { alt: "A blue fern", spoken: "A blue fern.", differences: "" } },
      "/cutout": { artwork: artwork({ id: "k1", cleanedUrl: "/k1-cut.png" }), candidates: [{ ...candidates[0], id: "k1c" }], imageSize: { w: 200, h: 150 }, products: [] },
      products: prod("pr2", "k1"),
    };
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } }, answers);
    submitChange(h.deps, "make it blue", null);
    const nonce = h.draft.changeNonce!;
    const stages: string[] = [];
    await runChange(h.deps, changeRequest(h.draft)!, (st) => stages.push(st));
    expect(stages).toEqual(["change", "cutout", "product"]);
    const api = h.calls.filter((c) => c.startsWith("api"));
    expect(api).toHaveLength(3);
    expect(api[0]).toBe(`api artworks/p1/change {"instruction":"make it blue","clientRequestId":"${nonce}"}`);
    expect(api[1]).toBe("api artworks/k1/cutout {}");
    expect(api[2]).toMatch(/^api products \{"artworkId":"k1","type":"sticker","clientRequestId":"[0-9a-f-]{36}"\}$/);
    expect(h.calls.at(-1)).toBe("replace /create/compare");
    expect(h.draft).toMatchObject({ changedArtworkId: "k1", cutoutArtworkId: "k1", changeInstruction: undefined });
    expect(cutoutOf(h.draft, "k1")).toMatchObject({ cleanedUrl: "/k1-cut.png", box: [0, 0, 200, 150] });
    // Before and after: the parent's and the child's product photos
    expect(productPicture(h.draft, "p1").src).toBe("/pr1-photo.png");
    expect(productPicture(h.draft, "k1").src).toBe("/pr2-photo.png");
    // Use this / Change it again → Change it on the child, its photo at once; Back to my original → the parent, at once
    takeChange(h.deps, "k1");
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(changeItProduct(h.draft)).toMatchObject({ artworkId: "k1", plan: "ready" });
    h.deps.update(backToOriginal(h.draft));
    expect(changeItProduct(h.draft)).toMatchObject({ artworkId: "p1", plan: "ready" });
    expect(stageLine("change", false)).toBe("Changing your art…");
    expect(stageLine("cutout", false)).toBe("Cutting it out…");
    expect(stageLine("product", false)).toBe("Making your sticker…");
    expect(stageLine("product", true)).toBe("Making your tote bag…");
  });

  it("Try again after a failed product step resumes there (no second change or cutout) with the same clientRequestId; Back to my art stays on the parent", async () => {
    const answers: Record<string, unknown> = {
      "/change": { artwork: { ...artwork({ id: "k1", parentArtworkId: "p1" }), previewUrl: "/k1.png" }, description: { alt: "blue", spoken: "", differences: "" } },
      "/cutout": { artwork: artwork({ id: "k1", cleanedUrl: "/k1-cut.png" }), candidates: [], imageSize: { w: 200, h: 150 } },
      products: new ApiError(502, "model_error", "photo failed"),
    };
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } }, answers);
    submitChange(h.deps, "make it blue", null);
    await expect(runChange(h.deps, changeRequest(h.draft)!)).rejects.toThrow("photo failed");
    // not on screen yet: Change it (Back to my art) is still on the piece
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(currentArtworkId(h.draft)).toBe("p1");
    answers.products = prod("pr2", "k1");
    const stages: string[] = [];
    await runChange(h.deps, changeRequest(h.draft)!, (st) => stages.push(st));
    expect(stages).toEqual(["product"]);
    const api = h.calls.filter((c) => c.startsWith("api"));
    expect(api.filter((c) => c.includes("/change"))).toHaveLength(1);
    expect(api.filter((c) => c.includes("/cutout"))).toHaveLength(1);
    const ids = api.filter((c) => c.startsWith("api products")).map((c) => JSON.parse(c.slice(c.indexOf("{"))).clientRequestId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(h.draft.changedArtworkId).toBe("k1");
  });

  it("overlapping runs: an abandoned change A finishing late never takes over the screen nor clears B's request (either order)", async () => {
    const chA = { artwork: { ...artwork({ id: "kA", parentArtworkId: "p1" }), previewUrl: "/kA.png" }, description: { alt: "A", spoken: "", differences: "" } };
    const chB = { artwork: { ...artwork({ id: "kB", parentArtworkId: "p1" }), previewUrl: "/kB.png" }, description: { alt: "B", spoken: "", differences: "" } };
    const setup = () => {
      let next: unknown = chA;
      const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } }, {});
      // answers by artwork id in the path / body
      h.api.mockImplementation((async (path: string, init?: { json?: unknown }) => {
        h.calls.push(`api ${path} ${JSON.stringify(init?.json ?? null)}`);
        if (path.endsWith("/change")) return next;
        const id = path.split("/")[1];
        if (path.endsWith("/cutout")) return { artwork: artwork({ id, cleanedUrl: `/${id}-cut.png` }), candidates: [], imageSize: { w: 10, h: 10 } };
        const art = (init?.json as { artworkId: string }).artworkId;
        return prod(`pr-${art}`, art);
      }) as never);
      return { h, setNext: (v: unknown) => { next = v; } };
    };

    // 1) A started, Back, B started and finished first, then A finishes → the screen stays on B
    {
      const { h, setNext } = setup();
      submitChange(h.deps, "make it red", null);
      const reqA = changeRequest(h.draft)!;
      const runA = runChange(h.deps, reqA); // in flight
      leaveChanging(h.deps);
      submitChange(h.deps, "make it blue", null);
      setNext(chB);
      const reqB = changeRequest(h.draft)!;
      // A's change call already went out with chA; B's gets chB
      await runChange(h.deps, reqB);
      expect(h.draft.changedArtworkId).toBe("kB");
      await runA;
      expect(h.draft.changedArtworkId).toBe("kB");
      expect(h.draft.cutoutArtworkId).toBe("kB");
      // A is still recorded (its cut and product too), just not on screen
      expect(h.draft.changes?.map((c) => c.artworkId).sort()).toEqual(["kA", "kB"]);
      expect(cutoutOf(h.draft, "kA")?.cleanedUrl).toBe("/kA-cut.png");
      expect(h.draft.made?.kA?.id).toBe("pr-kA");
    }

    // 2) A started, Back, B started; A finishes while B is still running → B's request is not cleared
    {
      const { h, setNext } = setup();
      submitChange(h.deps, "make it red", null);
      const reqA = changeRequest(h.draft)!;
      const runA = runChange(h.deps, reqA);
      leaveChanging(h.deps);
      submitChange(h.deps, "make it blue", "make it blue");
      await runA;
      expect(h.draft).toMatchObject({ changeInstruction: "make it blue", changeTranscript: "make it blue" });
      expect(h.draft.changedArtworkId).toBeUndefined();
      expect(h.calls).not.toContain("replace /create/compare");
      setNext(chB);
      await runChange(h.deps, changeRequest(h.draft)!);
      expect(h.draft.changedArtworkId).toBe("kB");
      expect(h.draft.changeInstruction).toBeUndefined();
    }
  });

  it("Fix the cutout round trip: Change it → Your cutout (Back returns) → Apply cutout → the cleanup answer's products give the rebuilt photo → Use this → Change it shows it, no POST", async () => {
    const listing = { title: "Fern", description: "", tags: [], price_cents: 500, print_ok: true, notes: "" };
    const start: Draft = { ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } }, productRecord: prod("pr1", "p1"), listing };
    const h = harness(start, { "/cleanup": { ...artwork({ cleanedUrl: "/piece-2.png" }), details: { failedProductIds: [], unpublishedProductIds: [] }, products: [listItem("pr1", { mockupUrl: "/pr1-photo-v2.png" })] } });
    fixCutout(h.deps, "/create/change");
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft.cutoutArtworkId).toBe("p1");
    expect(yourCutoutBack(h.draft, "p1")).toBe("/create/change");
    await applyMarks(h.deps, pieceCut, marksRequest(["c1"], [0, 0, 100, 100], [{ x: 5, y: 6, label: "positive" }]));
    expect(h.draft.made?.p1).toMatchObject({ mockupUrl: "/pr1-photo-v2.png", cut: "/piece-2.png" });
    // the product on the listing follows, and its stale print check is dropped
    expect(h.draft.productRecord?.mockupUrl).toBe("/pr1-photo-v2.png");
    expect(h.draft.listing).toBeUndefined();
    takeCutout(h.deps, "p1");
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(h.draft.cutoutReturn).toBeUndefined();
    expect(changeItProduct(h.draft).plan).toBe("ready");
    expect(productPicture(h.draft, "p1").src).toBe("/pr1-photo-v2.png");
    expect(h.calls.filter((c) => c.startsWith("api products"))).toEqual([]);
  });

  it("Fix the cutout without products in the answer: Change it stays in the making state and reads the rebuilt photo from GET /artworks", async () => {
    const h = harness({ ...piece, made: { p1: { ...prod("pr1", "p1"), cut: "/piece.png" } } }, {
      "/cleanup": artwork({ cleanedUrl: "/piece-2.png" }),
      artworks: { artworks: [{ id: "p1", products: [listItem("pr1", { mockupUrl: "/pr1-photo-v3.png" })] }] },
    });
    await applyMarks(h.deps, pieceCut, marksRequest(["c1"], [0, 0, 100, 100], [{ x: 5, y: 6, label: "positive" }]));
    takeCutout(h.deps, "p1");
    expect(changeItProduct(h.draft).plan).toBe("refresh");
    await runProduct(h.deps, "p1");
    expect(h.calls.filter((c) => c.startsWith("api")).at(-1)).toBe("api artworks null");
    expect(changeItProduct(h.draft).plan).toBe("ready");
    expect(productPicture(h.draft, "p1").src).toBe("/pr1-photo-v3.png");
  });

  it("Fix the cutout from Before and after opens the change result's cut; Back returns to Before and after", () => {
    const k1Cut: CutoutState = { ...pieceCut, artworkId: "k1", cleanedUrl: "/k1-cut.png" };
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: k1Cut } });
    fixCutout(h.deps, "/create/compare");
    expect(h.draft.cutoutArtworkId).toBe("k1");
    expect(cutoutVisit(h.draft)).toBe("cut");
    expect(yourCutoutBack(h.draft, "k1")).toBe("/create/compare");
    // Use this → Change it on k1 (still on screen)
    takeCutout(h.deps, "k1");
    expect(currentArtworkId(h.draft)).toBe("k1");
    expect(yourCutoutBack(h.draft, "k1")).toBe("/create/change");
  });
});

describe("After a change: Apply cutout on the change result", () => {
  it("cleanup {candidateIds:[candidates[0]], box: whole picture, points, clipToBox}; the piece is untouched", async () => {
    const k1Cut: CutoutState = { artworkId: "k1", candidates: [{ ...candidates[0], id: "k1c" }], imageSize: { w: 200, h: 150 }, selectedIds: ["k1c"], cleanedUrl: "/k1-cut.png", altText: null, box: [0, 0, 200, 150], points: [] };
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")), cutouts: { p1: pieceCut, k1: k1Cut } }, { "/cleanup": artwork({ id: "k1", cleanedUrl: "/k1-cut-2.png" }) });
    const points = [{ x: 10, y: 20, label: "positive" as const }, { x: 50, y: 60, label: "negative" as const }];
    await applyMarks(h.deps, k1Cut, marksRequest(k1Cut.selectedIds, k1Cut.box!, points));
    expect(h.calls[0]).toBe('api artworks/k1/cleanup {"candidateIds":["k1c"],"box":[0,0,200,150],"points":[{"x":10,"y":20,"label":"positive"},{"x":50,"y":60,"label":"negative"}],"clipToBox":true}');
    expect(cutoutOf(h.draft, "k1")).toMatchObject({ cleanedUrl: "/k1-cut-2.png", points });
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
    const h = harness(start, { "/change": changeAnswer, ...chainRest("k2") });
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
    const answers: Record<string, unknown> = { "/change": { artwork: { ...artwork({ id: "k1", parentArtworkId: "p1" }), previewUrl: "/k1.png" }, description: { alt: "blue", spoken: "", differences: "" } }, ...chainRest("k1") };
    const h = harness({ ...piece }, answers);
    submitChange(h.deps, "make it blue", null);
    const first = h.draft.changeNonce;
    await once(`change:${first}:0`, () => runChange(h.deps, changeRequest(h.draft)!));
    // Before and after → Change it again → a new request
    Object.assign(answers, { "/change": changeAnswer, ...chainRest("k2") });
    submitChange(h.deps, "make the stem red", null);
    const second = h.draft.changeNonce;
    expect(second).not.toBe(first);
    expect(changingVisit(h.draft, second)).toBe("send");
    // the screen opened with the first nonce (kept mounted) must not send anything
    expect(changingVisit(h.draft, first)).toBe("compare");
    const sent = () => h.calls.filter((c) => c.startsWith("api") && c.includes("/change"));
    await once(`change:${second}:0`, () => runChange(h.deps, changeRequest(h.draft)!));
    expect(sent()).toEqual([
      `api artworks/p1/change {"instruction":"make it blue","clientRequestId":"${first}"}`,
      `api artworks/k1/change {"instruction":"make the stem red","clientRequestId":"${second}"}`,
    ]);
  });

  it("a revisit after the request finished goes to compare and does not post again", async () => {
    const h = harness({ ...piece }, { "/change": changeAnswer, ...chainRest("k2") });
    submitChange(h.deps, "make it bigger", null);
    const nonce = h.draft.changeNonce;
    expect(changingVisit(h.draft, nonce)).toBe("send");
    await runChange(h.deps, changeRequest(h.draft)!);
    expect(changingVisit(h.draft, nonce)).toBe("compare");
    expect(h.api).toHaveBeenCalledTimes(3);
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
    const h = harness({ ...piece }, { artworks: createAnswer() });
    let busy = false;
    cutArea(h.deps, [1, 1, 99, 99]);
    await busyWhile((v: boolean) => { busy = v; seen.push(v); }, true, false, () => runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!));
    expect(h.calls.at(-1)).toBe("update pendingArea,pieceArtworkId,piecePhotoKey,pieceBox,pieceUrl,pieceAlt,pieceSpoken,cutouts,cutoutArtworkId,cutoutNotice");
    expect(busy).toBe(false);
    let work: string | null = null;
    await busyWhile<string | null>((v) => { work = v; seen.push(v); }, "use", null, async () => { throw new Error("cut failed"); }).catch(() => {});
    expect(work).toBeNull();
    expect(seen).toEqual([true, false, "use", null]);
  });
});

describe("T118 / T130: Back from Change it", () => {
  it("goes to Your cutout even with a change on screen, and leaves the change chain intact", () => {
    const d: Draft = { ...piece, ...addChange(piece, change("k1", "p1")) };
    d.changes = [...(d.changes ?? []), change("k2", "k1")];
    d.changedArtworkId = "k2";
    const before = JSON.stringify(d);
    expect(changeItBack(d)).toBe("/create/cutout");
    expect(JSON.stringify(d)).toBe(before);
    expect(currentArtworkId(d)).toBe("k2");
    // a draft without a cut (an old session) goes back to Adjust the area on the local photo, or the photo screen without it
    const old = { ...piece, cutouts: undefined, cutoutArtworkId: undefined };
    expect(changeItBack(old)).toBe("/create/adjust");
    expect(changeItBack({ ...old, area: undefined, method: "upload" })).toBe("/create/photo?mode=upload");
    expect(changeItBack({ ...old, area: { ...area, photoKey: "gone" } })).toBe("/create/photo?mode=camera");
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

  it("a double tap on Use this area uploads one crop and sends one POST /artworks", async () => {
    const h = harness({ product: "sticker", area }, { artworks: createAnswer() });
    const u = uploader();
    cutArea(h.deps, [8, 9, 222, 121]);
    const job = h.draft.pendingArea!;
    cutArea(h.deps, [8, 9, 222, 121]);
    expect(h.draft.pendingArea?.nonce).toBe(job.nonce);
    expect(h.calls.filter((c) => c === "push /create/cutout")).toHaveLength(2);
    // Making your cutout runs the job once per nonce (both visits share the in-flight call)
    const run = () => runAreaCut({ ...h.deps, upload: u.upload }, job);
    await Promise.all([once(`area:${job.nonce}:0`, run), once(`area:${h.draft.pendingArea!.nonce}:0`, run)]);
    expect(u.upload).toHaveBeenCalledTimes(1);
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

describe("Round 3 ruling 6: clientRequestId on change and products", () => {
  it("the change carries its nonce as clientRequestId, and Try again sends the same one", async () => {
    const h = harness({ ...piece }, { "/change": new ApiError(504, "deadline_exceeded", "late") });
    submitChange(h.deps, "make it blue", "make it blue");
    const nonce = h.draft.changeNonce as string;
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    const req = changeRequest(h.draft)!;
    expect(req.clientRequestId).toBe(nonce);
    await expect(runChange(h.deps, req)).rejects.toThrow();
    await expect(runChange(h.deps, changeRequest(h.draft)!)).rejects.toThrow();
    const bodies = h.calls.filter((c) => c.includes("/change")).map((c) => JSON.parse(c.slice(c.indexOf("{"))));
    expect(bodies).toEqual([
      { instruction: "make it blue", transcript: "make it blue", clientRequestId: nonce },
      { instruction: "make it blue", transcript: "make it blue", clientRequestId: nonce },
    ]);
  });
});

describe("Round 3 ruling 5: Redo while the listing drafts", () => {
  const product = { id: "pr1", artworkId: "p1", creatorId: "me", type: "sticker" as const, mockupUrl: "/m.png", printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: "/pv.png" };
  it("drops the run, opens Your cutout of the product's artwork and keeps the draft product; Use this returns to Change it with it (round 4: no second POST)", () => {
    const h = harness({ ...piece, artworkId: "p1", productRecord: product, made: { p1: { ...product, cut: "/piece.png" } }, listingRun: "run-1", productJob: { artworkId: "p1", requestId: "req-1" } });
    expect(canRedoListing(h.draft)).toBe(true);
    redoListing(h.deps);
    expect(h.draft.listingRun).toBeUndefined();
    expect(h.draft.cutoutArtworkId).toBe("p1");
    expect(h.draft.productRecord).toEqual(product);
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(cutoutVisit(h.draft)).toBe("cut");
    // Use this → Change it, which shows the product at once
    takeCutout(h.deps, "p1");
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(changeItProduct(h.draft)).toMatchObject({ artworkId: "p1", plan: "ready" });
    expect(h.api).not.toHaveBeenCalled();
  });

  it("no cut of the product's artwork in the draft: Redo falls back to Adjust the area on the local photo (review m1); nothing to go to → no Redo", () => {
    const h = harness({ productRecord: product, area, product: "sticker", listingRun: "run-1", areaNotFound: { photoKey: PHOTO, box: [0, 0, 1, 1] } });
    expect(canRedoListing(h.draft)).toBe(true);
    redoListing(h.deps);
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(h.draft.area).toEqual(area);
    expect(h.draft.areaNotFound).toBeUndefined();
    expect(h.draft.listingRun).toBeUndefined();
    expect(h.draft.productRecord).toEqual(product);
    expect(canRedoListing({ productRecord: product })).toBe(false);
    expect(canRedoListing({})).toBe(false);
  });
});

describe("Round 3 review I3: Re-do the cutout after a print check", () => {
  const product = { id: "pr1", artworkId: "p1", creatorId: "me", type: "sticker" as const, mockupUrl: "/m.png", printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "draft", previewUrl: "/pv.png" };
  const listed: Draft = { ...piece, artworkId: "p1", productRecord: product, listingRun: "run-1", listing: { title: "Fern", description: "", tags: [], price_cents: 500, print_ok: false, print_check: "resolution", notes: "" } };
  it("resolution (marks cannot fix it) → Adjust the area on the local photo with the last frame, where the frame can grow or a new photo is taken", () => {
    const h = harness(listed);
    expect(canRedoCutout(h.draft, "resolution")).toBe(true);
    redoCutout(h.deps, "resolution");
    expect(h.calls.at(-1)).toBe("push /create/adjust");
    expect(areaFrame(h.draft)).toEqual([1, 2, 30, 40]);
    expect(h.draft.listingRun).toBeUndefined();
    expect(h.api).not.toHaveBeenCalled();
  });
  it("contrast → Your cutout of the product's artwork", () => {
    const h = harness(listed);
    redoCutout(h.deps, "contrast");
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft.cutoutArtworkId).toBe("p1");
  });
  it("each falls back to the other screen (review m2); neither → no action", () => {
    expect(redoTarget({ productRecord: product, area }, "cutout")).toBe("adjust");
    expect(redoTarget({ ...listed, area: { ...area, photoKey: "gone" } }, "adjust")).toBe("cutout");
    expect(redoTarget({ productRecord: product }, "adjust")).toBeNull();
    expect(canRedoCutout({ productRecord: product }, "resolution")).toBe(false);
    expect(canRedoCutout({ ...listed, area: undefined }, "resolution")).toBe(true);
  });

  it("round 4: after a reload (no local photo) a resolution redo opens Your cutout on the stored crop with Take a new photo", () => {
    const h = harness({ ...listed, area: { ...area, photoKey: "gone" } });
    redoCutout(h.deps, "resolution");
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft.cutoutArtworkId).toBe("p1");
    expect(cutoutNewPhoto(h.draft, "p1")).toBe("/create/photo?mode=camera");
    expect(yourCutoutBack(h.draft, "p1")).toBe("/create/photo?mode=camera");
    // a change result's Your cutout never offers it (Back goes to Before and after)
    expect(cutoutNewPhoto({ ...h.draft, ...addChange(h.draft, change("k1", "p1")) }, "k1")).toBeNull();
  });
});

describe("Superseded and failed photo rows are deleted (T146)", () => {
  const deletes = (h: { api: { mock: { calls: unknown[][] } } }) =>
    h.api.mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === "DELETE").map((c) => c[0]);

  it("a re-frame deletes the previous photo row only after the new POST /artworks succeeds", async () => {
    const h = harness({ ...piece }, { artworks: createAnswer() });
    cutArea(h.deps, [5, 5, 100, 100]);
    expect(h.draft.pendingArea?.replaces).toBe("p1");
    expect(deletes(h)).toEqual([]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    const order = h.api.mock.calls.map((c) => `${(c[1] as { method?: string } | undefined)?.method ?? "POST"} ${c[0]}`);
    expect(order).toEqual(["POST artworks", "DELETE artworks/p1"]);
  });

  it("a failed new upload or create keeps the old row", async () => {
    const h = harness({ ...piece }, { artworks: new ApiError(504, "deadline_exceeded", "late") });
    cutArea(h.deps, [5, 5, 100, 100]);
    await expect(runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!)).rejects.toBeInstanceOf(ApiError);
    expect(deletes(h)).toEqual([]);
    const g = harness({ ...piece });
    cutArea(g.deps, [5, 5, 100, 100]);
    await expect(runAreaCut({ ...g.deps, upload: async () => { throw new Error("blob"); } }, g.draft.pendingArea!)).rejects.toThrow("blob");
    expect(deletes(g)).toEqual([]);
  });

  it("a first frame (no earlier row) deletes nothing", async () => {
    const h = harness({ product: "sticker", method: "photo", area }, { artworks: createAnswer() });
    cutArea(h.deps, [5, 5, 100, 100]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    expect(deletes(h)).toEqual([]);
  });

  it("a row that answered 422 is deleted on the next Use this area, same frame or moved", () => {
    for (const next of [[0, 0, 100, 100], [0, 0, 150, 150]] as Box[]) {
      const h = harness({ product: "sticker", area });
      cutArea(h.deps, [0, 0, 100, 100]);
      areaNotFound(h.deps, h.draft.pendingArea!, "bad1");
      expect(h.draft.areaNotFound?.artworkId).toBe("bad1");
      expect(deletes(h)).toEqual([]);
      cutArea(h.deps, next);
      expect(deletes(h)).toEqual(["artworks/bad1"]);
      expect(h.draft.areaNotFound?.artworkId).toBeUndefined();
    }
  });

  it("a 422 row is kept apart from the chain: the earlier photo row is still deleted after the later success", async () => {
    const h = harness({ ...piece }, { artworks: createAnswer() });
    cutArea(h.deps, [0, 0, 50, 50]);
    areaNotFound(h.deps, h.draft.pendingArea!, "bad1");
    cutArea(h.deps, [0, 0, 120, 120]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    expect(deletes(h)).toEqual(["artworks/bad1", "artworks/p1"]);
  });

  it("Take a new photo deletes the 422 row once", () => {
    const h = harness({ product: "sticker", area });
    cutArea(h.deps, [0, 0, 100, 100]);
    areaNotFound(h.deps, h.draft.pendingArea!, "bad1");
    discardNotFoundRow(h.deps);
    discardNotFoundRow(h.deps);
    expect(deletes(h)).toEqual(["artworks/bad1"]);
  });

  it("a failed delete is logged and does not block the flow", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = harness({ ...piece }, { artworks: createAnswer(), "artworks/p1": new ApiError(500, "server_error", "x") });
    cutArea(h.deps, [5, 5, 100, 100]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.draft.pieceArtworkId).toBe("p2");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a row with a published product is never deleted", async () => {
    const made = { id: "pr1", artworkId: "p1", creatorId: "me", type: "sticker" as const, mockupUrl: null, printPngUrl: null, printSvgUrl: null, priceCents: 500, status: "published", previewUrl: null, cut: null };
    const d: Draft = { ...piece, made: { p1: made } };
    expect(hasPublishedProduct(d, "p1")).toBe(true);
    expect(hasPublishedProduct({ ...piece }, "p1")).toBe(false);
    const h = harness(d, { artworks: createAnswer() });
    cutArea(h.deps, [5, 5, 100, 100]);
    await runAreaCut({ ...h.deps, upload: uploader().upload }, h.draft.pendingArea!);
    await dropRow(h.deps, "p1");
    expect(deletes(h)).toEqual([]);
  });
});
