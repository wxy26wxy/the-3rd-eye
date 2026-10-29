/**
 * Dev-mode creator sessions (admin basic auth lives in lib/admin-auth.ts).
 * Creator token: `<creatorId>.<expiresAt unix seconds>.<base64url HMAC-SHA256(CREATOR_SESSION_SECRET, "<creatorId>.<expiresAt>")>`,
 * valid 30 days (TOKEN_TTL_SECONDS) and checked on every request; `POST /auth/code` issues a fresh one.
 * Sent as `Authorization: Bearer <token>` (iOS, API) or the `ms_creator` cookie (mobile web).
 * Not a production auth scheme; see docs/api.md.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./http";

export const CREATOR_COOKIE = "ms_creator";
const DEV_SECRET = "dev-only-creator-session-secret";

/**
 * Fails closed: any Vercel deployment (VERCEL_ENV set, including previews) or production build
 * without CREATOR_SESSION_SECRET refuses to sign or verify. The dev secret exists only for
 * local `next dev` and tests.
 */
function secret(): string {
  const s = process.env.CREATOR_SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.VERCEL_ENV || process.env.NODE_ENV === "production") {
    throw new ApiError(500, "auth_not_configured", "CREATOR_SESSION_SECRET (16+ characters) is not set on this deployment");
  }
  return s || DEV_SECRET;
}

export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function signCreatorToken(creatorId: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${creatorId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the creator id when the token is authentic and not expired, otherwise null. */
export function verifyCreatorToken(token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null;
  secret(); // fails closed on a deployment without a secret, even for malformed tokens
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [creatorId, expRaw, sig] = parts;
  if (!creatorId || !/^\d{1,12}$/.test(expRaw)) return null;
  if (!safeEqual(sig, sign(`${creatorId}.${expRaw}`))) return null;
  return Number(expRaw) * 1000 > now ? creatorId : null;
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Token from `Authorization: Bearer` or the creator cookie. */
export function creatorTokenFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return cookieValue(req.headers.get("cookie"), CREATOR_COOKIE);
}

export function optionalCreator(req: Request): string | null {
  return verifyCreatorToken(creatorTokenFrom(req));
}

/** Throws a 401 ApiError unless the request carries a valid creator token. */
export function requireCreator(req: Request): { creatorId: string } {
  const creatorId = optionalCreator(req);
  if (!creatorId) throw new ApiError(401, "unauthorized", "Sign in with your creator code first.");
  return { creatorId };
}
