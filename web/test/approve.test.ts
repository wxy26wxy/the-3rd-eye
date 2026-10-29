import { beforeEach, describe, expect, it, vi } from "vitest";

type Listing = Record<string, unknown>;
const state: { listing: Listing | null; published: boolean; moderateCalls: unknown[]; moderateResult: { ok: boolean; reason: string } } = {
  listing: null, published: false, moderateCalls: [], moderateResult: { ok: true, reason: "" },
};
vi.mock("@/lib/db/queries", () => ({
  getListing: async () => state.listing,
  upsertListing: async (v: Listing) => { state.listing = { ...state.listing, ...v }; return state.listing; },
  updateProduct: async (_id: string, patch: Listing) => { state.published = patch.status === "published"; return { id: "p1", ...patch }; },
  getCreatorById: async () => ({ storyVideoUrl: null }),
  getArtwork: async () => null, insertProduct: async () => null,
}));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({ listingAgent: { moderate: async (text: unknown) => { state.moderateCalls.push(text); return state.moderateResult; } } }),
}));
vi.mock("@/lib/storage", () => ({ storage: () => ({}), creatorPath: () => "" }));

import { approveListing } from "@/lib/pipeline/products";

const product = { id: "p1", creatorId: "c1", type: "sticker", priceCents: 500 } as never;
const base = { productId: "p1", title: "Frog", description: "A frog.", tags: ["frog"], priceSuggestionCents: 550, printCheck: { print_ok: true }, moderation: { ok: true, reason: "" } };

describe("approveListing gates", () => {
  beforeEach(() => { state.listing = { ...base }; state.published = false; state.moderateCalls = []; state.moderateResult = { ok: true, reason: "" }; });

  it("publishes a listing that passed print check and moderation", async () => {
    const out = await approveListing(product, { approvedVia: "tap" });
    expect(state.published).toBe(true);
    expect(out.storyVideoNeeded).toBe(true);
    expect(state.moderateCalls).toHaveLength(0);
  });

  it("409 print_check_failed when the print check failed", async () => {
    state.listing = { ...base, printCheck: { print_ok: false, notes: "Too small" } };
    await expect(approveListing(product, { approvedVia: "tap" })).rejects.toMatchObject({ status: 409, code: "print_check_failed" });
    expect(state.published).toBe(false);
  });

  it("409 moderation_failed when the agent's moderation failed, even with edits", async () => {
    state.listing = { ...base, moderation: { ok: false, reason: "Not allowed" } };
    await expect(approveListing(product, { approvedVia: "tap" })).rejects.toMatchObject({ status: 409, code: "moderation_failed" });
    state.moderateResult = { ok: false, reason: "Still not allowed" };
    await expect(approveListing(product, { approvedVia: "voice", edits: { title: "Cleaner title" } })).rejects.toMatchObject({ status: 409, code: "moderation_failed" });
    expect(state.published).toBe(false);
  });

  it("re-moderates edited text, so edits cannot bypass the check", async () => {
    state.moderateResult = { ok: false, reason: "Edited text is not allowed" };
    await expect(approveListing(product, { approvedVia: "tap", edits: { description: "something bad" } })).rejects.toMatchObject({ code: "moderation_failed" });
    expect(state.moderateCalls).toHaveLength(1);
    state.moderateResult = { ok: true, reason: "" };
    await approveListing(product, { approvedVia: "tap", edits: { title: "Frog King" } });
    expect(state.published).toBe(true);
    expect(state.listing?.title).toBe("Frog King");
  });

  it("moderates before publishing when no moderation result exists", async () => {
    state.listing = { ...base, moderation: null };
    await approveListing(product, { approvedVia: "tap" });
    expect(state.moderateCalls).toHaveLength(1);
  });
});
