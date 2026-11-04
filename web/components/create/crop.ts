/**
 * Round 4 ruling 1: the frame is applied on the device. The picked photo stays in the browser; "Use
 * this area" crops it to the frame and only the crop is uploaded. The geometry (`cropPlan`) is pure
 * and unit-tested; the canvas path (`cropToFrame`) needs a browser.
 *
 * Frame coordinates are pixels of the photo as shown, i.e. after its EXIF orientation is applied
 * (`createImageBitmap(file, { imageOrientation: "from-image" })`, the same picture the <img> shows).
 */
import type { Box, ImageSize } from "./cutout";

/** The crop's longest side is capped at this many pixels (as the photo upload was before). */
export const CROP_MAX_SIDE = 2048;
/** JPEG quality of the uploaded crop. */
export const CROP_QUALITY = 0.92;

/** Where the crop comes from in the photo (`s*`) and the size it is drawn at (`dw` × `dh`). */
export type CropPlan = { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number };

/**
 * The frame clamped to the photo and rounded to whole pixels (at least 1 × 1), and the output size:
 * the frame's own size, scaled down (never up) so the longest side is at most `maxSide`.
 */
export function cropPlan(box: readonly number[], image: ImageSize, maxSide = CROP_MAX_SIDE): CropPlan {
  const clamp = (v: number, hi: number) => Math.min(Math.max(Math.round(v), 0), hi);
  let x0 = clamp(Math.min(box[0], box[2]), image.w);
  let y0 = clamp(Math.min(box[1], box[3]), image.h);
  let x1 = clamp(Math.max(box[0], box[2]), image.w);
  let y1 = clamp(Math.max(box[1], box[3]), image.h);
  if (x1 - x0 < 1) { x1 = Math.min(image.w, x0 + 1); x0 = Math.max(0, x1 - 1); }
  if (y1 - y0 < 1) { y1 = Math.min(image.h, y0 + 1); y0 = Math.max(0, y1 - 1); }
  const sw = x1 - x0;
  const sh = y1 - y0;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  return { sx: x0, sy: y0, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
}

/** The picture could not be opened or cropped in this browser (e.g. HEIC outside Safari). */
export class CropError extends Error {
  constructor(message = "crop_failed") { super(message); this.name = "CropError"; }
}

async function bitmapOf(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap !== "function") throw new CropError("unsupported");
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new CropError("cannot_open");
  }
}

/** The photo's size as shown (orientation applied): the space Adjust the area's frame lives in. */
export async function imageSizeOf(file: Blob): Promise<ImageSize> {
  const bmp = await bitmapOf(file);
  const size = { w: bmp.width, h: bmp.height };
  bmp.close();
  if (!(size.w > 0 && size.h > 0)) throw new CropError("cannot_open");
  return size;
}

/**
 * The photo cropped to the frame, as a JPEG (EXIF dropped by the re-encode). Never falls back to the
 * whole file: the uncropped photo must not leave the device, so a failure throws `CropError`.
 */
export async function cropToFrame(file: Blob, box: Box): Promise<{ blob: Blob; size: ImageSize }> {
  const bmp = await bitmapOf(file);
  try {
    const plan = cropPlan(box, { w: bmp.width, h: bmp.height });
    const canvas = document.createElement("canvas");
    canvas.width = plan.dw;
    canvas.height = plan.dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new CropError("no_canvas");
    // A white ground under transparent pixels (PNG uploads), as the server flattens it anyway.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, plan.dw, plan.dh);
    ctx.drawImage(bmp, plan.sx, plan.sy, plan.sw, plan.sh, 0, 0, plan.dw, plan.dh);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", CROP_QUALITY));
    if (!blob) throw new CropError("encode_failed");
    return { blob, size: { w: plan.dw, h: plan.dh } };
  } finally {
    bmp.close();
  }
}
