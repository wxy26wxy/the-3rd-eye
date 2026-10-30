import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { mode: "ok" as "ok" | "reject" | "down", inserted: [] as unknown[], orders: [] as unknown[] };
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    moderator: {
      checkNote: async () => {
        if (state.mode === "down") throw new Error("upstream 502 from the model provider");
        return { ok: state.mode === "ok", reason: "" };
      },
    },
  }),
}));
vi.mock("@/lib/db/queries", () => ({
  getOrderIdForToken: async () => ({ orderId: "o1", creatorId: "c1" }),
  insertMessage: async (v: unknown) => { state.inserted.push(v); return { id: "m1", ...(v as object) }; },
  touchOrder: async () => undefined,
  tapNfcToken: async () => 1,
  getPublicProduct: async () => ({ product: { creatorId: "c1", priceCents: 1000 } }),
  getCreatorById: async () => ({ id: "c1", split: { creator_bps: 5000, org_bps: 3000 } }),
  insertOrderWithToken: async (v: unknown) => { state.orders.push(v); return { token: "ABCDEFGH2345" }; },
}));
vi.mock("@/lib/notify/polling", () => ({ notifyBuyerMessage: async () => undefined, notifyNewOrder: async () => undefined }));

import { NOTE_UNAVAILABLE, sendReply } from "@/lib/pipeline/public";
import { placeOrder, SHIP_NOTE_UNAVAILABLE } from "@/lib/payments/staged";

const TOKEN = "ABCDEFGH2345";

describe("buyer-note moderation", () => {
  beforeEach(() => { state.mode = "ok"; state.inserted = []; state.orders = []; });

  it("story-tag note: provider outage → 503 moderation_unavailable, nothing stored", async () => {
    state.mode = "down";
    await expect(sendReply(TOKEN, "Thank you!")).rejects.toMatchObject({ status: 503, code: "moderation_unavailable", message: NOTE_UNAVAILABLE });
    expect(state.inserted).toHaveLength(0);
  });

  it("story-tag note: rejected → 422 note_rejected; ok → stored", async () => {
    state.mode = "reject";
    await expect(sendReply(TOKEN, "mean")).rejects.toMatchObject({ status: 422, code: "note_rejected" });
    state.mode = "ok";
    await sendReply(TOKEN, "Thank you!");
    expect(state.inserted).toHaveLength(1);
  });

  it("ship note: provider outage → 503 with the 'remove the note' hint, no order; no note → no moderation", async () => {
    state.mode = "down";
    await expect(placeOrder("p1", { buyerName: "Ann", shipNote: "Leave at the door" }))
      .rejects.toMatchObject({ status: 503, code: "moderation_unavailable", message: SHIP_NOTE_UNAVAILABLE });
    expect(SHIP_NOTE_UNAVAILABLE).toMatch(/Remove the note and try again/);
    expect(state.orders).toHaveLength(0);
    await placeOrder("p1", { buyerName: "Ann" });
    expect(state.orders).toHaveLength(1);
  });
});
