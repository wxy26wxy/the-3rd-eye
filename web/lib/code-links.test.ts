import { describe, expect, it } from "vitest";
import { readCodeFragment, signInLinks } from "./code-links";

describe("signInLinks", () => {
  it("puts the code in the fragment for the link and in the query for the QR", () => {
    expect(signInLinks("https://shop.example/", "ABCD23EFGH")).toEqual({
      link: "https://shop.example/create/code#c=ABCD23EFGH",
      qr: "https://shop.example/create/code?c=ABCD23EFGH",
    });
  });
  it("never sends the fragment form's code to the server (URL.search is empty)", () => {
    const u = new URL(signInLinks("https://shop.example", "ABCD23EFGH").link);
    expect(u.search).toBe("");
    expect(u.hash).toBe("#c=ABCD23EFGH");
  });
});

describe("readCodeFragment", () => {
  it("reads, trims and uppercases #c=", () => {
    expect(readCodeFragment("#c=abcd23efgh")).toBe("ABCD23EFGH");
    expect(readCodeFragment("#c=%20k9m%20")).toBe("K9M");
    expect(readCodeFragment("c=XYZ&next=/create")).toBe("XYZ");
  });
  it("is empty without a code and caps the length", () => {
    expect(readCodeFragment("")).toBe("");
    expect(readCodeFragment("#")).toBe("");
    expect(readCodeFragment("#top")).toBe("");
    expect(readCodeFragment(`#c=${"a".repeat(100)}`)).toHaveLength(64);
  });
});
