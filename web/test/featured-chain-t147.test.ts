import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Public creators as `listCreators` returns them (hidden ones are never in the list). */
type Row = { id: string; slug: string; createdAt: Date; storyVideoUrl: string | null };
const hoisted = vi.hoisted(() => ({ creators: [] as Row[], latestProductCreator: null as Row | null }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("@/lib/pipeline/public", () => ({ placeOrder: async () => null, sendReply: async () => null, tap: async () => null }));
vi.mock("@/lib/db/queries", () => ({
  listCreators: async () => hoisted.creators,
  listPublishedProducts: async () => (hoisted.latestProductCreator ? [{ creator: hoisted.latestProductCreator }] : []),
}));

const { getFeaturedCreator, listMakers } = await import("@/lib/db/queries.contract");

const row = (slug: string, day: number, video = false): Row =>
  ({ id: slug, slug, createdAt: new Date(2026, 9, day), storyVideoUrl: video ? `creators/${slug}/story-video/a.mp4` : null });
const maya = row("maya-ortiz", 2, true);
const tester = row("test-artist", 5, true);
const june = row("june-park", 3);
const sam = row("sam", 4);

describe("featured creator chain (getFeaturedCreator / listMakers, T147)", () => {
  beforeEach(() => { hoisted.creators = []; hoisted.latestProductCreator = null; });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("1 · the default slug june-park wins over a creator with a video and leads Meet the makers", async () => {
    vi.stubEnv("FEATURED_CREATOR_SLUG", "");
    hoisted.creators = [tester, sam, june, maya];
    expect((await getFeaturedCreator())?.slug).toBe("june-park");
    expect((await listMakers(3)).map((c) => c.slug)).toEqual(["june-park", "test-artist", "maya-ortiz"]);
  });

  it("1 · FEATURED_CREATOR_SLUG overrides the default", async () => {
    vi.stubEnv("FEATURED_CREATOR_SLUG", "maya-ortiz");
    hoisted.creators = [tester, sam, june, maya];
    expect((await getFeaturedCreator())?.slug).toBe("maya-ortiz");
    expect((await listMakers(3)).map((c) => c.slug)).toEqual(["maya-ortiz", "test-artist", "sam"]);
  });

  it("2 · slug hidden or unknown → the newest creator with a story video; Meet the makers keeps its order", async () => {
    vi.stubEnv("FEATURED_CREATOR_SLUG", "leo");
    hoisted.creators = [tester, sam, maya];
    expect((await getFeaturedCreator())?.slug).toBe("test-artist");
    expect((await listMakers(3)).map((c) => c.slug)).toEqual(["test-artist", "maya-ortiz", "sam"]);
  });

  it("3 · no story videos → the creator of the newest published product", async () => {
    vi.stubEnv("FEATURED_CREATOR_SLUG", "leo");
    hoisted.creators = [row("sam", 4), row("ana", 1)];
    hoisted.latestProductCreator = row("ana", 1);
    expect((await getFeaturedCreator())?.slug).toBe("ana");
  });

  it("4 · no videos and no products → the first public creator; none at all → null", async () => {
    vi.stubEnv("FEATURED_CREATOR_SLUG", "leo");
    hoisted.creators = [row("sam", 4), row("ana", 1)];
    expect((await getFeaturedCreator())?.slug).toBe("sam");
    hoisted.creators = [];
    expect(await getFeaturedCreator()).toBeNull();
  });
});
