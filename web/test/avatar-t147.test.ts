import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { fmt, m } from "@/components/messages";
import type { ProductDetail, StoryTagView as StoryTagData } from "@/lib/db/queries.contract";

// The story tag's server actions are stubbed: rendering must not reach the database.
vi.mock("@/app/t/[token]/actions", () => ({ tap: vi.fn(), sendReply: vi.fn() }));

const { AVATAR_PX, cropAvatar, seedAvatar, setAvatar } = await import("@/lib/pipeline/avatar");
const { MakerCard } = await import("@/components/shop/MeetArtist");
const { MeetMakerCard } = await import("@/components/product/ProductParts");
const { StoryTagView } = await import("@/components/storytag/StoryTagView");

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const AVATARS = resolve(__dirname, "../../scripts/seed-assets/avatars");
const PHOTO = "https://pub.example/creators/c1/avatar/a.jpg";

/** A w × h portrait fixture: blue background, red square in the exact centre. */
function fixture(w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#3060c0"/><rect x="${w / 2 - 40}" y="${h / 2 - 40}" width="80" height="80" fill="#e02020"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("cropAvatar / setAvatar (pnpm avatar)", () => {
  it("crops any portrait to a 480 × 480 centre-square JPEG", async () => {
    const out = await cropAvatar(await fixture(600, 900));
    const meta = await sharp(out).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", AVATAR_PX, AVATAR_PX]);
    const { data } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
    const px = (x: number, y: number) => [...data.subarray((y * AVATAR_PX + x) * 3, (y * AVATAR_PX + x) * 3 + 3)];
    expect(px(240, 240)[0]).toBeGreaterThan(180); // the centre square stays in the centre
    expect(px(10, 10)[2]).toBeGreaterThan(150); // background at the corner
  });

  function deps() {
    const calls: string[] = [];
    const lines: string[] = [];
    return {
      calls, lines,
      d: {
        readFile: async () => fixture(818, 970),
        findCreator: async (slug: string) => { calls.push(`find ${slug}`); return slug === "maya-ortiz" ? { id: "c1" } : null; },
        put: async (id: string, jpeg: Buffer) => { calls.push(`put ${id} ${jpeg.length > 0}`); return PHOTO; },
        save: async (id: string, url: string) => { calls.push(`save ${id} ${url}`); return true; },
        log: (l: string) => lines.push(l),
      },
    };
  }

  it("stores the crop publicly and sets avatar_url; prints the slug, the crop size and the URL only", async () => {
    const f = deps();
    const res = await setAvatar(f.d, { slug: "maya-ortiz", file: "maya.jpg" });
    expect(res).toEqual({ slug: "maya-ortiz", size: 480, url: PHOTO });
    expect(f.calls).toEqual(["find maya-ortiz", "put c1 true", `save c1 ${PHOTO}`]);
    expect(f.lines).toEqual(["slug: maya-ortiz", "crop: 480x480", `avatar: ${PHOTO}`]);
  });

  it("--dry-run crops and reports without any storage or database call", async () => {
    const f = deps();
    const res = await setAvatar(f.d, { slug: "maya-ortiz", file: "maya.jpg", dryRun: true });
    expect(res.url).toBeNull();
    expect(f.calls).toEqual([]);
    expect(f.lines.slice(0, 2)).toEqual(["slug: maya-ortiz", "crop: 480x480"]);
  });

  it("an unknown slug fails before anything is stored", async () => {
    const f = deps();
    await expect(setAvatar(f.d, { slug: "nobody", file: "x.jpg" })).rejects.toThrow(/nobody/);
    expect(f.calls).toEqual(["find nobody"]);
  });
});

describe("seed avatar rule (null only)", () => {
  function fake(files: Record<string, boolean>) {
    const puts: string[] = [];
    const rows = new Map<string, string | null>();
    return {
      puts, rows,
      d: {
        readFile: async (slug: string) => (files[slug] ? fixture(300, 400) : null),
        put: async (id: string) => { puts.push(id); return `${PHOTO}?${id}`; },
        setIfMissing: async (id: string, url: string) => { if (rows.get(id)) return false; rows.set(id, url); return true; },
      },
    };
  }

  it("sets the portrait when avatar_url is null and a file exists", async () => {
    const f = fake({ "maya-ortiz": true });
    expect(await seedAvatar(f.d, { id: "c1", slug: "maya-ortiz", avatarUrl: null })).toBe("set");
    expect(f.rows.get("c1")).toBe(`${PHOTO}?c1`);
  });

  it("never overwrites an existing avatar (no upload either)", async () => {
    const f = fake({ "maya-ortiz": true });
    expect(await seedAvatar(f.d, { id: "c1", slug: "maya-ortiz", avatarUrl: "https://pub.example/founder.jpg" })).toBe("kept");
    expect(f.puts).toEqual([]);
  });

  it("does nothing for a creator without a portrait file (Leo)", async () => {
    const f = fake({});
    expect(await seedAvatar(f.d, { id: "c3", slug: "leo", avatarUrl: null })).toBe("none");
    expect(f.puts).toEqual([]);
  });

  it("the repo ships Maya's and June's portraits only, each ≤ 800 px and ≤ 250 KB", async () => {
    expect(readdirSync(AVATARS).sort()).toEqual(["june-park.jpg", "maya-ortiz.jpg"]);
    expect(existsSync(resolve(AVATARS, "leo.jpg"))).toBe(false);
    for (const f of readdirSync(AVATARS)) {
      const meta = await sharp(resolve(AVATARS, f)).metadata();
      expect(meta.format).toBe("jpeg");
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(800);
      expect(statSync(resolve(AVATARS, f)).size).toBeLessThanOrEqual(250 * 1024);
    }
  });
});

