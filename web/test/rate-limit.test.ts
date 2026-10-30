import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { BFF_IP_HEADER, BFF_SIG_HEADER, bffIpHeaders, RATE_LIMITS, RateLimiter, classify, clientIp, limiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks with a Retry-After", () => {
    const l = new RateLimiter(60_000);
    for (let i = 0; i < 3; i++) expect(l.check("a", 3, 1000 + i).ok).toBe(true);
    const r = l.check("a", 3, 11_000);
    expect(r).toEqual({ ok: false, retryAfterSeconds: 50 });
  });

  it("slides: old hits fall out and the key resets after the window", () => {
    const l = new RateLimiter(60_000);
    l.check("a", 2, 0); l.check("a", 2, 30_000);
    expect(l.check("a", 2, 59_000).ok).toBe(false);
    expect(l.check("a", 2, 60_001).ok).toBe(true); // first hit expired
    expect(l.check("a", 2, 60_002).ok).toBe(false);
    expect(l.check("a", 2, 200_000).ok).toBe(true);
  });

  it("counts keys separately", () => {
    const l = new RateLimiter();
    expect(l.check("a", 1, 0).ok).toBe(true);
    expect(l.check("a", 1, 1).ok).toBe(false);
    expect(l.check("b", 1, 2).ok).toBe(true);
  });

  it("evicts stale keys and stays under the cap", () => {
    const l = new RateLimiter(60_000, 5);
    for (let i = 0; i < 5; i++) l.check(`k${i}`, 5, 0);
    l.check("new", 5, 120_000);
    expect(l.size).toBe(1);
    const small = new RateLimiter(60_000, 3);
    for (let i = 0; i < 10; i++) small.check(`k${i}`, 5, i);
    expect(small.size).toBeLessThanOrEqual(3);
  });
});

describe("classify and clientIp", () => {
  it("maps routes to groups, POST only", () => {
    expect(classify("POST", "/api/v1/auth/code")).toBe("auth");
    expect(classify("POST", "/create/code/session")).toBe("auth");
    expect(classify("POST", "/create/bff/auth/code")).toBe("auth");
    expect(classify("POST", "/api/v1/public/tap")).toBe("public");
    expect(classify("POST", "/t/abc123")).toBe("public");
    for (const r of ["artworks", "products/1/publish", "listings", "prompts", "transcribe", "story"]) {
      expect(classify("POST", `/api/v1/${r}`)).toBe("model");
    }
    expect(classify("POST", "/create/bff/artworks/x/cleanup")).toBe("model");
    expect(classify("GET", "/api/v1/auth/code")).toBeNull();
    expect(classify("POST", "/api/v1/orders")).toBeNull();
    expect(classify("POST", "/api/v1/artworksx")).toBeNull();
  });

  it("takes the first x-forwarded-for hop, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("proxy rate limiting", () => {
  beforeEach(() => { limiter.reset(); delete process.env.RATE_LIMIT_DISABLED; });
  afterEach(() => { limiter.reset(); delete process.env.RATE_LIMIT_DISABLED; });
  const post = (path: string, ip?: string) =>
    proxy(new NextRequest(`http://localhost${path}`, { method: "POST", headers: ip ? { "x-forwarded-for": ip } : {} }));

  it("429s the 11th auth/code call in a minute, not another IP", async () => {
    for (let i = 0; i < RATE_LIMITS.auth; i++) expect((await post("/api/v1/auth/code", "9.9.9.9")).status).not.toBe(429);
    const blocked = await post("/api/v1/auth/code", "9.9.9.9");
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await blocked.json()).error.code).toBe("rate_limited");
    expect((await post("/api/v1/auth/code", "8.8.8.8")).status).not.toBe(429);
  });

  it("never blocks an unknown IP, and RATE_LIMIT_DISABLED turns it off", async () => {
    for (let i = 0; i < 15; i++) expect((await post("/api/v1/auth/code")).status).not.toBe(429);
    process.env.RATE_LIMIT_DISABLED = "1";
    for (let i = 0; i < 15; i++) expect((await post("/api/v1/auth/code", "7.7.7.7")).status).not.toBe(429);
  });
});

describe("BFF hop", () => {
  beforeEach(() => { limiter.reset(); process.env.CREATOR_SESSION_SECRET = "test-secret-0123456789"; });
  afterEach(() => { limiter.reset(); delete process.env.CREATOR_SESSION_SECRET; });
  const post = (path: string, headers: Record<string, string>) =>
    proxy(new NextRequest(`http://localhost${path}`, { method: "POST", headers }));

  it("gives two client IPs separate buckets at the BFF and skips the signed inner hop", async () => {
    for (let i = 0; i < RATE_LIMITS.model; i++) {
      expect((await post("/create/bff/artworks", { "x-forwarded-for": "1.1.1.1", cookie: "ms_creator=x" })).status).not.toBe(429);
      // inner hop from the server's own IP, signed for the client: not counted again
      expect((await post("/api/v1/artworks", { "x-forwarded-for": "10.0.0.1", ...bffIpHeaders("1.1.1.1") })).status).not.toBe(429);
    }
    expect((await post("/create/bff/artworks", { "x-forwarded-for": "1.1.1.1", cookie: "ms_creator=x" })).status).toBe(429);
    expect((await post("/create/bff/artworks", { "x-forwarded-for": "2.2.2.2", cookie: "ms_creator=x" })).status).not.toBe(429);
  });

  it("a forged signature falls back to the connection IP", async () => {
    const forged = { [BFF_IP_HEADER]: "5.5.5.5", [BFF_SIG_HEADER]: "0".repeat(64) };
    for (let i = 0; i < RATE_LIMITS.model; i++) await post("/api/v1/artworks", { "x-forwarded-for": "6.6.6.6", ...forged });
    expect((await post("/api/v1/artworks", { "x-forwarded-for": "6.6.6.6", ...forged })).status).toBe(429);
  });

  it("limits an encoded BFF path", async () => {
    for (let i = 0; i < RATE_LIMITS.model; i++) await post("/create/bff/%61rtworks", { "x-forwarded-for": "3.3.3.3", cookie: "ms_creator=x" });
    expect((await post("/create/bff/%61rtworks", { "x-forwarded-for": "3.3.3.3", cookie: "ms_creator=x" })).status).toBe(429);
  });

  it("keys IPv6 by /64", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "2001:db8:1:2:aaaa::1" }))).toBe(clientIp(new Headers({ "x-forwarded-for": "2001:db8:1:2::ffff" })));
  });
});
