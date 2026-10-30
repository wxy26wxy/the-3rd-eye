/**
 * Per-IP sliding-window rate limits, kept in memory per function instance.
 *
 * Fluid Compute reuses instances, so this stops naive brute force and runaway loops, but it is
 * not a global limit: separate instances count separately. Vercel Firewall rate-limit rules
 * need a paid plan; add them when the plan allows. Used from `proxy.ts`.
 */

export const RATE_WINDOW_MS = 60_000;
export const MAX_KEYS = 10_000;

export type RateGroup = "auth" | "public" | "model";

/** Requests allowed per IP per window, by group. The only place the numbers live. */
export const RATE_LIMITS: Record<RateGroup, number> = { auth: 10, public: 30, model: 20 };

const MODEL_ROUTES = "(?:artworks|products|listings|prompts|transcribe|story)";
const AUTH_RE = /^\/(?:api\/v1\/auth\/code|create\/code\/session|create\/bff\/auth\/code)\/?$/;
const PUBLIC_RE = /^\/(?:api\/v1\/public(?:\/.*)?|t(?:\/.*)?)$/;
const MODEL_RE = new RegExp(`^/(?:api/v1|create/bff)/${MODEL_ROUTES}(?:/.*)?$`);

/** Which limit group a request falls in, or null when it is not limited (only POST is). */
export function classify(method: string, pathname: string): RateGroup | null {
  if (method !== "POST") return null;
  if (AUTH_RE.test(pathname)) return "auth";
  if (PUBLIC_RE.test(pathname)) return "public";
  if (MODEL_RE.test(pathname)) return "model";
  return null;
}

/** First hop of x-forwarded-for, else x-real-ip, else null. */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || null;
}

export type RateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private windowMs = RATE_WINDOW_MS, private maxKeys = MAX_KEYS) {}

  get size(): number { return this.hits.size; }

  /** Records one request for `key` and says whether it is within `limit` for the window. */
  check(key: string, limit: number, now = Date.now()): RateResult {
    const cutoff = now - this.windowMs;
    const stamps = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (stamps.length >= limit) {
      this.hits.set(key, stamps);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((stamps[0] + this.windowMs - now) / 1000)) };
    }
    stamps.push(now);
    this.hits.delete(key); // re-insert so Map order tracks recency
    this.hits.set(key, stamps);
    if (this.hits.size > this.maxKeys) this.evict(cutoff);
    return { ok: true };
  }

  /** Drops keys with no hit inside the window; if still over the cap, drops the least recent. */
  private evict(cutoff: number) {
    for (const [k, v] of this.hits) if (v[v.length - 1] <= cutoff) this.hits.delete(k);
    for (const k of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(k);
    }
  }

  reset() { this.hits.clear(); }
}

export const limiter = new RateLimiter();

let warnedUnknownIp = false;

/**
 * Applies the limits to one request. Returns null to let it through, or a 429 response.
 * Never blocks when the IP is unknown (logged once) or when RATE_LIMIT_DISABLED=1.
 */
export function rateLimitResponse(
  req: { method: string; headers: Pick<Headers, "get"> },
  pathname: string,
  now = Date.now(),
): Response | null {
  if (process.env.RATE_LIMIT_DISABLED === "1") return null;
  const group = classify(req.method, pathname);
  if (!group) return null;
  const ip = clientIp(req.headers);
  if (!ip) {
    if (!warnedUnknownIp) { warnedUnknownIp = true; console.warn("[rate-limit] no client IP on request; not limiting"); }
    return null;
  }
  const result = limiter.check(`${group}:${ip}`, RATE_LIMITS[group], now);
  if (result.ok) return null;
  return Response.json(
    { error: { code: "rate_limited", message: "Too many requests. Please wait a minute and try again." } },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } },
  );
}
