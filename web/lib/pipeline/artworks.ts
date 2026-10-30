/**
 * Artwork orchestration: generate/refine (Muse Image) or photo/canvas (SAM candidates),
 * cut-out (mask → alpha), description (Spark), preview cut line. Routes and the seed call
 * these; every model call inside is traced with the artwork id.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ai } from "@/lib/ai/registry";
import type { GeneratedImage, Mask, Segment, SegmentPoint, Trace } from "@/lib/ai/types";
import { cutUpscale, ensureDpi, previewCutPath, removeBackground } from "@/lib/image/sticker";
import { pngRef } from "@/lib/image/ref";
import { alphaToMask, alphaToPng, area, bboxOf, emptyMask, finishMask, maskFromPng, maskToPng, removePiecesAt, unionMasks } from "@/lib/image/mask";
import { insertArtwork, listProductsForArtwork, updateArtwork, type ArtworkRow } from "@/lib/db/queries";
import { rebuildProductFiles } from "@/lib/pipeline/products";
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

export type ImageSize = { w: number; h: number };

/**
 * Cuts the artwork out of `original` with the union of `parts`, stores the cleaned PNG (public) and
 * the finished soft mask (private), describes it. The opaque original is upscaled first when the
 * cut would be under MIN_SHORT_SIDE (never the RGBA cut); the mask is finished (holes, gaps,
 * specks, anti-aliased edge) by `finishMask` at that size.
 */
async function finishArtwork(
  artwork: ArtworkRow, original: Buffer, parts: Mask[], opts: { prompt?: string; task: string },
): Promise<ArtworkRow> {
  const trace = traceFor(artwork.id, opts.task, "describe");
  // `parts` are at the original's size (callers guarantee it).
  const { width: W, height: H } = parts[0];
  const bbox = bboxOf(unionMasks(parts));
  if (!bbox) throw new ApiError(422, "no_drawing_found", "Nothing was selected there. Try a box around the whole thing.", { artworkId: artwork.id });
  const k = cutUpscale(bbox);
  const tw = Math.round(W * k), th = Math.round(H * k);
  const source = tw === W && th === H ? original : await sharp(original).resize(tw, th, { kernel: "lanczos3", fit: "fill" }).png().toBuffer();
  const alpha = await finishMask(parts, { width: tw, height: th });
  if (!bboxOf(alphaToMask(alpha))) {
    throw new ApiError(422, "no_drawing_found", "That selection is too small to cut out. Try a box around the whole thing.", { artworkId: artwork.id });
  }
  const cut = await removeBackground(source, alpha);
  const cleaned = cut.png;
  const [cleanedFile, maskFile, description, cutPathSvg] = await Promise.all([
    storage().putPublic(creatorPath(artwork.creatorId, "cleaned", "png"), cleaned, "image/png"),
    storage().putPrivate(creatorPath(artwork.creatorId, "masks", "png"), await alphaToPng(alpha), "image/png"),
    (await ai()).describer.describe(pngRef(await sharp(cleaned).flatten({ background: "#ffffff" }).png().toBuffer()), { prompt: opts.prompt, trace }),
    previewCutPath(cleaned),
  ]);
  return updateArtwork(artwork.id, {
    cleanedUrl: cleanedFile.url, maskUrl: maskFile.pathname, cutPathSvg,
    altText: description.alt_text, spokenDescription: description.spoken,
    differencesFromPrompt: description.differences_from_prompt || null, status: "ready", lastError: null,
  });
}

export type RecutResult = { artwork: ArtworkRow; failedProductIds: string[]; unpublishedProductIds: string[] };

/**
 * Re-cut, then rebuild every live product made from the artwork in parallel. A product whose
 * rebuild fails keeps its old files and is reported in `failedProductIds` (the cut itself stands);
 * one whose print check now fails is moved back to draft (`unpublishedProductIds`).
 */
async function recut(artwork: ArtworkRow, original: Buffer, parts: Mask[], opts: { prompt?: string; task: string }): Promise<RecutResult> {
  const row = await finishArtwork(artwork, original, parts, opts);
  const products = await listProductsForArtwork(artwork.id);
  const results = await Promise.allSettled(products.map((p) => rebuildProductFiles(p.id, opts.task)));
  const failedProductIds: string[] = [], unpublishedProductIds: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      failedProductIds.push(products[i].id);
      console.warn(`[artworks] rebuilding product ${products[i].id} failed:`, r.reason instanceof Error ? r.reason.message : r.reason);
    } else if (r.value.unpublished) unpublishedProductIds.push(products[i].id);
  });
  return { artwork: row, failedProductIds, unpublishedProductIds };
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
  return finishArtwork(artwork, img.png, [mask], { prompt: meta.shapedPrompt, task: meta.task });
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

/** A single candidate covering more than this share of the frame is not auto-selected. */
const AUTO_SELECT_MAX_COVERAGE = 0.5;
/** Longest side of the image candidate thumbnails are cut from (thumbs are 320 px). */
const THUMB_SOURCE_SIDE = 1024;

