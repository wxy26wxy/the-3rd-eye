/** Loading ImageRefs to bytes and back. */
import type { ImageRef } from "@/lib/ai/types";

export async function loadImageRef(ref: ImageRef): Promise<Buffer> {
  if (ref.base64) return Buffer.from(ref.base64, "base64");
  if (!ref.url) throw new Error("ImageRef needs url or base64");
  if (ref.url.startsWith("data:")) return Buffer.from(ref.url.slice(ref.url.indexOf(",") + 1), "base64");
  const res = await fetch(ref.url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export function pngRef(png: Buffer): ImageRef {
  return { base64: png.toString("base64"), mime: "image/png" };
}
