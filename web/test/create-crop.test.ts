import { afterEach, describe, expect, it, vi } from "vitest";
import { CROP_MAX_SIDE, CROP_QUALITY, CropError, cropPlan, cropToFrame, imageSizeOf } from "@/components/create/crop";
import { clearPhotos, getPhoto, hasPhoto, putPhoto } from "@/components/create/localPhoto";

describe("cropPlan (round 4 ruling 1: the frame is cropped on the device)", () => {
  const photo = { w: 4000, h: 3000 };

  it("the frame's own pixels, drawn 1:1 when it is small enough", () => {
    expect(cropPlan([100, 200, 1100, 900], photo)).toEqual({ sx: 100, sy: 200, sw: 1000, sh: 700, dw: 1000, dh: 700 });
    expect(cropPlan([0, 0, 4000, 3000], photo)).toEqual({ sx: 0, sy: 0, sw: 4000, sh: 3000, dw: 4000, dh: 3000 });
  });

  it("the longest side is capped at 4096 (scaled down, never up), the aspect kept", () => {
    const big = { w: 8000, h: 6000 };
    expect(cropPlan([0, 0, 8000, 6000], big)).toEqual({ sx: 0, sy: 0, sw: 8000, sh: 6000, dw: 4096, dh: 3072 });
    expect(cropPlan([0, 0, 6000, 8000], { w: 6000, h: 8000 })).toMatchObject({ dw: 3072, dh: 4096 });
    expect(cropPlan([0, 0, 10, 10], photo, 100)).toMatchObject({ dw: 10, dh: 10 });
    expect(CROP_MAX_SIDE).toBe(4096);
    expect(CROP_QUALITY).toBe(0.92);
  });

  it("corners in any order, fractions rounded, clamped to the photo, never empty", () => {
    expect(cropPlan([1100.4, 900.6, 100.2, 199.5], photo)).toEqual({ sx: 100, sy: 200, sw: 1000, sh: 701, dw: 1000, dh: 701 });
    expect(cropPlan([-50, -20, 5000, 4000], photo)).toMatchObject({ sx: 0, sy: 0, sw: 4000, sh: 3000 });
    expect(cropPlan([10, 10, 10, 10], photo)).toMatchObject({ sx: 10, sy: 10, sw: 1, sh: 1, dw: 1, dh: 1 });
    expect(cropPlan([4000, 3000, 4000, 3000], photo)).toMatchObject({ sx: 3999, sy: 2999, sw: 1, sh: 1 });
  });
});

describe("cropToFrame / imageSizeOf (the canvas path, guarded)", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("without createImageBitmap (or an undecodable picture) it throws CropError and never returns the whole file", async () => {
    vi.stubGlobal("createImageBitmap", undefined);
    await expect(cropToFrame(new Blob(["x"]), [0, 0, 1, 1])).rejects.toBeInstanceOf(CropError);
    await expect(imageSizeOf(new Blob(["x"]))).rejects.toBeInstanceOf(CropError);
    vi.stubGlobal("createImageBitmap", async () => { throw new Error("decode"); });
    await expect(cropToFrame(new Blob(["x"]), [0, 0, 1, 1])).rejects.toBeInstanceOf(CropError);
  });

  it("opens the picture with its EXIF orientation applied, draws the frame onto a canvas of the planned size and encodes a JPEG at 0.92", async () => {
    const bitmapCalls: unknown[] = [];
    const bmp = { width: 8000, height: 6000, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", async (...args: unknown[]) => { bitmapCalls.push(args[1]); return bmp; });
    const drawn: unknown[] = [];
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ fillStyle: "", fillRect: vi.fn(), drawImage: (...a: unknown[]) => drawn.push(a.slice(1)) }),
      toBlob: (cb: (b: Blob | null) => void, type: string, q: number) => cb(new Blob([`${type} ${q}`], { type })),
    };
    vi.stubGlobal("document", { createElement: (tag: string) => (tag === "canvas" ? canvas : null) });
    const out = await cropToFrame(new Blob(["x"]), [0, 0, 8000, 4000]);
    expect(bitmapCalls).toEqual([{ imageOrientation: "from-image" }]);
    expect(drawn).toEqual([[0, 0, 8000, 4000, 0, 0, 4096, 2048]]);
    expect([canvas.width, canvas.height]).toEqual([4096, 2048]);
    expect(out.size).toEqual({ w: 4096, h: 2048 });
    expect(out.blob.type).toBe("image/jpeg");
    expect(await out.blob.text()).toBe("image/jpeg 0.92");
    expect(bmp.close).toHaveBeenCalled();
    expect(await imageSizeOf(new Blob(["x"]))).toEqual({ w: 8000, h: 6000 });
  });

  it("a canvas that cannot encode throws CropError", async () => {
    vi.stubGlobal("createImageBitmap", async () => ({ width: 10, height: 10, close: () => {} }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ fillRect: () => {}, drawImage: () => {} }), toBlob: (cb: (b: Blob | null) => void) => cb(null) }) });
    await expect(cropToFrame(new Blob(["x"]), [0, 0, 5, 5])).rejects.toBeInstanceOf(CropError);
  });
});

describe("the local photo map (round 4: the photo stays in memory, keyed by the draft's photo key)", () => {
  it("holds one photo per tab; a reload (a fresh map) has none", () => {
    const a = new Blob(["a"]);
    const b = new Blob(["b"]);
    putPhoto("k1", a);
    expect(getPhoto("k1")).toBe(a);
    putPhoto("k2", b);
    expect(hasPhoto("k1")).toBe(false);
    expect(getPhoto("k2")).toBe(b);
    expect(getPhoto(undefined)).toBeNull();
    clearPhotos();
    expect(hasPhoto("k2")).toBe(false);
  });
});