describe("portraits on the site (T147)", () => {
  const maker = { slug: "maya-ortiz", displayName: "Maya Ortiz", studioName: "Riverbend Creative Arts", isExample: true };

  it("Meet the makers card: the portrait with alt=\"\" when present, decorative initials otherwise", () => {
    const withPhoto = html(createElement(MakerCard, { creator: { ...maker, avatarUrl: PHOTO } }));
    expect(withPhoto).toMatch(new RegExp(`<img src="${PHOTO}" alt=""`));
    expect(withPhoto).not.toMatch(/aria-hidden="true">MO</);
    const without = html(createElement(MakerCard, { creator: { ...maker, avatarUrl: null } }));
    expect(without).not.toContain("<img");
    expect(without).toMatch(/aria-hidden="true">MO</);
  });

  const creator = {
    id: "c1", slug: "maya-ortiz", displayName: "Maya Ortiz", studioName: "Riverbend Creative Arts", avatarUrl: PHOTO, bioShort: "I describe it.",
    storyText: null, storyVideoUrl: null, storyVideoVtt: null, mentionDisability: true, split: null, isExample: true, hidden: false,
  } as unknown as ProductDetail["creator"];

  it("product Meet the maker card: the portrait beside the maker's name; initials without one", () => {
    const withPhoto = html(createElement(MeetMakerCard, { product: { type: "sticker", creator } }));
    expect(withPhoto).toMatch(new RegExp(`<img src="${PHOTO}" alt=""[^>]*/?><p[^>]*>Maya Ortiz</p>`));
    const without = html(createElement(MeetMakerCard, { product: { type: "sticker", creator: { ...creator, avatarUrl: null } } }));
    expect(without).not.toContain(PHOTO);
    expect(without).toMatch(/aria-hidden="true">MO<\/span><p[^>]*>Maya Ortiz<\/p>/);
  });

  const view = (avatarUrl: string | null) => ({
    token: "tok", tapCount: 1, productTitle: "Sleepy Cat", product: null, creator: { ...creator, avatarUrl },
    moreFromStudio: [], thankYou: null, messages: [],
  }) as unknown as StoryTagData;

  it("story tag: a small decorative portrait next to Hi, I'm <name> when present; unchanged without", () => {
    const hi = fmt(m.tag.hi, { name: "Maya Ortiz" }).replace("'", "&#x27;");
    const withPhoto = html(createElement(StoryTagView, { view: view(PHOTO) }));
    expect(withPhoto).toMatch(new RegExp(`<img src="${PHOTO}" alt=""[^>]*/?><h1[^>]*>${hi}</h1>`));
    const without = html(createElement(StoryTagView, { view: view(null) }));
    expect(without).not.toContain(`src="${PHOTO}"`);
    expect(without).toContain(hi);
  });
});

describe("featured creator (FEATURED_CREATOR_SLUG, T147)", async () => {
  const { DEFAULT_FEATURED_SLUG, featuredSlug, findFeatured, leadWithFeatured } = await import("@/lib/creators/featured");
  const pub = [{ slug: "maya-ortiz" }, { slug: "test-artist" }, { slug: "june-park" }];

  it("defaults to june-park; the env var overrides it", () => {
    expect(DEFAULT_FEATURED_SLUG).toBe("june-park");
    expect(featuredSlug({})).toBe("june-park");
    expect(featuredSlug({ FEATURED_CREATOR_SLUG: "  " })).toBe("june-park");
    expect(featuredSlug({ FEATURED_CREATOR_SLUG: "maya-ortiz" })).toBe("maya-ortiz");
  });

  it("picks the featured creator and leads Meet the makers with it", () => {
    expect(findFeatured(pub, "june-park")).toEqual({ slug: "june-park" });
    expect(leadWithFeatured(pub, "june-park").map((c) => c.slug)).toEqual(["june-park", "maya-ortiz", "test-artist"]);
    expect(leadWithFeatured(pub, "maya-ortiz")).toBe(pub);
  });

  it("falls back when the slug is hidden or unknown (not among the public creators)", () => {
    expect(findFeatured(pub, "leo")).toBeNull();
    expect(leadWithFeatured(pub, "leo")).toEqual(pub);
  });
});
