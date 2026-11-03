/**
 * Artwork orchestration: generate/refine (Muse Image) or photo/canvas (SAM candidates),
 * cut-out (mask → alpha), description (Spark), preview cut line. Routes and the seed call
 * these; every model call inside is traced with the artwork id.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ai } from "@/lib/ai/registry";
import type { Description, GeneratedImage, Mask, Segment, SegmentPoint, Trace } from "@/lib/ai/types";
import { cutUpscale, ensureDpi, previewCutPath, removeBackground } from "@/lib/image/sticker";
import { pngRef } from "@/lib/image/ref";
import { alphaToMask, alphaToPng, area, bboxOf, clampBox, clipToBox, emptyMask, finishMask, maskFromPng, maskToPng, placeMask, removePiecesAt, unionMasks, type BBox } from "@/lib/image/mask";
import { insertArtwork, listProductsForArtwork, updateArtwork, type ArtworkRow } from "@/lib/db/queries";
import { rebuildProductFiles } from "@/lib/pipeline/products";
import { clientUploadPath, creatorPath, readClientUpload, storage } from "@/lib/storage";
import { isSourceUpload } from "@/lib/storage/refs";
import type { SamCandidate } from "@/lib/db/schema";
import { DeadlineError, trackArtwork } from "@/lib/deadline";
import { descriptionOf, existingChange, insertOnce } from "@/lib/pipeline/idempotency";
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
  artwork: ArtworkRow, original: Buffer, parts: Mask[], opts: { prompt?: string; task: string; clip?: BBox },
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
  if (opts.clip) clipAlpha(alpha, opts.clip, k);
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

/**
 * Clears the soft alpha outside `box` (original pixels; the alpha is the original × `k`) so the finished
 * edge cannot spill past it, and feathers the alpha over 1 original pixel (`k` alpha pixels) inside the
 * box so a cut along the frame is not a hard line (T134).
 */
export function clipAlpha(alpha: { width: number; height: number; alpha: Uint8Array }, box: BBox, k: number): void {
  const b = clampBox(box.map((v) => v * k) as BBox, alpha.width, alpha.height) ?? [0, 0, 0, 0];
  const fw = Math.max(1, Math.round(k));
  for (let y = 0; y < alpha.height; y++) {
    for (let x = 0; x < alpha.width; x++) {
      const i = y * alpha.width + x;
      if (x < b[0] || x >= b[2] || y < b[1] || y >= b[3]) { alpha.alpha[i] = 0; continue; }
      const d = Math.min(x - b[0], b[2] - 1 - x, y - b[1], b[3] - 1 - y);
      if (d < fw) alpha.alpha[i] = Math.round(alpha.alpha[i] * (d + 0.5) / fw);
    }
  }
}

export type RecutResult = { artwork: ArtworkRow; failedProductIds: string[]; unpublishedProductIds: string[] };

/**
 * Re-cut, then rebuild every live product made from the artwork in parallel. A product whose
 * rebuild fails keeps its old files and is reported in `failedProductIds` (the cut itself stands);
 * one whose print check now fails is moved back to draft (`unpublishedProductIds`).
 */