/** Photo or canvas upload → original stored privately, SAM finds every drawing or object as a candidate. */
export async function createFromImage(
  creatorId: string,
  input: { source: "photo" | "canvas"; imageUrl: string; product: "sticker" | "tote" },
  task = "T010",
): Promise<{ artwork: ArtworkRow; candidates: SamCandidate[]; imageSize: ImageSize }> {
  const uploadPath = clientUploadPath(input.imageUrl, creatorId);
  const raw = await readClientUpload(uploadPath, creatorId, 25 * 1024 * 1024);
  const png = await ensureDpi(await sharp(raw).rotate().flatten({ background: "#ffffff" }).png().toBuffer());
  const meta = await sharp(png).metadata();
  const imageSize: ImageSize = { w: meta.width ?? 0, h: meta.height ?? 0 };
  const id = randomUUID();
  trackArtwork(id);
  const original = await storage().putPrivate(creatorPath(creatorId, "originals", "png"), png, "image/png");
  // The private copy (EXIF dropped by the re-encode) is the original from now on; remove the public upload.
  await storage().delete(uploadPath).catch((err) => console.warn("[artworks] could not delete the public upload:", err instanceof Error ? err.message : err));
  let artwork = await insertArtwork({
    id, creatorId, source: input.source, originalUrl: original.pathname, shapingTrace: { product: input.product, imageSize }, status: "draft", createdByTask: task,
  });
  const segs = await (await ai()).segmenter.findCandidates(pngRef(png), { trace: traceFor(id, task, "segment"), max: MAX_CANDIDATES });
  const ts = Math.min(1, THUMB_SOURCE_SIDE / Math.max(imageSize.w, imageSize.h));
  const small = { width: Math.max(1, Math.round(imageSize.w * ts)), height: Math.max(1, Math.round(imageSize.h * ts)) };
  const smallPng = ts < 1 ? await sharp(png).resize(small.width, small.height, { fit: "fill" }).png().toBuffer() : png;
  const candidates = await Promise.all(segs.slice(0, MAX_CANDIDATES).map(async (s): Promise<SamCandidate> => {
    const cut = await removeBackground(smallPng, await finishMask(s.mask, small));
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
    throw new ApiError(422, "no_drawing_found", "We could not find a drawing or object in that picture. Try a photo with it on a plain background, filling most of the frame, in good light.", { artworkId: id });
  }
  // Auto-select a single candidate, unless it covers most of the frame (likely the paper or the table): then show the picker.
  if (candidates.length === 1 && area(segs[0].mask) <= imageSize.w * imageSize.h * AUTO_SELECT_MAX_COVERAGE) {
    artwork = await selectCandidate(artwork, candidates[0].id, task);
  }
  return { artwork, candidates, imageSize };
}

/** Pixel size of the stored original: recorded at upload (`shapingTrace.imageSize`), else read from the file. */
export async function originalSize(artwork: ArtworkRow, read: () => Promise<Buffer> = () => storage().read(artwork.originalUrl!)): Promise<ImageSize | null> {
  if (!artwork.originalUrl) return null;
  const st = artwork.shapingTrace as { imageSize?: ImageSize } | null;
  if (st?.imageSize?.w && st.imageSize.h) return st.imageSize;
  const meta = await sharp(await read()).metadata();
  return meta.width && meta.height ? { w: meta.width, h: meta.height } : null;
}

async function candidateMasks(artwork: ArtworkRow, ids: string[]): Promise<Mask[]> {
  const chosen = ids.map((cid) => artwork.candidates?.find((c) => c.id === cid));
  if (chosen.some((c) => !c)) throw new ApiError(400, "invalid_candidate", "Pick one of the shown drawings");
  return Promise.all(chosen.map(async (c) => maskFromPng(await storage().read(c!.maskUrl))));
}

export async function selectCandidate(artwork: ArtworkRow, candidateId: string, task = "T010"): Promise<ArtworkRow> {
  return (await cleanupArtwork(artwork, { candidateIds: [candidateId] }, task)).artwork;
}

export type CleanupHint = { candidateIds?: string[]; points?: SegmentPoint[]; box?: [number, number, number, number] };

/**
 * Re-cut. Candidate pieces: the chosen candidates' stored masks, minus every connected piece that
 * holds a negative point (no model call). SAM piece: with a box or a positive point, one SAM
 * object prompted with the box and all points. The cut is the union of both. Products made from
 * the artwork are rebuilt.
 */
export async function cleanupArtwork(artwork: ArtworkRow, hint: CleanupHint, task = "T080"): Promise<RecutResult> {
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  trackArtwork(artwork.id);
  const negatives = (hint.points ?? []).filter((p) => p.label === "negative");
  const askSam = Boolean(hint.box) || (hint.points ?? []).some((p) => p.label !== "negative");
  const [original, fromCandidates] = await Promise.all([
    storage().read(artwork.originalUrl),
    hint.candidateIds?.length ? candidateMasks(artwork, [...new Set(hint.candidateIds)]) : Promise.resolve([] as Mask[]),
  ]);
  const meta = await sharp(original).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const sized = await Promise.all(fromCandidates.map((m) => toSize(m, W, H)));
  const parts = sized.map((m) => removePiecesAt(m, negatives)).filter((m) => area(m) > 0);
  if (askSam) {
    const seg = await (await ai()).segmenter.segment(pngRef(original), { points: hint.points, box: hint.box }, { trace: traceFor(artwork.id, task, "segment") });
    if (seg && area(seg.mask) > 0) parts.push(await toSize(seg.mask, W, H));
  }
  if (!parts.length) {
    throw new ApiError(422, "no_drawing_found", "We could not find anything there. Try a box around the whole thing, or tap on it.", { artworkId: artwork.id });
  }
  return recut(artwork, original, parts, { prompt: artwork.shapedPrompt ?? undefined, task });
}

/** Stored masks are at the original's size; guard against older rows that are not. */
async function toSize(m: Mask, W: number, H: number): Promise<Mask> {
  if (!W || !H || (m.width === W && m.height === H)) return m;
  return maskFromPng(await sharp(await maskToPng(m)).resize(W, H, { kernel: "nearest", fit: "fill" }).png().toBuffer());
}
