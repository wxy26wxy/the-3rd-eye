import { describe, expect, it, vi } from "vitest";

const marked: { ids: string[]; msg: string }[] = [];
vi.mock("@/lib/db/queries", () => ({
  markArtworksFailed: async (ids: string[], msg: string) => { marked.push({ ids, msg }); },
}));

import { callSignal, currentSignal, DeadlineError, trackArtwork, withDeadline } from "@/lib/deadline";
import { runPipeline } from "@/lib/pipeline/run";
import { ApiError } from "@/lib/http";

describe("request deadline", () => {
  it("rejects at the deadline even when the work ignores the signal, and aborts the signal", async () => {
    let seen: AbortSignal | undefined;
    const p = withDeadline(50, async () => {
      seen = currentSignal();
      trackArtwork("a1");
      await new Promise((r) => setTimeout(r, 500));
      return "late";
    });
    await expect(p).rejects.toBeInstanceOf(DeadlineError);
    await expect(p).rejects.toMatchObject({ artworkIds: ["a1"] });
    expect(seen?.aborted).toBe(true);
  });

  it("per-call signals abort with the request deadline", async () => {
    let sig: AbortSignal | undefined;
    await expect(withDeadline(30, async () => {
      sig = callSignal(60_000);
      await new Promise((r) => setTimeout(r, 200));
    })).rejects.toBeInstanceOf(DeadlineError);
    expect(sig?.aborted).toBe(true);
  });

  it("runPipeline maps a timeout to 504 deadline_exceeded with the artwork id and records lastError", async () => {
    marked.length = 0;
    const err = await runPipeline(async () => {
      trackArtwork("art-1");
      await new Promise((r) => setTimeout(r, 300));
    }, 40).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 504, code: "deadline_exceeded", details: { artworkId: "art-1" } });
    expect(marked[0].ids).toEqual(["art-1"]);
  });

  it("runPipeline marks tracked artworks on failures and passes 4xx through unchanged", async () => {
    marked.length = 0;
    const fail = await runPipeline(async () => { trackArtwork("art-2"); throw new Error("boom"); }).catch((e) => e);
    expect(fail).toMatchObject({ status: 500, details: { artworkId: "art-2" } });
    expect(marked).toHaveLength(1);
    const user = await runPipeline(async () => { throw new ApiError(422, "no_drawing_found", "x", { artworkId: "art-3" }); }).catch((e) => e);
    expect(user).toMatchObject({ status: 422, code: "no_drawing_found" });
    expect(marked).toHaveLength(1);
    expect(await runPipeline(async () => 42)).toBe(42);
  });
});