async function recut(artwork: ArtworkRow, original: Buffer, parts: Mask[], opts: { prompt?: string; task: string; clip?: BBox }): Promise<RecutResult> {
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

/**
 * Photo or canvas upload → original stored privately, SAM finds every drawing or object as a candidate.
 * With `detect: false` (T134, round 3) only the original is stored (`candidates: []`, no SAM call, never
 * 422): the creator frames the area first and `detectInBox` runs SAM inside the frame.
 */
export async function createFromImage(
  creatorId: string,
  input: { source: "photo" | "canvas"; imageUrl: string; product: "sticker" | "tote"; detect?: boolean },
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
  // The private copy (EXIF dropped by the re-encode) is the original from now on; remove the public upload,
  // but only when it is the creator's source-picture upload (never a thumb, mockup, video or other own file).
  if (isSourceUpload(uploadPath, creatorId)) {
    await storage().delete(uploadPath).catch((err) => console.warn("[artworks] could not delete the public upload:", err instanceof Error ? err.message : err));
  }
  let artwork = await insertArtwork({
    id, creatorId, source: input.source, originalUrl: original.pathname, shapingTrace: { product: input.product, imageSize }, status: "draft", createdByTask: task,
    ...(input.detect === false ? { candidates: [] } : {}),
  });
  if (input.detect === false) return { artwork, candidates: [], imageSize };
  const { segments: segs, droppedContainer } = await (await ai()).segmenter.findCandidates(pngRef(png), { trace: traceFor(id, task, "segment"), max: MAX_CANDIDATES });
  const candidates = await storeCandidates(creatorId, png, imageSize, segs);
  artwork = await updateArtwork(id, { candidates });
  if (candidates.length === 0) {
    await updateArtwork(id, { lastError: "no_drawing_found" });
    throw new ApiError(422, "no_drawing_found", "We could not find a drawing or object in that picture. Try a photo with it on a plain background, filling most of the frame, in good light.", { artworkId: id });
  }
  // Auto-select a single candidate, unless it covers most of the frame (likely the paper or the table) or a
  // surrounding result was dropped as the paper/table (the one left may be a sub-part): then show the picker.
  if (candidates.length === 1 && !droppedContainer && area(segs[0].mask) <= imageSize.w * imageSize.h * AUTO_SELECT_MAX_COVERAGE) {
    artwork = await selectCandidate(artwork, candidates[0].id, task);
  }
  return { artwork, candidates, imageSize };
}

/** Thumbnails (public) and masks (private) for SAM results on `png`, in the given order, at most MAX_CANDIDATES. */
async function storeCandidates(creatorId: string, png: Buffer, imageSize: ImageSize, segs: Segment[]): Promise<SamCandidate[]> {
  const ts = Math.min(1, THUMB_SOURCE_SIDE / Math.max(imageSize.w, imageSize.h));
  const small = { width: Math.max(1, Math.round(imageSize.w * ts)), height: Math.max(1, Math.round(imageSize.h * ts)) };
  const smallPng = ts < 1 ? await sharp(png).resize(small.width, small.height, { fit: "fill" }).png().toBuffer() : png;
  return Promise.all(segs.slice(0, MAX_CANDIDATES).map(async (s): Promise<SamCandidate> => {
    const cut = await removeBackground(smallPng, await finishMask(s.mask, small));
    const thumb = await sharp(cut.png).resize(320, 320, { fit: "inside" }).png().toBuffer();
    const [thumbFile, maskFile] = await Promise.all([
      storage().putPublic(creatorPath(creatorId, "thumbs", "png"), thumb, "image/png"),
      storage().putPrivate(creatorPath(creatorId, "masks", "png"), await maskToPng(s.mask), "image/png"),
    ]);
    return { id: randomUUID(), bbox: s.bbox, score: Math.round(s.score * 1000) / 1000, thumbUrl: thumbFile.url, maskUrl: maskFile.pathname };
  }));
}

/**
 * "Use this area" on Adjust the area (T134, round 3): SAM (both phrases) on the crop of `box` of the
 * photo row's original; the masks are placed back at the frame's offset, stored as the row's candidates
 * (largest first, replacing earlier ones), and the largest is cut out clipped to the box (no second SAM
 * call). Products made from the row are rebuilt as after a cleanup.
 */
export async function detectInBox(
  artwork: ArtworkRow, box: BBox, task = "T134",
): Promise<RecutResult & { candidates: SamCandidate[]; imageSize: ImageSize }> {
  assertPhotoRow(artwork);
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  trackArtwork(artwork.id);
  const png = await storage().read(artwork.originalUrl);
  const meta = await sharp(png).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  const imageSize: ImageSize = { w: W, h: H };
  const b = clampBox(box, W, H);
  // A failed detect leaves the row's candidates and cut as they were (a follow-up cleanup still works); only lastError is set.
  const none = async () => {
    await updateArtwork(artwork.id, { lastError: "no_drawing_found" });
    return new ApiError(422, "no_drawing_found", "We could not find a drawing or object inside the frame. Move the frame or make it bigger.", { artworkId: artwork.id });
  };
  if (!b) throw await none();
  const [x0, y0, x1, y1] = b;
  const crop = await sharp(png).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).png().toBuffer();
  // Inside a tight frame the piece may fill the crop and contain its own parts: keep both (no background or container drop).
  const { segments } = await (await ai()).segmenter.findCandidates(pngRef(crop), {
    trace: traceFor(artwork.id, task, "segment"), max: MAX_CANDIDATES, maxCoverage: 1, dropContainers: false,
  });
  const placed = segments.map((s): Segment => {
    const mask = placeMask(s.mask, W, H, x0, y0);
    return { ...s, mask, bbox: [s.bbox[0] + x0, s.bbox[1] + y0, s.bbox[2] + x0, s.bbox[3] + y0] };
  }).filter((s) => area(s.mask) > 0).sort((p, q) => area(q.mask) - area(p.mask));
  if (!placed.length) throw await none();
  const candidates = await storeCandidates(artwork.creatorId, png, imageSize, placed);
  const st = (artwork.shapingTrace as Record<string, unknown> | null) ?? {};
  const row = await updateArtwork(artwork.id, { candidates, shapingTrace: { ...st, imageSize } });
  const out = await recut(row, png, [placed[0].mask], { prompt: artwork.shapedPrompt ?? undefined, task, clip: b });
  return { ...out, candidates, imageSize };
}

