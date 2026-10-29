/**
 * Shared JSON helpers for route handlers. Errors follow docs/api.md:
 * `{ "error": { "code", "message" } }`.
 */
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  /** `details` are merged into the error object, e.g. `{ artworkId }`. */
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function errorResponse(status: number, code: string, message: string, details?: Record<string, unknown>): Response {
  return json({ error: { code, message, ...details } }, status);
}

export function notFound(what = "Resource"): never {
  throw new ApiError(404, "not_found", `${what} not found`);
}

/** Maps any error to an ApiError (status, code, message). */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return new ApiError(400, "invalid_request", msg);
  }
  if (err instanceof URIError) return new ApiError(400, "invalid_path", "Malformed path or URL encoding");
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("DATABASE_URL is not set")) return new ApiError(503, "db_unavailable", "Database is not configured yet");
  if (/META_API_KEY/.test(message)) return new ApiError(503, "ai_unavailable", message);
  console.error("[api] unhandled error:", message);
  return new ApiError(500, "internal", "Something went wrong");
}

export function toErrorResponse(err: unknown): Response {
  const e = toApiError(err);
  return errorResponse(e.status, e.code, e.message, e.details);
}

/**
 * Next's control-flow errors (DYNAMIC_SERVER_USAGE, NEXT_REDIRECT, HANGING_PROMISE_REJECTION,
 * NEXT_PRERENDER_INTERRUPTED, ...) all carry a string `digest`; app errors never do. Checked
 * structurally so this module does not import next/navigation (scripts run it outside Next).
 */
export function isNextInternalError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  if (typeof digest === "string" && digest.length > 0) return true;
  return isNextInternalError((err as { cause?: unknown }).cause);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler so thrown ApiError / ZodError become JSON error responses. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (isNextInternalError(err)) throw err; // prerender bail-out, redirect, notFound: Next handles these
      return toErrorResponse(err);
    }
  };
}

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be JSON");
  }
  return schema.parse(body);
}
