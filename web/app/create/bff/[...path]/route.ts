import { NextResponse, type NextRequest } from "next/server";
import { CREATOR_COOKIE } from "@/components/create/constants";
import { apiUrl, forwardHeaders } from "@/components/create/forward";

/** The forwarded model routes run up to 270 s (their own deadline); the forwarder must outlive them. */
export const maxDuration = 300;

/**
 * Same-origin forwarder for the mobile-web creator flow: /create/bff/<path> → /api/v1/<path>
 * with `Authorization: Bearer <token>` taken from the httpOnly creator cookie, so the token
 * never reaches page JavaScript. Also used as the Blob `handleUploadUrl`.
 */
async function forward(req: NextRequest, ctx: RouteContext<"/create/bff/[...path]">) {
  const token = req.cookies.get(CREATOR_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in with your creator code." } }, { status: 401 });
  const { path } = await ctx.params;
  if (path.some((p) => p === ".." || p === ".")) return NextResponse.json({ error: { code: "bad_path", message: "Bad path." } }, { status: 400 });
  const target = apiUrl(req, path.map(encodeURIComponent).join("/"));
  target.search = req.nextUrl.search;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(target, {
    method: req.method,
    headers: forwardHeaders(req, token),
    body: hasBody ? await req.arrayBuffer() : undefined,
    cache: "no-store",
    redirect: "manual",
  });
  const headers = new Headers();
  for (const k of ["content-type", "cache-control"]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
