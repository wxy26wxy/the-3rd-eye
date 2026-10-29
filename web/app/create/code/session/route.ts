import { NextResponse, type NextRequest } from "next/server";
import { CREATOR_COOKIE } from "@/components/create/constants";
import { signCreatorToken } from "@/lib/auth";
import { getCreatorByLoginCode } from "@/lib/db/queries";

const MAX_AGE = 60 * 60 * 24 * 30;

function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/create") && !s.startsWith("//") ? s : "/create/product";
}

/**
 * POST (form): `code` → checks it in-process (same rule as POST /api/v1/auth/code) and stores
 * the bearer token in an httpOnly cookie, then redirects to `next`. With `intent=signout` it
 * clears the cookie.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(form.get("next"));
  if (form.get("intent") === "signout") {
    const res = NextResponse.redirect(new URL("/create", req.nextUrl.origin), 303);
    res.cookies.delete(CREATOR_COOKIE);
    return res;
  }
  const code = String(form.get("code") ?? "").trim();
  const fail = () => NextResponse.redirect(new URL(`/create/code?error=1&next=${encodeURIComponent(next)}`, req.nextUrl.origin), 303);
  if (!code || code.length > 64) return fail();
  try {
    const creator = await getCreatorByLoginCode(code);
    if (!creator) return fail();
    const token = signCreatorToken(creator.id);
    const res = NextResponse.redirect(new URL(next, req.nextUrl.origin), 303);
    res.cookies.set(CREATOR_COOKIE, token, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE, secure: req.nextUrl.protocol === "https:",
    });
    return res;
  } catch (err) {
    console.error("creator sign-in failed", err);
    return fail();
  }
}
