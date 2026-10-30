/**
 * createCreator / rotateLoginCode against a fake Neon client (T070): unique violations are
 * retried with a fresh code, earlier long-name slugs are found, and unknown ids give null.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Call = { sql: string; params: unknown[] };
const calls: Call[] = [];
let respond: (c: Call) => { rows: unknown[][] } = () => ({ rows: [] });

vi.mock("@/lib/db/client", async () => {
  const { drizzle } = await import("drizzle-orm/neon-http");
  const schema = await import("./schema");
  const fake = {
    query: async (sql: string, params: unknown[]) => {
      const c = { sql, params };
      calls.push(c);
      return { ...respond(c), fields: [] };
    },
  };
  const db = drizzle(fake as never, { schema });
  return { getDb: () => db };
});

import { CODE_ALPHABET } from "@/lib/codes";
import { createCreator, rotateLoginCode } from "./queries";

const uniqueViolation = () => Object.assign(new Error("Failed query: insert …\nparams: …"), { cause: { code: "23505" } });
const isCode = (v: unknown): v is string => typeof v === "string" && v.length === 10 && [...v].every((ch) => CODE_ALPHABET.includes(ch));
const inserts = () => calls.filter((c) => c.sql.startsWith("insert"));
const updates = () => calls.filter((c) => c.sql.startsWith("update"));

beforeEach(() => { calls.length = 0; respond = () => ({ rows: [] }); });

describe("createCreator", () => {
  it("retries a unique violation with a new code and a not-yet-tried slug", async () => {
    let failed = false;
    respond = (c) => {
      if (c.sql.startsWith("insert") && !failed) { failed = true; throw uniqueViolation(); }
      return { rows: [] };
    };
    await createCreator({ displayName: "Test Artist", createdByTask: "T070" });
    const [first, second] = inserts();
    expect(inserts()).toHaveLength(2);
    const code1 = first.params.find(isCode), code2 = second.params.find(isCode);
    expect(code1).toBeTruthy();
    expect(code2).toBeTruthy();
    expect(code2).not.toBe(code1);
    expect(first.params).toContain("test-artist");
    expect(second.params).toContain("test-artist-2");
    expect(second.params).toContain(false); // isExample=false (and hidden default)
  });

  it("gives up after 5 unique violations", async () => {
    respond = (c) => { if (c.sql.startsWith("insert")) throw uniqueViolation(); return { rows: [] }; };
    await expect(createCreator({ displayName: "Leo", createdByTask: "T070" })).rejects.toThrow(/5 tries/);
    expect(inserts()).toHaveLength(5);
  });

  it("does not retry other errors", async () => {
    respond = (c) => { if (c.sql.startsWith("insert")) throw new Error("boom"); return { rows: [] }; };
    await expect(createCreator({ displayName: "Leo", createdByTask: "T070" })).rejects.toThrow();
    expect(inserts()).toHaveLength(1);
  });

  it("finds earlier -2 slugs of a 40-character name and picks -3", async () => {
    const base = "bartholomew-alexander-fitzgerald-montgom";
    expect(base).toHaveLength(40);
    respond = (c) => (c.sql.startsWith("select") ? { rows: [[base], [`${base.slice(0, 38)}-2`]] } : { rows: [] });
    await createCreator({ displayName: "Bartholomew Alexander Fitzgerald-Montgomery", createdByTask: "T070" });
    const lookup = calls.find((c) => c.sql.startsWith("select"))!;
    expect(lookup.params.some((p) => typeof p === "string" && `${base.slice(0, 38)}-2`.startsWith(p.replace(/%$/, "")) && p.endsWith("%"))).toBe(true);
    expect(inserts()[0].params).toContain(`${base.slice(0, 38)}-3`);
  });
});

describe("rotateLoginCode", () => {
  it("returns null for an unknown or deleted creator", async () => {
    expect(await rotateLoginCode("00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(updates()[0].sql).toMatch(/"deleted_at" is null/);
  });

  it("returns the new code when the row exists, retrying a code collision", async () => {
    let n = 0;
    respond = (c) => {
      if (c.sql.startsWith("update") && n++ === 0) throw uniqueViolation();
      return { rows: [["00000000-0000-0000-0000-000000000001"]] };
    };
    const code = await rotateLoginCode("00000000-0000-0000-0000-000000000001");
    expect(isCode(code)).toBe(true);
    expect(updates()).toHaveLength(2);
    expect(updates()[1].params).toContain(code);
  });
});
