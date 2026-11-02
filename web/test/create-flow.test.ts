import { describe, expect, it, vi } from "vitest";
import {
  afterPhoto, changeRequest, changingEntry, choosePiece, drawBoxOnPhoto, leaveChanging, runChange, skipChange, submitChange, type FlowDeps,
} from "@/components/create/flow";
import { addChange, backToOriginal, currentArtworkId, type ChangeStep, type Draft } from "@/components/create/store";

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
const piece: Draft = { product: "sticker", method: "photo", photoArtworkId: "p1", candidates, imageSize: { w: 100, h: 100 }, pieceArtworkId: "p1", pieceCandidateId: "c1", pieceUrl: "/piece.png", pieceAlt: "A fern" };
const change = (id: string, parentId: string): ChangeStep => ({ artworkId: id, parentId, instruction: `do ${id}`, previewUrl: `/${id}.png`, alt: `alt ${id}`, spoken: null, differences: "" });
const changeAnswer = { artwork: { ...artwork({ id: "k2", parentArtworkId: "k1" }), previewUrl: "/k2.png" }, description: { alt: "A fern, bigger", spoken: "A big fern.", differences: "" } };

describe("Photo routing (T113)", () => {
  it("one piece already cut → Change it with that piece; earlier changes are dropped", () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1" });
    afterPhoto(h.deps, { artwork: artwork({ id: "p9", cleanedUrl: "/p9.png" }), candidates: [candidates[0]], imageSize: { w: 50, h: 60 } });
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(h.draft).toMatchObject({ photoArtworkId: "p9", pieceArtworkId: "p9", pieceCandidateId: "c1", pieceUrl: "/p9.png", imageSize: { w: 50, h: 60 } });
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

  it("zero pieces, Draw a box → Your cutout in box mode on that photo", () => {
    const h = harness(piece);
    drawBoxOnPhoto(h.deps, "p9");
    expect(h.calls.at(-1)).toBe("push /create/cutout");
    expect(h.draft).toMatchObject({ cutoutArtworkId: "p9", cutout: { artworkId: "p9", candidates: [], selectedIds: [] } });
    expect(h.draft.pieceArtworkId).toBeUndefined();
  });
});

describe("Choose a pattern (T113)", () => {
  it("another piece → POST select, the new piece goes on screen", async () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1" }, { "/select": artwork({ cleanedUrl: "/c2-cut.png", altText: "A flower" }) });
    await choosePiece(h.deps, "p1", "c2");
    expect(h.calls[0]).toBe('api artworks/p1/select {"candidateId":"c2"}');
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(h.draft).toMatchObject({ pieceCandidateId: "c2", pieceUrl: "/c2-cut.png", pieceAlt: "A flower" });
    expect(h.draft.changedArtworkId).toBeUndefined();
  });

  it("the same piece again → no call, and Change it opens on the piece, not on an earlier change (review M5)", async () => {
    const h = harness({ ...piece, changes: [change("k1", "p1")], changedArtworkId: "k1" });
    await choosePiece(h.deps, "p1", "c1");
    expect(h.api).not.toHaveBeenCalled();
    expect(h.calls.at(-1)).toBe("push /create/change");
    expect(h.calls.findIndex((c) => c.startsWith("update"))).toBeLessThan(h.calls.indexOf("push /create/change"));
    expect(h.draft.changedArtworkId).toBeUndefined();
    expect(currentArtworkId(h.draft)).toBe("p1");
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

  it("Looks good as is on the piece → Your cutout with the cut from select (no call)", () => {
    const h = harness(piece);
    skipChange(h.deps);
    expect(h.draft).toMatchObject({ cutoutArtworkId: "p1", cutout: { artworkId: "p1", selectedIds: ["c1"], cleanedUrl: "/piece.png" } });
    expect(h.calls.at(-1)).toBe("push /create/cutout");
  });

  it("Looks good as is on a change → Your cutout makes the cut (no cut-out in the draft yet)", () => {
    const h = harness({ ...piece, ...addChange(piece, change("k1", "p1")) });
    skipChange(h.deps);
    expect(h.draft.cutoutArtworkId).toBe("k1");
    expect(h.draft.cutout).toBeUndefined();
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
