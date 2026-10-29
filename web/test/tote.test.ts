import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PRINT_SPECS, productSpec } from "@/lib/products/registry";
import { checkResolution } from "@/lib/ai/meta/tools/check-resolution";

const fakeImage = {
  generate: async () => [], refine: async () => { throw new Error("unused"); },
  compose: async () => ({ png: await sharp({ create: { width: 64, height: 64, channels: 3, background: "#eee" } }).png().toBuffer(), responseId: "r", width: 64, height: 64 }),
};

/** A transparent canvas with an opaque disc, like a cleaned cut-out. */
async function cutout(w: number, h: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#c33"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("tote print file", () => {
  it("is the cleaned art at 150 dpi with a short side of at least 1500 px and its transparency kept", async () => {
    const built = await productSpec("tote").build({ cleanedPng: await cutout(800, 1000) }, { image: fakeImage, trace: { stage: "mockup" } });
    expect(built.printPng).toBeDefined();
    const meta = await sharp(built.printPng!).metadata();
    expect(Math.min(meta.width!, meta.height!)).toBeGreaterThanOrEqual(PRINT_SPECS.tote.minShortSidePx);
    expect(meta.density).toBe(150);
    expect(meta.hasAlpha).toBe(true);
    const corner = await sharp(built.printPng!).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect(corner[3]).toBe(0); // background stays transparent
    expect(checkResolution({ productType: "tote", width: meta.width!, height: meta.height! }).ok).toBe(true);
  });

  it("does not upscale more than 2×, so tiny art still fails the tote resolution check", async () => {
    const built = await productSpec("tote").build({ cleanedPng: await cutout(300, 300) }, { image: fakeImage, trace: { stage: "mockup" } });
    const meta = await sharp(built.printPng!).metadata();
    expect(meta.width).toBe(600);
    expect(checkResolution({ productType: "tote", width: meta.width!, height: meta.height! }).ok).toBe(false);
  });
});
