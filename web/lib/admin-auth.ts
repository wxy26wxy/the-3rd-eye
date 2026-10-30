/**
 * Admin basic-auth check, shared by proxy.ts (page requests) and every admin Server Function
 * (which can be POSTed to directly and must verify auth themselves). Any username is accepted;
 * the password must equal ADMIN_PASSWORD. No Node-only APIs, so it runs in Proxy too.
 */
import { BRAND } from "./brand";

export type AdminAuthResult = "ok" | "unauthorized" | "disabled";

/** Constant-time string comparison (length is not secret here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkAdminAuth(authorization: string | null | undefined, password = process.env.ADMIN_PASSWORD): AdminAuthResult {
  if (!password) return "disabled";
  if (!authorization?.startsWith("Basic ")) return "unauthorized";
  try {
    const decoded = atob(authorization.slice(6).trim());
    const sep = decoded.indexOf(":");
    if (sep < 0) return "unauthorized";
    return safeEqual(decoded.slice(sep + 1), password) ? "ok" : "unauthorized";
  } catch {
    return "unauthorized";
  }
}

export const ADMIN_REALM = `Basic realm="${BRAND.name} admin", charset="UTF-8"`;
