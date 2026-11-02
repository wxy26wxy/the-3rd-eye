import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { CREATOR_COOKIE, CREATOR_SESSION_COOKIE } from "@/components/create/constants";
import { restore, sessionMarker } from "@/components/create/store";

vi.mock("@/lib/auth", () => ({ signCreatorToken: (id: string) => `token-${id}` }));
vi.mock("@/lib/db/queries", () => ({
  getCreatorByLoginCode: async (code: string) => (code === "AAAA" ? { id: "creator-a" } : code === "BBBB" ? { id: "creator-b" } : null),
}));
const { POST } = await import("@/app/create/code/session/route");

function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return POST(new NextRequest("http://localhost/create/code/session", { method: "POST", body }));
}
const markerOf = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith(`${CREATOR_SESSION_COOKIE}=`)) ?? "";

describe("T127: the creator-flow cache belongs to one sign-in", () => {
  it("each sign-in sets a new readable sign-in id next to the httpOnly token; sign-out clears both", async () => {
    const a = await post({ code: "AAAA", next: "/create/product" });
    const b = await post({ code: "BBBB", next: "/create/product" });
    const ma = markerOf(a), mb = markerOf(b);
    expect(ma).toMatch(new RegExp(`^${CREATOR_SESSION_COOKIE}=[0-9a-f-]{36};`));
    expect(ma).not.toMatch(/HttpOnly/i);
    expect(ma.split(";")[0]).not.toBe(mb.split(";")[0]);
    expect(a.headers.getSetCookie().find((c) => c.startsWith(`${CREATOR_COOKIE}=`))).toMatch(/HttpOnly/i);
    const out = await post({ intent: "signout" });
    const cleared = out.headers.getSetCookie();
    expect(cleared.find((c) => c.startsWith(`${CREATOR_COOKIE}=`))).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(cleared.find((c) => c.startsWith(`${CREATOR_SESSION_COOKIE}=`))).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it("signed in as A, the cache is restored; signed in as B (or signed out), it is gone", () => {
    const saved = JSON.stringify({ draft: { product: "sticker", photoArtworkId: "p1" }, creator: { id: "creator-a", displayName: "A" }, session: "id-a" });
    expect(restore(saved, "id-a")).toMatchObject({ draft: { photoArtworkId: "p1" }, creator: { id: "creator-a" } });
    expect(restore(saved, "id-b")).toEqual({ draft: {}, creator: null });
    expect(restore(saved, null)).toEqual({ draft: {}, creator: null });
    // a cache saved before the sign-in id existed is kept only while there is still no id
    const old = JSON.stringify({ draft: { product: "tote" }, creator: null });
    expect(restore(old, null).draft).toEqual({ product: "tote" });
    expect(restore(old, "id-b").draft).toEqual({});
    expect(restore("{not json", "id-a")).toEqual({ draft: {}, creator: null });
  });

  it("reads the sign-in id from document.cookie", () => {
    expect(sessionMarker(`a=1; ${CREATOR_SESSION_COOKIE}=abc-123; b=2`)).toBe("abc-123");
    expect(sessionMarker("a=1")).toBeNull();
    expect(sessionMarker("")).toBeNull();
  });
});
