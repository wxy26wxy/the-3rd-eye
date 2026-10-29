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
  shape(transcript: string, opts: { answers?: string[]; product: "sticker" | "tote"; trace: Trace }): Promise<ShapedPrompt>;
}

export type GeneratedImage = { png: Buffer; responseId: string; width: number; height: number };
export interface ImageProvider {
  generate(prompt: string, opts: { n: number; trace: Trace }): Promise<GeneratedImage[]>;
  refine(responseId: string, instruction: string, opts: { trace: Trace }): Promise<GeneratedImage>;
  compose(prompt: string, refs: ImageRef[], opts: { trace: Trace }): Promise<GeneratedImage>;
}

export type Mask = { width: number; height: number; data: Uint8Array /* 0/1 per pixel */ };
export type Segment = { mask: Mask; svgPath: string; bbox: [number, number, number, number]; score: number };
export interface Segmenter {
  findAll(image: ImageRef, phrase: string, opts: { trace: Trace }): Promise<Segment[]>;
  segment(image: ImageRef, hint: { phrase?: string; points?: { x: number; y: number }[]; box?: [number, number, number, number] }, opts: { trace: Trace }): Promise<Segment | null>;
}

export type Description = { alt_text: string; spoken: string; dominant_colors: string[]; subject: string; differences_from_prompt: string };
export interface Describer {
  describe(image: ImageRef, opts: { prompt?: string; trace: Trace }): Promise<Description>;
}

export type ListingDraft = { title: string; description: string; tags: string[]; price_cents: number; print_ok: boolean; notes: string };
export type AgentStep = { step: number; tool?: string; args?: unknown; result?: unknown; text?: string };
export interface ListingAgent {
  run(ctx: { productId: string; productType: "sticker" | "tote"; altText: string; creatorStory?: string; imageUrl: string; width: number; height: number; creatorShareBps: number }, opts: { trace: Trace }): Promise<{ listing: ListingDraft; trace: AgentStep[] }>;
}

export type StoryDraft = { headline: string; bio_short: string; story_text: string; provider: "ollama" | "meta-fallback" };
export interface StoryWriter {
  draftStory(transcript: string, opts: { mentionDisability: boolean; trace: Trace }): Promise<StoryDraft>;
  draftThankYou(transcript: string, ctx: { buyerName: string; productTitle: string }, opts: { trace: Trace }): Promise<{ text: string; provider: StoryDraft["provider"] }>;
}

export type Captions = { vtt: string; transcript: string };
export interface Captioner {
  caption(video: Blob | Buffer, opts: { filename: string; trace: Trace }): Promise<Captions>;
}
