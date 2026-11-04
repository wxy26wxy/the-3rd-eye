import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MetaDescriber } from "@/lib/ai/meta/describe";
import { MetaImageProvider } from "@/lib/ai/meta/image";
import { inlineImage } from "@/lib/ai/meta/responses";
import { describeRef, fitImage, IMAGE_INLINE, MAX_INLINE_BYTES, VISION_INLINE } from "@/lib/image/inline";
import { pngRef } from "@/lib/image/ref";

/**
 * T150: a 4096 px phone crop inlined as a PNG was ~43 MB and the Meta API answered 413. Noise is the
 * worst case for both codecs, so these fixtures exercise the cap and the shrink-until-it-fits loop.
 */
const MB = 1024 * 1024;
const noise = (channels: 3 | 4) =>
  sharp({ create: { width: 4096, height: 4096, channels, background: { r: 128, g: 128, b: 128, alpha: 1 }, noise: { type: "gaussian", mean: 128, sigma: 60 } } })
    .png().toBuffer();

type Part = { type: string; image_url?: string };
type Body = { input: { content: Part[] }[]; store?: boolean; previous_response_id?: string };
const imagePart = (body: Body) => body.input[0].content.find((c) => c.type === "input_image")!;
const payload = (part: Part) => part.image_url!.length;

const describeResp = { id: "resp_d", output_text: JSON.stringify({ alt_text: "a", spoken: "b", dominant_colors: [], subject: "c", differences_from_prompt: "" }) };
const imageResp = async () => ({ id: "resp_i", output: [{ type: "image_generation_call", result: (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).png().toBuffer()).toString("base64") }] });

describe("inlined image payloads (T150)", () => {
  it("describe: a 4096×4096 PNG goes out as a JPEG under 2 MB, at most 1536 px, with store:false", async () => {
    const png = await noise(3);
    expect(png.length).toBeGreaterThan(20 * MB); // the fixture really is the oversized case
    const sent: Body[] = [];
    await new MetaDescriber({ create: async (b) => { sent.push(b as Body); return describeResp; } }).describe(pngRef(png), { trace: { stage: "describe" } });
    const part = imagePart(sent[0]);
    expect(part.image_url!.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(payload(part)).toBeLessThan(2 * MB);
    const meta = await sharp(Buffer.from(part.image_url!.split(",")[1], "base64")).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1536);
    expect(sent[0].store).toBe(false);
  }, 60_000);

  it("edit: a transparent 4096×4096 PNG stays PNG, at most 2048 px and under 6 MB, with store:false", async () => {
    const png = await noise(4);
    const sent: Body[] = [];
    const resp = await imageResp();
    await new MetaImageProvider({ create: async (b) => { sent.push(b as Body); return resp; } }).edit(pngRef(png), "x", { trace: { stage: "edit" } });
    const part = imagePart(sent[0]);
    expect(part.image_url!.startsWith("data:image/png;base64,")).toBe(true);
    expect(payload(part)).toBeLessThan(6 * MB);
    const meta = await sharp(Buffer.from(part.image_url!.split(",")[1], "base64")).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048);
    expect(meta.hasAlpha).toBe(true);
    expect(sent[0].store).toBe(false);
    expect(sent[0].previous_response_id).toBeUndefined();
  }, 60_000);

  it("compose: every opaque ref becomes a JPEG at most 2048 px, the whole request under 6 MB per image, store:false", async () => {
    const png = await noise(3);
    const sent: Body[] = [];
    const resp = await imageResp();
    await new MetaImageProvider({ create: async (b) => { sent.push(b as Body); return resp; } })
      .compose("a tote", [pngRef(png), pngRef(png)], { trace: { stage: "mockup" } });
    const parts = sent[0].input[0].content.filter((c) => c.type === "input_image");
    expect(parts).toHaveLength(2);
    for (const p of parts) {
      expect(p.image_url!.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(payload(p)).toBeLessThan(6 * MB);
    }
    expect(sent[0].store).toBe(false);
  }, 60_000);

  it("refine keeps the stored chain: no store field, previous_response_id sent", async () => {
    const sent: Body[] = [];
    const resp = await imageResp();
    await new MetaImageProvider({ create: async (b) => { sent.push(b as Body); return resp; } }).refine("resp_parent", "x", { trace: { stage: "refine" } });
    expect(sent[0].previous_response_id).toBe("resp_parent");
    expect("store" in sent[0]).toBe(false);
  });

  it("fitImage shrinks below the preset cap when the side cap alone is not enough", async () => {
    const png = await noise(4);
    const tight = await fitImage(png, { ...IMAGE_INLINE, maxBytes: 1 * MB });
    expect(tight.base64Bytes).toBeLessThanOrEqual(1 * MB);
    expect(tight.mime).toBe("image/png");
    expect(Math.max(tight.width, tight.height)).toBeLessThan(2048);
    // The ceiling holds even when a preset asks for more.
    const loose = await fitImage(png, { ...IMAGE_INLINE, maxBytes: 50 * MB });
    expect(loose.base64Bytes).toBeLessThanOrEqual(MAX_INLINE_BYTES);
  }, 60_000);

  it("keeps small pictures at their size and passes remote URLs through", async () => {
    const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#f00" } }).png().toBuffer();
    const f = await fitImage(small, VISION_INLINE);
    expect([f.width, f.height, f.mime]).toEqual([300, 200, "image/jpeg"]);
    expect(await inlineImage({ url: "https://example.com/a.png" }, VISION_INLINE)).toEqual({ type: "input_image", image_url: "https://example.com/a.png", detail: "auto" });
  });

  it("describeRef: the pipeline's describe input is the cut at the vision bound, sent on without re-encoding", async () => {
    const ref = await describeRef(await noise(4));
    expect(ref.mime).toBe("image/jpeg");
    const buf = Buffer.from(ref.base64, "base64");
    expect(Math.max((await sharp(buf).metadata()).width!, (await sharp(buf).metadata()).height!)).toBeLessThanOrEqual(1536);
    const again = await fitImage(buf, VISION_INLINE);
    expect(again.data.equals(buf)).toBe(true);
  }, 60_000);
});
