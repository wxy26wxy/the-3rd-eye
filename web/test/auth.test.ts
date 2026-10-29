import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CREATOR_COOKIE, checkAdminAuth, requireCreator, signCreatorToken, verifyCreatorToken,
} from "@/lib/auth";
import { ApiError } from "@/lib/http";

const ID = "6f1c1b0e-1d8a-4c1e-9d55-3c3f2b1a0e11";

describe("creator tokens", () => {
  beforeEach(() => { process.env.CREATOR_SESSION_SECRET = "test-secret"; });
  afterEach(() => { delete process.env.CREATOR_SESSION_SECRET; delete process.env.ADMIN_PASSWORD; });

  it("round-trips creatorId.sig", () => {
    const token = signCreatorToken(ID);
    expect(token.startsWith(`${ID}.`)).toBe(true);
    expect(verifyCreatorToken(token)).toBe(ID);
  });

  it("rejects tampered ids, signatures and other secrets", () => {
    const token = signCreatorToken(ID);
    expect(verifyCreatorToken(token.replace(ID, "00000000-0000-0000-0000-000000000000"))).toBeNull();
    expect(verifyCreatorToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(verifyCreatorToken("garbage")).toBeNull();
    expect(verifyCreatorToken("")).toBeNull();
    process.env.CREATOR_SESSION_SECRET = "another";
    expect(verifyCreatorToken(token)).toBeNull();
  });

  it("requireCreator reads Bearer header or cookie and throws 401 otherwise", () => {
    const token = signCreatorToken(ID);
    const bearer = new Request("http://x/api", { headers: { authorization: `Bearer ${token}` } });
    expect(requireCreator(bearer).creatorId).toBe(ID);
    const cookie = new Request("http://x/api", { headers: { cookie: `a=b; ${CREATOR_COOKIE}=${encodeURIComponent(token)}` } });
    expect(requireCreator(cookie).creatorId).toBe(ID);
    const none = new Request("http://x/api");
    expect(() => requireCreator(none)).toThrow(ApiError);
    try { requireCreator(none); } catch (e) { expect((e as ApiError).status).toBe(401); }
  });
});

describe("admin basic auth", () => {
  afterEach(() => { delete process.env.ADMIN_PASSWORD; });
  const basic = (u: string, p: string) => `Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

  it("accepts the right password with any user", () => {
    process.env.ADMIN_PASSWORD = "s3cret:with:colons";
    expect(checkAdminAuth(basic("admin", "s3cret:with:colons"))).toBe(true);
    expect(checkAdminAuth(basic("anyone", "s3cret:with:colons"))).toBe(true);
  });

  it("rejects wrong, missing or unconfigured passwords", () => {
    process.env.ADMIN_PASSWORD = "s3cret";
    expect(checkAdminAuth(basic("admin", "nope"))).toBe(false);
    expect(checkAdminAuth(null)).toBe(false);
    expect(checkAdminAuth("Bearer abc")).toBe(false);
    delete process.env.ADMIN_PASSWORD;
    expect(checkAdminAuth(basic("admin", "s3cret"))).toBe(false);
  });
});
