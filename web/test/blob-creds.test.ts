import { beforeEach, describe, expect, it, vi } from "vitest";

// No network: the SDK is stubbed; each test decides what put/head answer.
const sdk = vi.hoisted(() => ({ put: vi.fn(), head: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => {
  class BlobNotFoundError extends Error {}
  return { ...sdk, issueSignedToken: vi.fn(), presignUrl: vi.fn(), BlobNotFoundError };
});

const { BlobStorage, STORAGE_CREDENTIALS_EXPIRED, oidcTokenState, privateCreds, storageError } = await import("@/lib/storage/blob");
const { ApiError } = await import("@/lib/http");

// Fake values only (shape of the real ones, no secrets).
const PRIV = "privStore1", PUB = "pubStore9";
const rw = (store: string) => `vercel_blob_rw_${store}_fakesecret`;
const jwt = (exp: number) => `x.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.y`;
const now = Date.UTC(2026, 9, 31);

describe("private store credential selection (T108)", () => {
  it("no private store id → null (hashed public fallback, unchanged)", () => {
    expect(privateCreds({ BLOB_READ_WRITE_TOKEN: rw(PUB) })).toBeNull();
  });

  it("store id only → OIDC with the store id", () => {
    expect(privateCreds({ BLOB_PRIVATE_STORE_ID: PRIV })).toEqual({ storeId: PRIV });
  });

  it("the public store's token is never used for private files", () => {
    expect(privateCreds({ BLOB_PRIVATE_STORE_ID: PRIV, BLOB_READ_WRITE_TOKEN: rw(PUB) })).toEqual({ storeId: PRIV });
    expect(privateCreds({ BLOB_PRIVATE_STORE_ID: PRIV, BLOB_PRIVATE_READ_WRITE_TOKEN: rw(PUB) })).toEqual({ storeId: PRIV });
  });

  it("a read/write token of the private store is the fallback credential (store_ prefix ignored)", () => {
    expect(privateCreds({ BLOB_PRIVATE_STORE_ID: `store_${PRIV}`, BLOB_PRIVATE_READ_WRITE_TOKEN: rw(PRIV), BLOB_READ_WRITE_TOKEN: rw(PUB) }))
      .toEqual({ token: rw(PRIV) });
    expect(privateCreds({ BLOB_PRIVATE_STORE_ID: PRIV, BLOB_READ_WRITE_TOKEN: rw(PRIV) })).toEqual({ token: rw(PRIV) });
  });

  it("reads the OIDC token state from its exp without network", () => {
    expect(oidcTokenState({}, now)).toBe("missing");
    expect(oidcTokenState({ VERCEL_OIDC_TOKEN: jwt(now / 1000 - 60) }, now)).toBe("expired");
    expect(oidcTokenState({ VERCEL_OIDC_TOKEN: jwt(now / 1000 + 3600) }, now)).toBe("ok");
  });
});

describe("credential failures surface clearly (T108)", () => {
  beforeEach(() => { for (const f of Object.values(sdk)) f.mockReset(); });

  it("maps the SDK's public-store fallback error to 503 storage_credentials_expired, logged once", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = storageError(new Error("Vercel Blob: Cannot use private access on a public store."), {});
    const b = storageError(new Error("No blob credentials found. Pass a `token` option…"), {});
    for (const e of [a, b]) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ status: 503, code: "storage_credentials_expired", message: STORAGE_CREDENTIALS_EXPIRED });
    }
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).toContain("vercel env pull");
    log.mockRestore();
  });

  it("leaves other errors alone", () => {
    const e = new Error("network down");
    expect(storageError(e, {})).toBe(e);
  });

  it("putPrivate reports the expired-credential failure instead of a raw 500", async () => {
    vi.stubEnv("BLOB_PRIVATE_STORE_ID", PRIV);
    vi.stubEnv("BLOB_PRIVATE_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", rw(PUB));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { BlobNotFoundError } = await import("@vercel/blob");
    sdk.head.mockRejectedValue(new BlobNotFoundError());
    sdk.put.mockRejectedValue(new Error("Vercel Blob: Cannot use private access on a public store."));
    await expect(new BlobStorage().putPrivate("u/c/masks/x.png", Buffer.from("x"), "image/png"))
      .rejects.toMatchObject({ code: "storage_credentials_expired", message: STORAGE_CREDENTIALS_EXPIRED });
    expect(sdk.put.mock.calls[0][2]).toMatchObject({ access: "private", storeId: PRIV });
    expect(sdk.put.mock.calls[0][2].token).toBeUndefined();
    log.mockRestore();
    vi.unstubAllEnvs();
  });
});
