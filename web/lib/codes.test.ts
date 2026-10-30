import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, generateLoginCode, readCodePrefill, slugLookupPrefix, slugify, uniqueSlug } from "./codes";

describe("generateLoginCode", () => {
  it("is 10 characters from the alphabet without look-alikes", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateLoginCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });
  it("is not the same code twice in a small sample", () => {
    expect(new Set(Array.from({ length: 200 }, generateLoginCode)).size).toBe(200);
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Maya Ortiz")).toBe("maya-ortiz");
    expect(slugify("  June   Park!! ")).toBe("june-park");
    expect(slugify("Zoë O'Brien")).toBe("zoe-o-brien");
  });
  it("falls back to creator", () => {
    expect(slugify("")).toBe("creator");
    expect(slugify("***")).toBe("creator");
    expect(slugify("李明")).toBe("creator");
  });
  it("caps at 40 characters without a trailing hyphen", () => {
    const s = slugify("a".repeat(39) + " bcd");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s).not.toMatch(/-$/);
    expect(slugify("x".repeat(80))).toHaveLength(40);
  });
});

describe("uniqueSlug", () => {
  it("keeps a free slug", () => {
    expect(uniqueSlug("leo", ["maya"])).toBe("leo");
  });
  it("appends -2, -3 on collision", () => {
    expect(uniqueSlug("leo", ["leo"])).toBe("leo-2");
    expect(uniqueSlug("leo", ["leo", "leo-2", "leo-3"])).toBe("leo-4");
  });
  it("stays within 40 characters", () => {
    const base = "x".repeat(40);
    const s = uniqueSlug(base, [base]);
    expect(s).toBe(`${"x".repeat(38)}-2`);
  });
});

describe("slugLookupPrefix (40-character names)", () => {
  it("matches every slug uniqueSlug derives, so the third long name gets -3", () => {
    const base = slugify("Bartholomew Alexander Fitzgerald-Montgomery the Third of Riverbend");
    expect(base).toHaveLength(40);
    const second = uniqueSlug(base, [base]);
    expect(second).toBe(`${base.slice(0, 38)}-2`);
    const prefix = slugLookupPrefix(base);
    const many = [base, second];
    for (let n = 3; n <= 120; n++) many.push(uniqueSlug(base, many)); // up to -120
    for (const s of many) expect(s.startsWith(prefix)).toBe(true);
    expect(many.at(-1)).toBe(`${base.slice(0, 36)}-120`);
    // What the database lookup returns for the third add: both earlier slugs.
    const third = uniqueSlug(base, [base, second]);
    expect(third).toBe(`${base.slice(0, 38)}-3`);
  });
});

describe("readCodePrefill", () => {
  it("trims and uppercases ?c=", () => {
    expect(readCodePrefill({ c: "  abcd23 " })).toBe("ABCD23");
    expect(readCodePrefill({ c: ["k9m", "x"] })).toBe("K9M");
  });
  it("is empty when absent", () => {
    expect(readCodePrefill({})).toBe("");
    expect(readCodePrefill({ next: "/create" })).toBe("");
  });
  it("caps at 64 characters", () => {
    expect(readCodePrefill({ c: "a".repeat(100) })).toHaveLength(64);
  });
});
