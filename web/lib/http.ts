/**
 * Shared JSON helpers for route handlers. Errors follow docs/api.md:
 * `{ "error": { "code", "message" } }`.
 */
import { ZodError, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

export function notFound(what = "Resource"): never {
  throw new ApiError(404, "not_found", `${what} not found`);
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message);
  if (err instanceof ZodError) {
    const msg = err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return errorResponse(400, "invalid_request", msg);
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("DATABASE_URL is not set")) return errorResponse(503, "db_unavailable", "Database is not configured yet");
  if (/META_API_KEY/.test(message)) return errorResponse(503, "ai_unavailable", message);
  console.error("[api] unhandled error:", message);
  return errorResponse(500, "internal", "Something went wrong");
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
