/**
 * Bounded image payloads for model requests (T150). A 4096 px phone crop inlined as a PNG data URL
 * was ~43 MB and the Meta API refused to store it (413). Every inlined picture goes through
 * `fitImage`: downscaled to the preset's long side, JPEG unless transparency matters, and shrunk
 * further until the base64 payload fits `maxBytes` (never more than MAX_INLINE_BYTES).
 */
import sharp from "sharp";

export type InlinePreset = {
  /** Long side cap in pixels (never enlarged). */
  maxSide: number;
  /** "jpeg": always JPEG on white. "auto": PNG when the source has transparent pixels, JPEG otherwise. */
  format: "jpeg" | "auto";
  /** JPEG quality, 1–100. */
  quality: number;
  /** Cap on the base64 payload size in bytes. */
  maxBytes: number;
};

/** Hard ceiling for one inlined picture (base64 bytes). */
export const MAX_INLINE_BYTES = 6_000_000;
/** Describe and other vision prompts: the model only needs to see the picture. */
export const VISION_INLINE: InlinePreset = { maxSide: 1536, format: "jpeg", quality: 90, maxBytes: 2_000_000 };
/** Muse Image edit()/compose(): the picture content matters, alpha kept where present. */
export const IMAGE_INLINE: InlinePreset = { maxSide: 2048, format: "auto", quality: 90, maxBytes: MAX_INLINE_BYTES };

const MIN_SIDE = 256;

export type FittedImage = { data: Buffer; mime: "image/jpeg" | "image/png"; width: number; height: number; base64Bytes: number };

const base64Length = (n: number) => Math.ceil(n / 3) * 4;

export async function fitImage(input: Buffer, preset: InlinePreset): Promise<FittedImage> {
  const maxBytes = Math.min(preset.maxBytes, MAX_INLINE_BYTES);
  const meta = await sharp(input).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const w = (swap ? meta.height : meta.width) ?? 1, h = (swap ? meta.width : meta.height) ?? 1;
  const transparent = preset.format === "auto" && Boolean(meta.hasAlpha) && !(await sharp(input).stats()).isOpaque;
  let side = Math.min(preset.maxSide, Math.max(w, h));
  // Already a bounded, upright JPEG (e.g. `describeRef` output): sent as is, not re-encoded.
  if (meta.format === "jpeg" && (meta.orientation ?? 1) === 1 && Math.max(w, h) <= preset.maxSide && base64Length(input.length) <= maxBytes) {
    return { data: input, mime: "image/jpeg", width: w, height: h, base64Bytes: base64Length(input.length) };
  }
  for (;;) {
    const pipeline = sharp(input).rotate().resize({ width: side, height: side, fit: "inside", withoutEnlargement: true });
    const { data, info } = transparent
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
      : await pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: preset.quality }).toBuffer({ resolveWithObject: true });
    const base64Bytes = base64Length(data.length);
    if (base64Bytes <= maxBytes || side <= MIN_SIDE) {
      return { data, mime: transparent ? "image/png" : "image/jpeg", width: info.width, height: info.height, base64Bytes };
    }
    side = Math.max(MIN_SIDE, Math.floor(side * Math.min(0.9, Math.sqrt(maxBytes / base64Bytes))));
  }
}

/** A describe/vision ImageRef of `image` at the VISION_INLINE bound (JPEG on white). */
export async function describeRef(image: Buffer): Promise<{ base64: string; mime: string }> {
  const fitted = await fitImage(image, VISION_INLINE);
  return { base64: fitted.data.toString("base64"), mime: fitted.mime };
}
