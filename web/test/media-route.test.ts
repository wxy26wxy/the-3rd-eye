import { beforeEach, describe, expect, it, vi } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const TOKEN = "ABCDEFGH2345";
const OTHER = "ZZZZZZZZ2345";
const thankYouVideo = `creators/${A}/thank-you/cccccccc-cccc-cccc-cccc-cccccccccccc.mp4`;
const thankYouImage = `creators/${A}/thank-you/dddddddd-dddd-dddd-dddd-dddddddddddd.jpg`;
const print = `creators/${A}/print/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png`;

const tagFiles: Record<string, string[]> = { [TOKEN]: [thankYouVideo, thankYouImage], [OTHER]: [] };
vi.mock("@/lib/db/queries", () => ({
  getTagMediaPaths: async (t: string) => tagFiles[t] ?? null,
  isStoryVideoPath: async () => false,
}));
vi.mock("@/lib/storage", () => ({
  storage: () => ({ signedUrl: async (p: string) => `https://signed.example/${p}`, getPrivateStream: async () => null }),
}));

import { GET } from "@/app/media/[...path]/route";

const get = (pathname: string, query = "", headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/media/${pathname}${query}`, { headers }), { params: Promise.resolve({ path: pathname.split("/") }) });

describe("GET /media with ?tag=", () => {
  beforeEach(() => { delete process.env.ADMIN_PASSWORD; });

  it("serves the order's own thank-you video and image", async () => {
    for (const p of [thankYouVideo, thankYouImage]) {
      const res = await get(p, `?tag=${TOKEN}`);
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(`https://signed.example/${p}`);
    }
  });

  it("denies a print file with a valid tag (403) and without one (401 + WWW-Authenticate)", async () => {
    expect((await get(print, `?tag=${TOKEN}`)).status).toBe(403);
    const anon = await get(print);
    expect(anon.status).toBe(401);
    expect(anon.headers.get("www-authenticate")).toMatch(/^Basic /);
  });

  it("another order's tag, or an unknown tag, cannot read this thank-you", async () => {
    expect((await get(thankYouVideo, `?tag=${OTHER}`)).status).toBe(403);
    expect((await get(thankYouVideo, "?tag=NOPE")).status).toBe(403);
  });

  it("admin basic auth reads print files", async () => {
    process.env.ADMIN_PASSWORD = "pw-for-tests";
    const auth = `Basic ${Buffer.from("admin:pw-for-tests").toString("base64")}`;
    expect((await get(print, "", { authorization: auth })).status).toBe(302);
  });
});
