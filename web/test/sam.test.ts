import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { MetaSegmenter, untilCompleted } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";

/** Live SAM 3.1 stream recorded 2026-10-28 by scripts/probe_meta.ts (256×256, black disc r=60 at 128,128). */
const events = JSON.parse(readFileSync(join(__dirname, "fixtures/segment/probe-events.json"), "utf8")) as { type: string }[];
const disc = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#fff"/><circle cx="128" cy="128" r="60" fill="#000"/></svg>`)).png().toBuffer();
async function* replay(list: { type: string }[]) { for (const e of list) yield e; }

describe("SAM stream parsing", () => {
  it("parses the recorded live stream into one full-frame segment", async () => {
    const seg = new MetaSegmenter(async () => replay(events));
    const out = await seg.findAll(pngRef(await disc()), "black circle", { trace: { stage: "segment" } });
    expect(out).toHaveLength(1);
    expect(out[0].bbox).toEqual([68, 68, 188, 188]);
    expect(out[0].score).toBeGreaterThan(0.9);
    expect(out[0].mask.width).toBe(256);
    expect(out[0].mask.data[128 * 256 + 128]).toBe(1);
    expect(out[0].mask.data[10 * 256 + 10]).toBe(0);
    expect(out[0].svgPath.startsWith("M")).toBe(true);
  });

  it("completes when the lane is never finalized and stops at response.completed", async () => {
    const stripped = events.filter((e) => e.type !== "response.output_text.done" && e.type !== "response.content_part.done");
    const seen: string[] = [];
    for await (const e of untilCompleted(replay([...stripped, { type: "response.after" }]))) seen.push(e.type);
    expect(seen).toContain("response.output_text.done");
    expect(seen.at(-1)).toBe("response.completed");
    const seg = new MetaSegmenter(async () => replay(stripped));
    expect(await seg.findAll(pngRef(await disc()), "black circle", { trace: { stage: "segment" } })).toHaveLength(1);
  });

  it("falls back to a threshold mask when SAM returns no records", async () => {
    const empty = [{ type: "response.completed" }];
    const seg = new MetaSegmenter(async () => replay(empty));
    const out = await seg.findAll(pngRef(await disc()), "black circle", { trace: { stage: "segment" } });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].mask.data[128 * 256 + 128]).toBe(1);
  });
});
