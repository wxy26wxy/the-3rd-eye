import "server-only";
import type { NextRequest } from "next/server";
import { bffIpHeaders, clientIp } from "@/lib/rate-limit";

/**
 * Headers for a same-origin call to /api/v1 from a route handler. The incoming cookies are
 * forwarded so deployment protection (if any) lets the request through, and the Vercel
 * automation bypass secret is attached when configured.
 */
export function forwardHeaders(req: NextRequest, token?: string): Headers {
  const h = new Headers();
  const ct = req.headers.get("content-type");
  if (ct) h.set("content-type", ct);
  h.set("accept", req.headers.get("accept") ?? "application/json");
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  if (token) h.set("authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(bffIpHeaders(clientIp(req.headers)))) h.set(k, v);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) h.set("x-vercel-protection-bypass", bypass);
  return h;
}

export function apiUrl(req: NextRequest, path: string): URL {
  return new URL(`/api/v1/${path}`, req.nextUrl.origin);
}
