/**
 * Meta Model API and Ollama (Muse Glimmer) clients (OpenAI SDK with custom baseURL).
 * Model ids exactly as in docs/architecture.md. Keys stay server-side; clients are
 * created lazily so builds and tests never need them.
 */
import "server-only";
import OpenAI from "openai";

export const MODELS = {
  transcribe: "muse-voice-transcribe-1.0",
  spark: "muse-spark-1.3",
  image: "muse-image-1.0",
  sam: "sam-3.1",
  glimmer: "muse-glimmer",
} as const;

export const META_BASE_URL = "https://api.meta.ai/v1";
export const OLLAMA_DEFAULT_BASE_URL = "http://localhost:11434/v1";

export class MissingKeyError extends Error {}

export function metaApiKey(): string {
  const key = process.env.META_API_KEY;
  if (!key) throw new MissingKeyError("META_API_KEY is not set");
  return key;
}

let _meta: OpenAI | null = null;
export function metaClient(): OpenAI {
  if (!_meta) _meta = new OpenAI({ apiKey: metaApiKey(), baseURL: META_BASE_URL, maxRetries: 2, timeout: 240_000 });
  return _meta;
}

let _ollama: OpenAI | null = null;
/** Local Muse Glimmer through Ollama's OpenAI-compatible endpoint. No key; the SDK needs a dummy one. */
export function ollamaClient(): OpenAI {
  if (!_ollama) {
    _ollama = new OpenAI({
      apiKey: "ollama",
      baseURL: process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_BASE_URL,
      maxRetries: 0,
      timeout: 30_000,
    });
  }
  return _ollama;
}

/** The slice of the Responses API the providers use; tests pass a fake. */
export interface ResponsesLike {
  create(body: Record<string, unknown>, options?: { signal?: AbortSignal; timeout?: number }): Promise<unknown>;
}

export function metaResponses(): ResponsesLike {
  return {
    create: (body, options) => metaClient().responses.create(body as never, options) as Promise<unknown>,
  };
}
