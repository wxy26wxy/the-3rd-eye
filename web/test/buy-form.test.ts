import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { m } from "@/components/messages";
import type { BuyState } from "@/app/(site)/p/[id]/actions";

// The form reads its state from useActionState; feed it a chosen state so each placement renders.
const hoisted = vi.hoisted(() => ({ state: {} as BuyState, createOrder: vi.fn() }));
vi.mock("react", async (orig) => {
  const react = await orig<typeof import("react")>();
  return { ...react, useActionState: () => [hoisted.state, () => {}, false] };
});
vi.mock("@/lib/db/queries.contract", () => ({ createOrder: hoisted.createOrder }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));

const { BuyForm } = await import("@/components/product/BuyForm");
const { placeOrder } = await import("@/app/(site)/p/[id]/actions");

const render = (state: BuyState) => {
  hoisted.state = state;
  return renderToStaticMarkup(createElement(BuyForm, { action: async () => ({}), priceLabel: "Buy for $5.00" }));
};
const fd = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};
/** Index of the first role="alert" after the given field label, or -1. */
const alertAt = (out: string, text: string) => out.indexOf(`role="alert">${text}`);

describe("BuyForm error placement (T108, from the action's field)", () => {
  it("a note error renders under the note field, before the demo line", () => {
    const out = render({ error: m.product.noteRejected, field: "note" });
    const at = alertAt(out, m.product.noteRejected);
    expect(at).toBeGreaterThan(out.indexOf(m.product.buyNote));
    expect(at).toBeLessThan(out.indexOf(m.product.buyStaged));
    expect(out).toMatch(/<textarea[^>]*aria-invalid="true"/);
    expect(out.match(/role="alert"/g)).toHaveLength(1);
  });

  it("a generic error renders above the button, not under a field", () => {
    const out = render({ error: m.product.buyError, field: "form" });
    const at = out.indexOf(m.product.buyError);
    expect(at).toBeGreaterThan(out.indexOf(m.product.buyStaged));
    expect(at).toBeLessThan(out.indexOf('<button type="submit"'));
    expect(out).not.toMatch(/aria-invalid="true"/);
  });

  it("a name error renders under the name field", () => {
    const out = render({ error: m.product.nameRequired, field: "name" });
    const at = alertAt(out, m.product.nameRequired);
    expect(at).toBeGreaterThan(out.indexOf(m.product.buyName));
    expect(at).toBeLessThan(out.indexOf(m.product.buyEmail));
  });

  it("the placement follows the field even when the text is not a known note message", () => {
    const out = render({ error: "Something about the note.", field: "note" });
    expect(alertAt(out, "Something about the note.")).toBeLessThan(out.indexOf(m.product.buyStaged));
  });
});

describe("placeOrder action returns a typed field (T108)", () => {
  beforeEach(() => hoisted.createOrder.mockReset());
  const base = { buyerName: "Ann", buyerEmail: "", shipNote: "Leave it" };

  it("missing name → field name", async () => {
    expect(await placeOrder("p1", {}, fd({ ...base, buyerName: " " }))).toMatchObject({ field: "name", error: m.product.nameRequired });
  });
  it("bad email → field form", async () => {
    expect(await placeOrder("p1", {}, fd({ ...base, buyerEmail: "nope" }))).toMatchObject({ field: "form", error: m.product.buyError });
  });
  it("note rejected or unchecked → field note", async () => {
    hoisted.createOrder.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "note_rejected" }));
    expect(await placeOrder("p1", {}, fd(base))).toMatchObject({ field: "note", error: m.product.noteRejected });
    hoisted.createOrder.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "moderation_unavailable" }));
    expect(await placeOrder("p1", {}, fd(base))).toMatchObject({ field: "note", error: m.product.noteUnavailable });
  });
  it("other failures → field form", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    hoisted.createOrder.mockRejectedValueOnce(new Error("db down"));
    expect(await placeOrder("p1", {}, fd(base))).toMatchObject({ field: "form", error: m.product.buyError });
    spy.mockRestore();
  });
  it("success redirects to the confirmation", async () => {
    hoisted.createOrder.mockResolvedValueOnce({ orderId: "o1", token: "t" });
    await expect(placeOrder("p1", {}, fd(base))).rejects.toThrow("NEXT_REDIRECT");
  });
});
