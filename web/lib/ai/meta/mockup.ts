/**
 * Product mockups with Muse Image compose: the artwork plus (for totes) a tote reference
 * photo from public/ref/tote.jpg, generated procedurally when no photo exists. If the model
 * call fails, a local composite keeps the flow working.
 */
import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { ImageProvider, Trace } from "../types";
import { pngRef } from "@/lib/image/ref";
import { toteReference } from "@/lib/image/placeholder";

async function toteRef(): Promise<Buffer> {
  try {
    return await readFile(join(process.cwd(), "public/ref/tote.jpg"));
  } catch {
    return toteReference();
  }
}

/** Offline mockup: art centered on the tote, or the sticker on a light desk-like background. */
export async function localMockup(kind: "sticker" | "tote", artPng: Buffer): Promise<Buffer> {
  const base = kind === "tote"
    ? await sharp(await toteRef()).resize(1024, 1024).png().toBuffer()
    : await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 236, g: 230, b: 218, alpha: 1 } } }).png().toBuffer();
  const size = kind === "tote" ? 420 : 640;
  const art = await sharp(artPng).resize(size, size, { fit: "inside" }).png().toBuffer();
  const meta = await sharp(art).metadata();
  const left = Math.round((1024 - (meta.width ?? size)) / 2);
  const top = kind === "tote" ? Math.round(560 - (meta.height ?? size) / 2) : Math.round((1024 - (meta.height ?? size)) / 2);
  return sharp(base).composite([{ input: art, left, top }]).png().toBuffer();
}

export async function makeMockup(
  image: ImageProvider,
  opts: { kind: "sticker" | "tote"; prompt: string; artPng: Buffer; trace: Trace },
): Promise<Buffer> {
  const flatArt = await sharp(opts.artPng).flatten({ background: "#ffffff" }).png().toBuffer();
  const refs = [pngRef(flatArt)];
  if (opts.kind === "tote") refs.push({ base64: (await toteRef()).toString("base64"), mime: "image/jpeg" });
  try {
    return (await image.compose(opts.prompt, refs, { trace: { ...opts.trace, stage: "mockup" } })).png;
  } catch (err) {
    console.warn("[mockup] compose failed, using local composite:", err instanceof Error ? err.message : err);
    return localMockup(opts.kind, opts.artPng);
  }
}