/** `detect` works on the photo row only: a change result is re-cut with `cutout`, a generated row has no photo. */
export function assertPhotoRow(artwork: Pick<ArtworkRow, "id" | "source" | "changeInstruction">): void {
  if (artwork.changeInstruction || (artwork.source !== "photo" && artwork.source !== "canvas")) {
    throw new ApiError(409, "not_a_photo", "Use cutout for a changed picture", { artworkId: artwork.id });
  }
}

/** Longest side of the picture sent to Muse Image edit (its output is 1600 px square whatever the input). */
const EDIT_INPUT_SIDE = 1024;
/** White margin around the picked piece in the edit input, as a share of its longest side. */
const EDIT_MARGIN = 0.1;

/**
 * The picture "Change it" edits: the row's cut-out flattened on white (the picked piece), or, for a
 * change result that has no cut-out yet, its stored edited picture. Squared on white with a margin,
 * at most EDIT_INPUT_SIDE.
 */
export async function changeInput(artwork: ArtworkRow, read: (pathname: string) => Promise<Buffer> = (p) => storage().read(p)): Promise<Buffer> {
  const ref = artwork.cleanedUrl ?? (artwork.changeInstruction ? artwork.originalUrl : null);
  if (!ref) throw new ApiError(409, "artwork_not_ready", "Pick a piece first", { artworkId: artwork.id });
  const flat = await sharp(await read(ref)).flatten({ background: "#ffffff" }).png().toBuffer();
  const meta = await sharp(flat).metadata();
  const side = Math.max(meta.width ?? 1, meta.height ?? 1);
  const canvas = Math.round(side * (1 + 2 * EDIT_MARGIN));
  const k = Math.min(1, EDIT_INPUT_SIDE / canvas);
  const inner = Math.max(1, Math.round(side * k));
  const out = Math.max(1, Math.round(canvas * k));
  const piece = await sharp(flat).resize(inner, inner, { fit: "contain", background: "#ffffff" }).png().toBuffer();
  const pad = Math.floor((out - inner) / 2);
  const squared = await sharp({ create: { width: out, height: out, channels: 3, background: "#ffffff" } })
    .composite([{ input: piece, top: pad, left: pad }]).png().toBuffer();
  return sharp(squared).flatten({ background: "#ffffff" }).png().toBuffer(); // opaque: composite adds an alpha channel
}

export type ChangeResult = { artwork: ArtworkRow; description: Description; repeated?: boolean };

/**
 * "Change it" (T111): Muse Image edits the picked piece (or the previous change result) as the
 * instruction says; the result is a new child row (source photo, parentArtworkId, changeInstruction,
 * transcript, genResponseId) whose edited picture is stored privately (originalUrl, for the cutout)
 * and publicly (shapingTrace.previewUrl), then Muse Spark describes it against the instruction.
 */
export async function changeArtwork(
  parent: ArtworkRow, input: { instruction: string; transcript?: string | null; clientRequestId?: string | null }, task = "T111",
): Promise<ChangeResult> {
  const instruction = input.instruction.trim();
  const source = await changeInput(parent);
  const registry = await ai();
  const id = randomUUID();
  // A refused or failed edit (no image, model error) is the "Error" state of Change it, not a 500; no child row exists yet.
  const img = await registry.image.edit(pngRef(source), instruction, { trace: traceFor(id, task, "edit") }).catch((err: unknown) => {
    if (err instanceof ApiError || err instanceof DeadlineError || (err instanceof Error && err.name === "AbortError")) throw err;
    console.warn("[artworks] edit failed:", err instanceof Error ? err.message : err);
    throw new ApiError(502, "edit_failed", "We could not change it this time. Try different words.");
  });
  const png = await sharp(img.png).flatten({ background: "#ffffff" }).png().toBuffer();
  const meta = await sharp(png).metadata();
  const imageSize: ImageSize = { w: meta.width ?? img.width, h: meta.height ?? img.height };
  const [original, preview] = await Promise.all([
    storage().putPrivate(creatorPath(parent.creatorId, "originals", "png"), png, "image/png"),
    storage().putPublic(creatorPath(parent.creatorId, "previews", "png"), png, "image/png"),
  ]);
  const product = (parent.shapingTrace as { product?: string } | null)?.product ?? null;
  const key = input.clientRequestId ?? null;
  // A concurrent call with the same clientRequestId may have inserted first (T134): return its row.
  const inserted = await insertOnce(key, () => insertArtwork({
    id, creatorId: parent.creatorId, source: "photo", transcript: input.transcript?.trim() || null, changeInstruction: instruction,
    shapingTrace: { product, imageSize, previewUrl: preview.url, changedFrom: parent.id }, originalUrl: original.pathname,
    genResponseId: img.responseId || null, parentArtworkId: parent.id, status: "draft", createdByTask: task, clientRequestId: key,
  }), () => existingChange(parent.creatorId, key!, parent.id));
  if (inserted.repeated) return { artwork: inserted.row, description: descriptionOf(inserted.row), repeated: true };
  trackArtwork(id);
  const description = await registry.describer.describe(pngRef(png), { prompt: instruction, trace: traceFor(id, task, "describe") });
  const artwork = await updateArtwork(id, {
    altText: description.alt_text, spokenDescription: description.spoken, differencesFromPrompt: description.differences_from_prompt || null,
  });
  return { artwork, description };
}

