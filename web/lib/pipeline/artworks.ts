/**
 * Artwork orchestration: generate/refine (Muse Image) or photo/canvas (SAM candidates),
 * cut-out (mask → alpha), description (Spark), preview cut line. Routes and the seed call
 * these; every model call inside is traced with the artwork id.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ai } from "@/lib/ai/registry";
import type { GeneratedImage, Mask, Segment, Trace } from "@/lib/ai/types";
import { ensureDpi, previewCutPath, removeBackground } from "@/lib/image/sticker";
import { pngRef } from "@/lib/image/ref";
import { area, emptyMask, maskFromPng, maskToPng } from "@/lib/image/mask";
import { insertArtwork, updateArtwork, type ArtworkRow } from "@/lib/db/queries";
import { clientUploadPath, creatorPath, readClientUpload, storage } from "@/lib/storage";
import type { SamCandidate } from "@/lib/db/schema";
import { trackArtwork } from "@/lib/deadline";
import { ApiError } from "@/lib/http";

const MAX_CANDIDATES = 6;

function traceFor(artworkId: string, task: string, stage = "artwork"): Trace {
  return { stage, artworkId, task };
}

/** Union of the confident segments (a generated subject can come back in parts). */
function unionMask(segs: Segment[], width: number, height: number): Mask {
  const best = segs[0]?.score ?? 0;
  const out = emptyMask(width, height);
  for (const s of segs.filter((x) => x.score >= Math.min(0.5, best))) {
    for (let i = 0; i < out.data.length; i++) out.data[i] |= s.mask.data[i];
  }
  return out;
}

/** Cuts the artwork out with `mask`, stores cleaned PNG (public) + mask (private), describes it. */
async function finishArtwork(
  artwork: ArtworkRow, original: Buffer, mask: Mask, opts: { prompt?: string; task: string },
): Promise<ArtworkRow> {
  const trace = traceFor(artwork.id, opts.task, "describe");
  const cut = await removeBackground(original, mask);
  const cleaned = await ensureDpi(cut.png);
  const [cleanedFile, maskFile, description, cutPathSvg] = await Promise.all([
    storage().putPublic(creatorPath(artwork.creatorId, "cleaned", "png"), cleaned, "image/png"),
    storage().putPrivate(creatorPath(artwork.creatorId, "masks", "png"), await maskToPng(mask), "image/png"),
    (await ai()).describer.describe(pngRef(await sharp(cleaned).flatten({ background: "#ffffff" }).png().toBuffer()), { prompt: opts.prompt, trace }),
    previewCutPath(cleaned),
  ]);
  return updateArtwork(artwork.id, {
    cleanedUrl: cleanedFile.url, maskUrl: maskFile.pathname, cutPathSvg,
    altText: description.alt_text, spokenDescription: description.spoken,
    differencesFromPrompt: description.differences_from_prompt || null, status: "ready", lastError: null,
  });
}

/** One generated (or refined) image → stored, segmented, cut out and described artwork row. */
export async function processGenerated(
  creatorId: string,
  img: GeneratedImage,
  meta: { transcript?: string | null; shapedPrompt: string; parentArtworkId?: string | null; shapingTrace?: unknown; task: string },
): Promise<ArtworkRow> {
  const id = randomUUID();
  trackArtwork(id);
  const original = await storage().putPrivate(creatorPath(creatorId, "originals", "png"), img.png, "image/png");
  const artwork = await insertArtwork({
    id, creatorId, source: "text2image", transcript: meta.transcript ?? null, shapedPrompt: meta.shapedPrompt,
    shapingTrace: meta.shapingTrace ?? null, originalUrl: original.pathname, genResponseId: img.responseId,
    parentArtworkId: meta.parentArtworkId ?? null, status: "draft", createdByTask: meta.task,
  });
  const registry = await ai();
  const phrase = await subjectPhrase(meta.shapedPrompt);
  const segs = await registry.segmenter.findAll(pngRef(img.png), phrase, { trace: traceFor(id, meta.task, "segment") });
  let mask = unionMask(segs, img.width, img.height);
  if (area(mask) < img.width * img.height * 0.01) mask = (await registry.segmenter.findAll(pngRef(img.png), "illustration", { trace: traceFor(id, meta.task, "segment") }))[0]?.mask ?? mask;
  return finishArtwork(artwork, img.png, mask, { prompt: meta.shapedPrompt, task: meta.task });
}

