/** T134: the unique (creator, clientRequestId) index settles a race; the loser returns the winner's row. */
import { describe, expect, it, vi } from "vitest";

const dupe = Object.assign(new Error("insert failed"), { cause: { code: "23505" } });
vi.mock("@/lib/db/queries", () => ({
  isUniqueViolation: (e: unknown) => (e as { cause?: { code?: string } }).cause?.code === "23505",
  getArtworkByClientRequest: async () => ({ id: "winner", parentArtworkId: "a1", deletedAt: null, altText: "A", spokenDescription: "S", differencesFromPrompt: null }),
  getProductByClientRequest: async () => ({ id: "prW", artworkId: "a1", type: "sticker", deletedAt: new Date(0) }),
}));

import { descriptionOf, existingChange, existingProduct, insertOnce } from "@/lib/pipeline/idempotency";

describe("insertOnce", () => {
  it("returns the inserted row when there is no race", async () => {
    expect(await insertOnce("k", async () => "new", async () => "old")).toEqual({ row: "new", repeated: false });
  });
  it("on a unique violation with a key, returns the winner's row as a repeat", async () => {
    expect(await insertOnce("k", async () => { throw dupe; }, async () => "winner")).toEqual({ row: "winner", repeated: true });
  });
  it("rethrows other errors, and a unique violation without a key", async () => {
    await expect(insertOnce("k", async () => { throw new Error("boom"); }, async () => "x")).rejects.toThrow("boom");
    await expect(insertOnce(null, async () => { throw dupe; }, async () => "x")).rejects.toBe(dupe);
  });
});

describe("existing rows", () => {
  it("a change child of the same parent is returned; another parent is a conflict", async () => {
    expect((await existingChange("c1", "k", "a1"))?.id).toBe("winner");
    await expect(existingChange("c1", "k", "other")).rejects.toMatchObject({ status: 409, code: "client_request_conflict" });
  });
  it("a deleted product with the key is a conflict (the key is spent)", async () => {
    await expect(existingProduct("c1", "k", "a1", "sticker")).rejects.toMatchObject({ status: 409 });
  });
  it("descriptionOf rebuilds the change description from the row", async () => {
    const row = await existingChange("c1", "k", "a1");
    expect(descriptionOf(row!)).toMatchObject({ alt_text: "A", spoken: "S", differences_from_prompt: "" });
  });
});
