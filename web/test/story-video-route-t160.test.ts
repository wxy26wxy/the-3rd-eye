import { beforeEach, describe, expect, it, vi } from "vitest";

const C = "11111111-1111-1111-1111-111111111111";
const OLD = `creators/${C}/story-video/old.mp4`;
const NEW = `creators/${C}/story-video/new.mp4`;
const state = { previous: null as string | null, calls: [] as string[], deleteFails: false, updateNull: false };

vi.mock("@/lib/auth", () => ({ requireCreator: () => ({ creatorId: C }) }));
vi.mock("@/lib/api/dto", () => ({ toCreator: (c: unknown) => c }));
vi.mock("@/lib/pipeline/story", () => ({ draftStoryFor: async () => ({ creator: undefined }) }));
vi.mock("@/lib/ai/registry", () => ({ ai: async () => ({ captioner: { caption: async () => ({ vtt: "WEBVTT\n", transcript: "Hello." }) } }) }));
vi.mock("@/lib/db/queries", () => ({
  getCreatorById: async () => { state.calls.push("read"); return { id: C, storyVideoUrl: state.previous }; },
  updateCreator: async (_id: string, patch: Record<string, unknown>) => {
    state.calls.push("update");
    return state.updateNull ? null : { id: C, mentionDisability: false, ...patch };
  },
}));
vi.mock("@/lib/storage", () => ({
  clientUploadPath: (p: string) => p,
  readClientUpload: async () => Buffer.from("x"),
  storage: () => ({ delete: async (p: string) => { state.calls.push(`delete ${p}`); if (state.deleteFails) throw new Error("blob 500"); } }),
}));

import { POST } from "@/app/api/v1/creators/me/story-video/route";

const post = () => POST(new Request("http://localhost/api/v1/creators/me/story-video", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ videoUrl: NEW }),
}), {} as never);

describe("POST /creators/me/story-video: the replaced blob (T160)", () => {
  beforeEach(() => { state.previous = null; state.calls = []; state.deleteFails = false; state.updateNull = false; });

  it("reads the previous pathname first and deletes it only after the update", async () => {
    state.previous = OLD;
    expect((await post()).status).toBe(200);
    expect(state.calls.slice(0, 3)).toEqual(["read", "update", `delete ${OLD}`]);
  });

  it("deletes nothing when there was no previous video or it is the same pathname", async () => {
    for (const previous of [null, NEW]) {
      state.previous = previous; state.calls = [];
      await post();
      expect(state.calls.some((c) => c.startsWith("delete "))).toBe(false);
    }
  });

  it("warns and still answers 200 when the delete fails", async () => {
    state.previous = OLD; state.deleteFails = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await post()).status).toBe(200);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("could not delete the previous video"))).toBe(true);
    warn.mockRestore();
  });
});
