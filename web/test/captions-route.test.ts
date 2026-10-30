import { describe, expect, it, vi } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const TOKEN = "ABCDEFGH2345";
const NO_VIDEO = "ZZZZZZZZ2345";
const VTT = "WEBVTT\n\n00:00.000 --> 00:02.000\nHi, I'm Leo.\n";
const TY_VTT = "WEBVTT\n\n00:00.000 --> 00:01.500\nThank you!\n";

vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/pipeline/public", () => ({ placeOrder: async () => null, sendReply: async () => null, tap: async () => null }));
vi.mock("@/lib/db/queries", () => ({
  getCreatorById: async (id: string) => (id === A ? { id: A, storyVideoVtt: VTT } : id === B ? { id: B, storyVideoVtt: null } : null),
  getStoryTag: async (t: string) => (t === TOKEN
    ? { thankYou: { videoUrl: "creators/x/thank-you/v.mp4", videoVtt: TY_VTT } }
    : t === NO_VIDEO ? { thankYou: { videoUrl: null, videoVtt: "WEBVTT\n\nstale" } } : null),
}));

import { GET as creatorCaptions } from "@/app/captions/[creatorId]/route";
import { GET as tagCaptions } from "@/app/captions/tag/[token]/route";

const req = (p: string) => new Request(`http://localhost${p}`);
const byCreator = (creatorId: string) => creatorCaptions(req(`/captions/${creatorId}`), { params: Promise.resolve({ creatorId }) } as never);
const byTag = (token: string) => tagCaptions(req(`/captions/tag/${token}`), { params: Promise.resolve({ token }) } as never);

describe("GET /captions/<creatorId>", () => {
  it("serves the creator's story-video WebVTT, publicly cacheable", async () => {
    const res = await byCreator(A);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/vtt; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await res.text()).toBe(VTT);
  });

  it("404 with an empty WebVTT body when there are no captions, the id is unknown or not a uuid", async () => {
    for (const id of [B, "33333333-3333-3333-3333-333333333333", "not-a-uuid"]) {
      const res = await byCreator(id);
      expect(res.status).toBe(404);
      expect(res.headers.get("content-type")).toBe("text/vtt; charset=utf-8");
      expect(await res.text()).toBe("WEBVTT\n\n");
    }
  });
});

describe("GET /captions/tag/<token>", () => {
  it("serves the order's thank-you captions, privately cacheable", async () => {
    const res = await byTag(TOKEN.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=300");
    expect(await res.text()).toBe(TY_VTT);
  });

  it("404 when the tag has no thank-you video (stale captions are not served), is unknown or malformed", async () => {
    for (const t of [NO_VIDEO, "QQQQQQQQ2345", "../x"]) expect((await byTag(t)).status).toBe(404);
  });
});
