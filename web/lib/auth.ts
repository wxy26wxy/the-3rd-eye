/**
 * Dev-mode creator sessions (admin basic auth lives in lib/admin-auth.ts).
 * Creator token: `<creatorId>.<base64url HMAC-SHA256(CREATOR_SESSION_SECRET, creatorId)>`.
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

function sign(creatorId: string): string {
  return createHmac("sha256", secret()).update(creatorId).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function signCreatorToken(creatorId: string): string {
  return `${creatorId}.${sign(creatorId)}`;
}

/** Returns the creator id when the token is authentic, otherwise null. */
export function verifyCreatorToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const creatorId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  return safeEqual(sig, sign(creatorId)) ? creatorId : null;
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
