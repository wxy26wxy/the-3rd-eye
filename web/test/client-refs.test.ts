import { describe, expect, it } from "vitest";
import { clientUploadPath, storeIdFromToken } from "@/lib/storage/refs";
import { ApiError } from "@/lib/http";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const HOST = "abc123.public.blob.vercel-storage.com";
const own = `creators/${A}/photo/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg`;

function code(fn: () => unknown): string | null {
  try { fn(); return null; } catch (e) { return e instanceof ApiError ? e.code : "other"; }
}

describe("client-supplied blob references", () => {
  it("accepts the creator's own pathname or public-store URL", () => {
    expect(clientUploadPath(own, A, HOST)).toBe(own);
    expect(clientUploadPath(`/${own}`, A, HOST)).toBe(own);
    expect(clientUploadPath(`https://${HOST}/${own}`, A, HOST)).toBe(own);
  });

  it("rejects another creator's files (pathname or URL)", () => {
    expect(code(() => clientUploadPath(own, B, HOST))).toBe("forbidden_path");
    expect(code(() => clientUploadPath(`https://${HOST}/${own}`, B, HOST))).toBe("forbidden_path");
  });

  it("rejects private-store and foreign hosts, http, and traversal", () => {
    expect(code(() => clientUploadPath(`https://abc123.private.blob.vercel-storage.com/${own}`, A, HOST))).toBe("forbidden_url");
    expect(code(() => clientUploadPath(`https://evil.example.com/${own}`, A, HOST))).toBe("forbidden_url");
    expect(code(() => clientUploadPath(`http://${HOST}/${own}`, A, HOST))).toBe("forbidden_url");
    expect(code(() => clientUploadPath(`creators/${A}/../${B}/print/x.png`, A, HOST))).toBe("forbidden_path");
    expect(code(() => clientUploadPath(`private/0123abcd.png`, A, HOST))).toBe("forbidden_path");
    expect(code(() => clientUploadPath(`https://${HOST}/${own}`, A, null))).toBe("forbidden_url");
  });

  it("reads the store id from a read/write token", () => {
    expect(storeIdFromToken("vercel_blob_rw_AbC123_secret")).toBe("abc123");
    expect(storeIdFromToken(undefined)).toBeNull();
  });
});