/**
 * `cutout` only re-cuts a change result: on any other row it would replace the picked cut-out and
 * rebuild (or unpublish) its products. "Looks good as is" on the picked piece needs no call.
 */
export function assertChangeResult(artwork: Pick<ArtworkRow, "id" | "changeInstruction">): void {
  if (!artwork.changeInstruction) {
    throw new ApiError(409, "not_a_change", "Only a changed picture needs a new cutout", { artworkId: artwork.id });
  }
}

/**
 * Cutout of a row's stored picture (T111, after "Change it"): SAM finds every piece, they are stored
 * as the row's candidates largest first (replacing earlier ones), and the largest is cut out like a
 * picked candidate. "Your cutout" then adjusts it with cleanupArtwork.
 */
export async function cutoutArtwork(artwork: ArtworkRow, task = "T111"): Promise<{ artwork: ArtworkRow; candidates: SamCandidate[]; imageSize: ImageSize }> {
  assertChangeResult(artwork);
  if (!artwork.originalUrl) throw new ApiError(400, "no_original", "This artwork has no original image");
  trackArtwork(artwork.id);
  const png = await storage().read(artwork.originalUrl);
  const meta = await sharp(png).metadata();
  const imageSize: ImageSize = { w: meta.width ?? 0, h: meta.height ?? 0 };
  const { segments } = await (await ai()).segmenter.findCandidates(pngRef(png), { trace: traceFor(artwork.id, task, "segment"), max: MAX_CANDIDATES });
  const largestFirst = [...segments].sort((a, b) => area(b.mask) - area(a.mask));
  const candidates = await storeCandidates(artwork.creatorId, png, imageSize, largestFirst);
  const st = (artwork.shapingTrace as Record<string, unknown> | null) ?? {};
  let row = await updateArtwork(artwork.id, { candidates, shapingTrace: { ...st, imageSize } });
  if (candidates.length === 0) {
    await updateArtwork(artwork.id, { lastError: "no_drawing_found" });
    throw new ApiError(422, "no_drawing_found", "We could not find the art in the changed picture. Try another change, or go back to your original.", { artworkId: artwork.id });
  }
  row = (await cleanupArtwork(row, { candidateIds: [candidates[0].id] }, task)).artwork;
  return { artwork: row, candidates, imageSize };
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

export type CleanupHint = { candidateIds?: string[]; points?: SegmentPoint[]; box?: [number, number, number, number]; clipToBox?: boolean };

/**
 * Re-cut. Candidate pieces: the chosen candidates' stored masks, minus every connected piece that
 * holds a negative point (no model call). SAM piece: with a box or a positive point, one SAM
 * object prompted with the box and all points. The cut is the union of both; with `clipToBox` (and a
 * box) it is then cut to the box, so a frame smaller than the piece trims it (T126, "Adjust the
 * area"). Products made from the artwork are rebuilt. A change result is re-cut the same way (T129):
 * its original is the edited picture and its candidates are the ones `cutoutArtwork` stored.
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
  // Clipping each part equals clipping their union, and keeps finishMask's per-part speck rule.
  const clip = hint.clipToBox && hint.box ? hint.box : undefined;
  const kept = clip ? parts.map((m) => clipToBox(m, clip)).filter((m) => area(m) > 0) : parts;
  if (!kept.length) {
    throw new ApiError(422, "no_drawing_found", "We could not find anything there. Try a box around the whole thing, or tap on it.", { artworkId: artwork.id });
  }
  return recut(artwork, original, kept, { prompt: artwork.shapedPrompt ?? artwork.changeInstruction ?? undefined, task, clip });
}

/** Stored masks are at the original's size; guard against older rows that are not (linear + threshold, T134). */
async function toSize(m: Mask, W: number, H: number): Promise<Mask> {
  if (!W || !H || (m.width === W && m.height === H)) return m;
  return maskFromPng(await sharp(await maskToPng(m)).resize(W, H, { kernel: "linear", fit: "fill" }).png().toBuffer());
}
