/** Client-side calls to /api/v1 through the same-origin forwarder (/create/bff). */
export type ProductType = "sticker" | "tote";
export type Split = { creator_bps: number; org_bps: number; production_bps: number };
export type StoryDraft = { headline: string; bio_short: string; story_text: string; provider: "ollama" | "meta-fallback"; mentionDisability: boolean; createdAt: string };
export type Creator = {
  id: string; slug: string; displayName: string; studioName: string | null; avatarUrl: string | null;
  bioShort: string | null; storyText?: string | null; storyVideoUrl: string | null; mentionDisability: boolean; split: Split;
  accessPrefs?: { speakDescriptions?: boolean } | null;
  /** Story drafted from the video transcript (Glimmer stage); null until a captioned video exists. */
  storyDraft?: StoryDraft | null;
};
export type ShapeResult = { prompt: string; style_notes: string; clarifying_question: string | null; spoken_confirmation: string };
export type Artwork = {
  id: string; creatorId: string; source: "text2image" | "canvas" | "photo"; transcript: string | null; shapedPrompt: string | null;
  originalUrl: string | null; cleanedUrl: string | null; altText: string | null; spokenDescription: string | null;
  differencesFromPrompt: string | null; parentArtworkId: string | null; status: string;
};
export type ArtworkVariant = Artwork & { previewUrl: string | null };
export type Candidate = { id: string; bbox: [number, number, number, number]; score: number; thumbUrl: string };
/** `GET /artworks/{id}`: `originalUrl` is presigned for 10 minutes (fetch directly, do not store). */
export type ArtworkDetail = { artwork: Artwork; candidates: Candidate[]; imageSize: { w: number; h: number } | null; originalUrl: string | null };
/** `POST /artworks/{id}/cleanup`: the saved cut plus products that could not follow it. */
export type CleanupResult = Artwork & { details?: { failedProductIds: string[]; unpublishedProductIds: string[] } };
export type Product = { id: string; artworkId: string; creatorId: string; type: ProductType; mockupUrl: string | null; printPngUrl: string | null; printSvgUrl: string | null; priceCents: number; status: string };
export type ListingDraft = { title: string; description: string; tags: string[]; price_cents: number; print_ok: boolean; notes: string };
export type AgentStep = { step: number; tool?: string; args?: unknown; result?: unknown; text?: string };

export class ApiError extends Error {
  /** Extra fields of the API's error object, e.g. `{ artworkId }` on `422 no_drawing_found`. */
  constructor(public status: number, public code: string, message: string, public details: Record<string, unknown> = {}) { super(message); }
  /** The artwork the failed call made or worked on, when the API names one. */
  get artworkId(): string | null {
    return typeof this.details.artworkId === "string" ? this.details.artworkId : null;
  }
}

const BASE = "/create/bff";

export async function api<T>(path: string, init: { method?: string; json?: unknown; body?: BodyInit; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  let body = init.body;
  if (init.json !== undefined) { headers["content-type"] = "application/json"; body = JSON.stringify(init.json); }
  const res = await fetch(`${BASE}/${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body, signal: init.signal, credentials: "same-origin" });
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.replace(new URL(`/create/code?next=${encodeURIComponent(window.location.pathname + window.location.search)}`, window.location.origin).href);
    throw new ApiError(401, "unauthorized", "Sign in again.");
  }
  if (!res.ok) {
    let code = "error", message = res.statusText, details: Record<string, unknown> = {};
    try {
      const e = (await res.json()) as { error?: { code?: string; message?: string } & Record<string, unknown> };
      const { code: c, message: msg, ...rest } = e.error ?? {};
      code = c ?? code; message = msg ?? message; details = rest;
    } catch { /* not json */ }
    throw new ApiError(res.status, code, message, details);
  }
  return (await res.json()) as T;
}

export const HANDLE_UPLOAD_URL = `${BASE}/uploads`;
/** Must match the store the backend's handleUpload issues tokens for (public until the private store is linked). */
export const UPLOAD_ACCESS = "public" as const;

export function extFor(file: Blob, fallback: string): string {
  const t = file.type.toLowerCase();
  if (t.includes("wav")) return "wav";
  if (t.includes("png")) return "png";
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("heic")) return "heic";
  if (t.includes("webp")) return "webp";
  if (t.includes("quicktime")) return "mov";
  if (t.includes("mp4")) return t.startsWith("audio") ? "m4a" : "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  return fallback;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Speech → text through POST /transcribe (multipart). */
export async function transcribe(blob: Blob): Promise<string> {
  const fd = new FormData();
  // The recorder already produced 16 kHz mono WAV; the API accepts WAV only.
  fd.append("file", blob, "audio.wav");
  const r = await api<{ text: string }>("transcribe", { method: "POST", body: fd });
  return (r.text ?? "").trim();
}
