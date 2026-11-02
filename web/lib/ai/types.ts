/**
 * Provider-agnostic AI interfaces. Concrete implementations live in lib/ai/meta/*
 * and are wired in lib/ai/registry.ts. Nothing outside lib/ai imports a concrete provider.
 */
export type ImageRef = { url?: string; base64?: string; mime?: string };
export type Trace = { stage: string; artworkId?: string; listingId?: string; jobId?: string; task?: string };

export type TranscribeResult = { text: string; language?: string; segments?: { start: number; end: number; text: string }[] };
export interface TranscribeProvider {
  transcribe(audio: Blob | Buffer, opts: { filename: string; language?: string; trace: Trace }): Promise<TranscribeResult>;
}

export type ShapedPrompt = { prompt: string; style_notes: string; clarifying_question: string | null; spoken_confirmation: string };
export interface PromptShaper {
  /** The product's print style appended to prompts that were not shaped for it. */
  styleFor(product: "sticker" | "tote"): string;
  shape(transcript: string, opts: { answers?: string[]; product: "sticker" | "tote"; trace: Trace }): Promise<ShapedPrompt>;
}

export type GeneratedImage = { png: Buffer; responseId: string; width: number; height: number };
export interface ImageProvider {
  generate(prompt: string, opts: { n: number; trace: Trace }): Promise<GeneratedImage[]>;
  refine(responseId: string, instruction: string, opts: { trace: Trace }): Promise<GeneratedImage>;
  compose(prompt: string, refs: ImageRef[], opts: { trace: Trace }): Promise<GeneratedImage>;
  /** Changes `image` as `instruction` says (Muse Image with the picture as input_image); trace stage "edit". */
  edit(image: ImageRef, instruction: string, opts: { trace: Trace }): Promise<GeneratedImage>;
}

export type Mask = { width: number; height: number; data: Uint8Array /* 0/1 per pixel */ };
export type Segment = { mask: Mask; svgPath: string; bbox: [number, number, number, number]; score: number };
/** A tap on the image: positive = part of the object, negative = not part of it (default positive). */
export type SegmentPoint = { x: number; y: number; label?: "positive" | "negative" };
/** Pixel coordinates of the image passed in; `box` is half-open [x0, y0, x1, y1). */
export type SegmentHint = { phrase?: string; points?: SegmentPoint[]; box?: [number, number, number, number] };
/** `droppedContainer`: a paper/table-like result around another one was removed, so the caller should let the creator choose. */
export type CandidateSearch = { segments: Segment[]; droppedContainer: boolean };
export interface Segmenter {
  findAll(image: ImageRef, phrase: string, opts: { trace: Trace }): Promise<Segment[]>;
  /**
   * Every drawing or physical object in a photo: several phrases, overlapping results merged,
   * frame-filling results (the paper, the table) dropped, best first, at most `max`.
   */
  findCandidates(image: ImageRef, opts: { trace: Trace; max?: number }): Promise<CandidateSearch>;
  segment(image: ImageRef, hint: SegmentHint, opts: { trace: Trace }): Promise<Segment | null>;
}

export type Description = { alt_text: string; spoken: string; dominant_colors: string[]; subject: string; differences_from_prompt: string };
export interface Describer {
  describe(image: ImageRef, opts: { prompt?: string; trace: Trace }): Promise<Description>;
}

export type ListingDraft = { title: string; description: string; tags: string[]; price_cents: number; print_ok: boolean; notes: string };
export type AgentStep = { step: number; tool?: string; args?: unknown; result?: unknown; text?: string };
export type Moderation = { ok: boolean; reason: string };
export interface ListingAgent {
  /** Checks listing text before publishing (also used when the artist edits the text). */
  moderate?(text: { title: string; description: string; tags: string[] }, opts: { trace: Trace }): Promise<Moderation>;
  run(ctx: { productId: string; productType: "sticker" | "tote"; altText: string; creatorStory?: string; imageUrl: string; width: number; height: number; creatorShareBps: number }, opts: { trace: Trace }): Promise<{ listing: ListingDraft; trace: AgentStep[] }>;
}

/** Checks short buyer-written notes (story-tag replies, ship notes) before they reach a creator. */
export interface NoteModerator {
  checkNote(text: string, opts: { trace: Trace }): Promise<Moderation>;
}

export type StoryDraft = { headline: string; bio_short: string; story_text: string; provider: "ollama" | "meta-fallback" };
export interface StoryWriter {
  draftStory(transcript: string, opts: { mentionDisability: boolean; trace: Trace }): Promise<StoryDraft>;
  draftThankYou(transcript: string, ctx: { buyerName: string; productTitle: string }, opts: { trace: Trace }): Promise<{ text: string; provider: StoryDraft["provider"] }>;
}

/** Product photo for the shop: the artwork composed onto a sticker or tote scene. */
export interface MockupMaker {
  make(opts: { kind: "sticker" | "tote"; prompt: string; artPng: Buffer; trace: Trace }): Promise<Buffer>;
}

export type Captions = { vtt: string; transcript: string };
export interface Captioner {
  caption(video: Blob | Buffer, opts: { filename: string; trace: Trace }): Promise<Captions>;
}
