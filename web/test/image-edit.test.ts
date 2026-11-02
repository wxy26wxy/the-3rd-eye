import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KEEP_GUARD, MetaImageProvider } from "@/lib/ai/meta/image";
import { fixtureRegistry } from "@/lib/ai/fixtures";
import { pngRef } from "@/lib/image/ref";
import sharp from "sharp";

/**
 * Live Muse Image edit recorded 2026-11-01 by `pnpm probe edit` (scripts/probe_meta.ts): the generate
 * probe PNG as input_image + "Make the circle blue." + the guard. The image result is re-encoded at
 * 128 px; the rest of the response is as returned (reasoning, empty message, image_generation_call).
 */
const fx = JSON.parse(readFileSync(join(__dirname, "fixtures/edit/probe-edit.json"), "utf8")) as {
  status: number; request: { input: { content: { type: string; text?: string }[] }[] }; response: unknown;
};

describe("Muse Image edit (T111)", () => {
  it("replays the recorded live response into a PNG with its response id", async () => {
    const sent: Record<string, unknown>[] = [];
    const provider = new MetaImageProvider({ create: async (body) => { sent.push(body); return fx.response; } });
    const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#fff" } }).png().toBuffer();
    const img = await provider.edit(pngRef(input), "  Make the circle blue. ", { trace: { stage: "edit" } });
    expect(fx.status).toBe(200);
    expect(img.responseId).toMatch(/^resp_/);
    expect([img.width, img.height]).toEqual([128, 128]);
    expect((await sharp(img.png).metadata()).format).toBe("png");
    // Same shape as compose(): one user message with input_text then input_image, the image tool.
    const body = sent[0] as { model: string; input: { role: string; content: { type: string; text?: string; image_url?: string }[] }[]; tools: unknown[] };
    expect(body.model).toBe("muse-image-1.0");
    expect(body.input[0].role).toBe("user");
    expect(body.input[0].content.map((c) => c.type)).toEqual(["input_text", "input_image"]);
    expect(body.input[0].content[0].text).toBe(`Make the circle blue.\n${KEEP_GUARD}`);
    expect(body.input[0].content[1].image_url?.startsWith("data:image/png;base64,")).toBe(true);
    expect(body.tools).toEqual([{ type: "image_generation", output_format: "png", size: "1024x1024" }]);
    // The recorded request had the same content order and guard.
    expect(fx.request.input[0].content.map((c) => c.type)).toEqual(["input_text", "input_image"]);
    expect(fx.request.input[0].content[0].text).toContain(KEEP_GUARD);
  });

  it("fails clearly when the response has no image", async () => {
    const provider = new MetaImageProvider({ create: async () => ({ id: "resp_x", output: [] }) });
    await expect(provider.edit({ base64: "AA==" }, "x", { trace: { stage: "edit" } })).rejects.toThrow(/no image_generation_call/);
  });

  it("offline registry: edit returns a 1024 px picture that differs from the input", async () => {
    const input = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#fff" } }).png().toBuffer();
    const out = await fixtureRegistry().image.edit(pngRef(input), "add a hat", { trace: { stage: "edit" } });
    expect([out.width, out.height]).toEqual([1024, 1024]);
    expect(out.responseId).toMatch(/^fixture_edit_/);
    const stats = await sharp(out.png).stats();
    expect(stats.channels[0].min).toBeLessThan(255); // the procedural mark is there
  });
});
