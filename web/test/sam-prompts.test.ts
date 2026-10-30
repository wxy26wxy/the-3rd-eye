import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { MetaSegmenter, SAM_PHRASES, pickByHint } from "@/lib/ai/meta/sam";
import { pngRef } from "@/lib/image/ref";

/**
 * Live SAM 3.1 object-prompt streams recorded 2026-10-29 (320×256: black disc r=50 at (90,128),
 * grey square 200..280 × 88..168). box = [30,68,150,188] around the disc; points = positive on
 * the square (240,128) + negative on the disc (90,128).
 */
const load = (name: string) => JSON.parse(readFileSync(join(__dirname, `fixtures/segment/${name}`), "utf8")) as { type: string }[];
const boxEvents = load("probe-box-events.json");
const pointEvents = load("probe-points-events.json");
const scene = () => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="256"><rect width="320" height="256" fill="#fff"/><circle cx="90" cy="128" r="50" fill="#000"/><rect x="200" y="88" width="80" height="80" fill="#888"/></svg>`)).png().toBuffer();
async function* replay(list: { type: string }[]) { for (const e of list) yield e; }
const trace = { trace: { stage: "segment" } };
const textOf = (body: Record<string, unknown>) => ((body.input as { content: { type: string; text?: string }[] }[])[0].content.find((c) => c.type === "input_text")?.text ?? "");

describe("SAM object prompts (live recordings)", () => {
  it("a box prompt returns the boxed object", async () => {
    const sent: string[] = [];
    const sam = new MetaSegmenter(async (body) => { sent.push(textOf(body)); return replay(boxEvents); });
    const out = await sam.segment(pngRef(await scene()), { box: [30, 68, 150, 188] }, trace);
    expect(sent[0]).toBe("<0f>1<|box;x1=30;y1=68;x2=149;y2=187;w=320;h=256|>");
    expect(out?.bbox).toEqual([39, 77, 141, 180]);
    expect(out?.mask.data[128 * 320 + 90]).toBe(1);
    expect(out?.mask.data[128 * 320 + 240]).toBe(0);
  });

  it("positive + negative points: labels reach the prompt and the result is the positive object only", async () => {
    const sent: string[] = [];
    const sam = new MetaSegmenter(async (body) => { sent.push(textOf(body)); return replay(pointEvents); });
    const out = await sam.segment(pngRef(await scene()), { points: [{ x: 240, y: 128, label: "positive" }, { x: 90, y: 128, label: "negative" }] }, trace);
    expect(sent[0]).toBe("<0f>1<|point;x=240;y=128;w=320;h=256|>-<|point;x=90;y=128;w=320;h=256|>");
    expect(out?.bbox).toEqual([200, 88, 280, 168]);
    expect(out?.mask.data[128 * 320 + 90]).toBe(0);
  });

  it("findCandidates runs every phrase and merges duplicates", async () => {
    const phrases: string[] = [];
    // both phrases "find" the disc (same recording) → one candidate
    const sam = new MetaSegmenter(async (body) => { phrases.push(textOf(body)); return replay(boxEvents); });
    const out = (await sam.findCandidates(pngRef(await scene()), trace)).segments;
    expect(phrases.sort()).toEqual([...SAM_PHRASES].sort());
    expect(out).toHaveLength(1);
  });

  it("findCandidates keeps distinct objects found by different phrases", async () => {
    const sam = new MetaSegmenter(async (body) => replay(textOf(body) === "drawing" ? boxEvents : pointEvents));
    const out = (await sam.findCandidates(pngRef(await scene()), trace)).segments;
    expect(out.map((s) => s.bbox).sort((a, b) => a[0] - b[0])).toEqual([[39, 77, 141, 180], [200, 88, 280, 168]]);
  });

  it("findCandidates survives one phrase failing", async () => {
    const sam = new MetaSegmenter(async (body) => { if (textOf(body) === SAM_PHRASES[1]) throw new Error("boom"); return replay(pointEvents); });
    expect((await sam.findCandidates(pngRef(await scene()), trace)).segments).toHaveLength(1);
  });

  it("pickByHint (fallback) skips segments under a negative point", async () => {
    const sam = new MetaSegmenter(async () => replay(pointEvents));
    const segs = (await sam.findCandidates(pngRef(await scene()), trace)).segments;
    const disc = await new MetaSegmenter(async () => replay(boxEvents)).segment(pngRef(await scene()), { box: [30, 68, 150, 188] }, trace);
    const both = [disc!, ...segs];
    expect(pickByHint(both, { points: [{ x: 90, y: 128, label: "negative" }, { x: 240, y: 128 }] })?.bbox).toEqual([200, 88, 280, 168]);
  });
});
