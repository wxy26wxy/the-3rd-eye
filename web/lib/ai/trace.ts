/**
 * Every model call goes through `traced(...)`, which appends one `ai_calls` row:
 * stage, provider, model, sha256 request hash, redacted request/response (no media
 * bytes), latency, error. Logging never throws and never blocks the result.
 */
import "server-only";
import { createHash } from "node:crypto";
import type { Trace } from "./types";

const MAX_STRING = 2000;
let warnedNoDb = false;

function isBytes(v: unknown): v is Uint8Array {
  return v instanceof Uint8Array;
}

/** Replaces media bytes, base64 payloads and data URLs with short placeholders; truncates long text. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[depth]";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (isBytes(value)) return `[bytes:${value.byteLength}]`;
  if (typeof Blob !== "undefined" && value instanceof Blob) return `[blob:${value.size}]`;
  if (typeof value === "string") {
    if (value.startsWith("data:")) return `[data-url:${value.slice(5, value.indexOf(";"))},${value.length}]`;
    if (value.length > 256 && /^[A-Za-z0-9+/=_-]+$/.test(value.slice(0, 256))) return `[base64:${value.length}]`;
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[+${value.length - MAX_STRING}]` : value;
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "function") continue;
      out[k] = redact(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function stable(value: unknown): string {
  if (isBytes(value)) return `bytes:${createHash("sha256").update(value).digest("hex")}`;
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && typeof v !== "function")
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** sha256 of a canonical serialization (key order independent; bytes hashed by content). */
export function requestHash(request: unknown): string {
  return createHash("sha256").update(stable(request)).digest("hex");
}

function responseIdOf(result: unknown): string | null {
  if (result && typeof result === "object" && "id" in result && typeof (result as { id: unknown }).id === "string") {
    return (result as { id: string }).id;
  }
  if (result && typeof result === "object" && "responseId" in result) {
    const id = (result as { responseId: unknown }).responseId;
    return typeof id === "string" ? id : null;
  }
  return null;
}

async function writeRow(row: Record<string, unknown>): Promise<void> {
  if (!process.env.DATABASE_URL) {
    if (!warnedNoDb) {
      warnedNoDb = true;
      console.warn("[ai-trace] DATABASE_URL missing: ai_calls rows are not persisted");
    }
    return;
  }
  try {
    const { insertAiCall } = await import("@/lib/db/queries");
    await insertAiCall(row as Parameters<typeof insertAiCall>[0]);
  } catch (err) {
    console.warn("[ai-trace] failed to write ai_calls row:", err instanceof Error ? err.message : err);
  }
}

/**
 * Runs `fn`, recording the call in `ai_calls`. Errors from `fn` are recorded and rethrown;
 * errors from logging are swallowed.
 */
export async function traced<T>(
  stage: string,
  provider: string,
  model: string,
  request: unknown,
  fn: () => Promise<T>,
  trace?: Partial<Trace>,
): Promise<T> {
  const started = Date.now();
  const base = {
    stage, provider, model,
    jobId: trace?.jobId ?? null,
    artworkId: trace?.artworkId ?? null,
    listingId: trace?.listingId ?? null,
    createdByTask: trace?.task ?? "T010",
  };
  let hash = "unhashable";
  let requestJson: unknown = null;
  try {
    hash = requestHash(request);
    requestJson = redact(request);
  } catch { /* keep defaults */ }
  try {
    const result = await fn();
    await writeRow({
      ...base, requestHash: hash, requestJson, responseId: responseIdOf(result),
      responseJson: safeRedact(result), latencyMs: Date.now() - started,
    });
    return result;
  } catch (err) {
    await writeRow({
      ...base, requestHash: hash, requestJson, latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message.slice(0, 2000) : String(err),
    });
    throw err;
  }
}

function safeRedact(v: unknown): unknown {
  try {
    return redact(v);
  } catch {
    return null;
  }
}