/** A short noun phrase for SAM from the shaped prompt ("Sticker illustration of a happy frog, ..." → "happy frog"). */
export async function subjectPhrase(prompt: string): Promise<string> {
  const first = prompt.split(/[,.;\n]/)[0] ?? prompt;
  const cleaned = first
    .replace(/^(a |an )?(sticker|tote( bag)?|print)?\s*(illustration|design|drawing|art(work)?)?\s*(of|showing)?\s*/i, "")
    .replace(/\b(single|centered|cute|sticker)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").slice(0, 6).join(" ") || "illustration";
}

/** Adds the product's print style when the prompt was not shaped for it already. */
export function promptForProduct(prompt: string, style: string): string {
  return /white background/i.test(prompt) ? prompt : `${prompt.trim().replace(/\.?$/, ".")} ${style}`;
}

export async function createFromText(
  creatorId: string,
  input: { prompt: string; transcript?: string; n: number; product: "sticker" | "tote" },
  task = "T010",
): Promise<ArtworkRow[]> {
  const registry = await ai();
  const prompt = promptForProduct(input.prompt, registry.shaper.styleFor(input.product));
  const images = await registry.image.generate(prompt, { n: input.n, trace: { stage: "generate", task } });
  return Promise.all(images.map((img) => processGenerated(creatorId, img, {
    transcript: input.transcript, shapedPrompt: prompt, shapingTrace: { product: input.product }, task,
  })));
}

export async function refineArtwork(parent: ArtworkRow, instruction: string, task = "T010"): Promise<ArtworkRow> {
  if (!parent.genResponseId) throw new Error("This artwork was not generated, so it cannot be refined");
  const registry = await ai();
  const img = await registry.image.refine(parent.genResponseId, instruction, { trace: traceFor(parent.id, task, "refine") });
  return processGenerated(parent.creatorId, img, {
    transcript: parent.transcript, shapedPrompt: `${parent.shapedPrompt ?? ""}\nChange: ${instruction}`.trim(), parentArtworkId: parent.id, task,
  });
}

/** Photo or canvas upload → original stored privately, SAM finds every drawing as a candidate. */
export async function createFromImage(
  creatorId: string,
  input: { source: "photo" | "canvas"; imageUrl: string; product: "sticker" | "tote" },
  task = "T010",
): Promise<{ artwork: ArtworkRow; candidates: SamCandidate[] }> {
  const uploadPath = clientUploadPath(input.imageUrl, creatorId);
  const raw = await readClientUpload(uploadPath, creatorId, 25 * 1024 * 1024);
  const png = await ensureDpi(await sharp(raw).rotate().flatten({ background: "#ffffff" }).png().toBuffer());
  const id = randomUUID();
  trackArtwork(id);
  const original = await storage().putPrivate(creatorPath(creatorId, "originals", "png"), png, "image/png");
  // The private copy (EXIF dropped by the re-encode) is the original from now on; remove the public upload.
  await storage().delete(uploadPath).catch((err) => console.warn("[artworks] could not delete the public upload:", err instanceof Error ? err.message : err));
  let artwork = await insertArtwork({
    id, creatorId, source: input.source, originalUrl: original.pathname, shapingTrace: { product: input.product }, status: "draft", createdByTask: task,
  });
  const segs = (await (await ai()).segmenter.findAll(pngRef(png), "drawing", { trace: traceFor(id, task, "segment") })).slice(0, MAX_CANDIDATES);
  const candidates = await Promise.all(segs.map(async (s): Promise<SamCandidate> => {
    const cut = await removeBackground(png, s.mask);
    const thumb = await sharp(cut.png).resize(320, 320, { fit: "inside" }).png().toBuffer();
    const [thumbFile, maskFile] = await Promise.all([
      storage().putPublic(creatorPath(creatorId, "thumbs", "png"), thumb, "image/png"),
      storage().putPrivate(creatorPath(creatorId, "masks", "png"), await maskToPng(s.mask), "image/png"),
    ]);
    return { id: randomUUID(), bbox: s.bbox, score: Math.round(s.score * 1000) / 1000, thumbUrl: thumbFile.url, maskUrl: maskFile.pathname };
  }));
  artwork = await updateArtwork(id, { candidates });
  if (candidates.length === 0) {
    await updateArtwork(id, { lastError: "no_drawing_found" });
    throw new ApiError(422, "no_drawing_found", "We could not find a drawing in that picture. Try a photo with the drawing on plain paper, filling most of the frame, in good light.", { artworkId: id });
  }
  if (candidates.length === 1) artwork = await selectCandidate(artwork, candidates[0].id, task);
  return { artwork, candidates };
}

export async function selectCandidate(artwork: ArtworkRow, candidateId: string, task = "T010"): Promise<ArtworkRow> {
  trackArtwork(artwork.id);
  const cand = artwork.candidates?.find((c) => c.id === candidateId);
  if (!cand || !artwork.originalUrl) throw new Error("Unknown candidate");
  const [original, maskPng] = await Promise.all([storage().read(artwork.originalUrl), storage().read(cand.maskUrl)]);
  return finishArtwork(artwork, original, await maskFromPng(maskPng), { task });
}

/** Re-cut with a hint (tap points, a box, or a phrase). */
export async function cleanupArtwork(
  artwork: ArtworkRow,
  hint: { points?: { x: number; y: number }[]; box?: [number, number, number, number]; phrase?: string },
  task = "T010",
): Promise<ArtworkRow> {
  if (!artwork.originalUrl) throw new Error("Artwork has no original image");
  trackArtwork(artwork.id);
  const original = await storage().read(artwork.originalUrl);
  const seg = await (await ai()).segmenter.segment(pngRef(original), hint, { trace: traceFor(artwork.id, task, "segment") });
  if (!seg) throw new Error("Could not find the drawing there");
  return finishArtwork(artwork, original, seg.mask, { prompt: artwork.shapedPrompt ?? undefined, task });
}
