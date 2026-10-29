import { NextResponse, type NextRequest } from "next/server";
import { CREATE_PUBLIC_PATHS, CREATOR_COOKIE } from "@/components/create/constants";

/**
 * - /admin/*: HTTP basic auth against ADMIN_PASSWORD (any username). Disabled when unset.
 * - /create/*: optimistic sign-in check; real authorization happens in /api/v1.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return adminGate(req);
  if (pathname.startsWith("/create")) return creatorGate(req);
  return NextResponse.next();
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function adminGate(req: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return new NextResponse("Admin is disabled until ADMIN_PASSWORD is set.", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, password)) return NextResponse.next();
    } catch { /* malformed header */ }
  }
  return new NextResponse("Authentication required.", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="maker story admin", charset="UTF-8"' } });
}

function creatorGate(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (CREATE_PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/create/bff/")) return NextResponse.next();
  if (req.cookies.get(CREATOR_COOKIE)?.value) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/create/code";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/create/:path*"] };
