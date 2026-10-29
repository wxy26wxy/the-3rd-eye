import { describe, expect, it } from "vitest";
import { CROCKFORD_ALPHABET, isNfcToken, newNfcToken, normalizeNfcToken } from "@/lib/ids";

describe("nfc tokens", () => {
  it("are 12 Crockford base32 characters", () => {
    for (let i = 0; i < 200; i++) {
      const t = newNfcToken();
      expect(t).toHaveLength(12);
      expect(isNfcToken(t)).toBe(true);
      for (const ch of t) expect(CROCKFORD_ALPHABET).toContain(ch);
    }
  });

  it("never contain ambiguous letters I, L, O, U", () => {
    const all = Array.from({ length: 500 }, newNfcToken).join("");
    expect(all).not.toMatch(/[ILOU]/);
  });

  it("are unique across many draws", () => {
    const set = new Set(Array.from({ length: 5000 }, newNfcToken));
    expect(set.size).toBe(5000);
  });

  it("normalizes human input per Crockford rules", () => {
    expect(normalizeNfcToken(" abcd-efgh-jkmo ")).toBe("ABCDEFGHJKM0");
    expect(normalizeNfcToken("il")).toBe("11");
    expect(isNfcToken("ABCDEFGHJKM0")).toBe(true);
    expect(isNfcToken("ABCDEFGHJKMU")).toBe(false);
    expect(isNfcToken("SHORT")).toBe(false);
  });
});
