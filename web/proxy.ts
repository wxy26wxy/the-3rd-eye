import { NextResponse, type NextRequest } from "next/server";
import { CREATE_PUBLIC_PATHS, CREATOR_COOKIE } from "@/components/create/constants";
import { ADMIN_REALM, checkAdminAuth } from "@/lib/admin-auth";

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

function adminGate(req: NextRequest) {
  const result = checkAdminAuth(req.headers.get("authorization"));
  if (result === "ok") return NextResponse.next();
  if (result === "disabled") return new NextResponse("Admin is disabled until ADMIN_PASSWORD is set.", { status: 503 });
  return new NextResponse("Authentication required.", { status: 401, headers: { "WWW-Authenticate": ADMIN_REALM } });
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
