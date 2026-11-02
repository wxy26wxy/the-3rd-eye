import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/db/queries.contract", () => ({ createOrder: hoisted.createOrder }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));

const { placeOrder } = await import("@/app/(site)/p/[id]/actions");
const { m } = await import("@/components/messages");

const fd = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};

beforeEach(() => {
  hoisted.createOrder.mockReset();
  hoisted.createOrder.mockResolvedValue({ orderId: "o1", token: "TOKEN" });
});

describe("product page placeOrder action: size and quantity (T111)", () => {
  it("passes the picked size and quantity to createOrder", async () => {
    await expect(placeOrder("p1", {}, fd({ buyerName: "Ana", buyerEmail: "", shipNote: "", size: "sheet", quantity: "2" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(hoisted.createOrder).toHaveBeenCalledWith("p1", { buyerName: "Ana", buyerEmail: undefined, shipNote: undefined, size: "sheet", quantity: 2 }, { task: "T111" });
  });
  it("defaults: no size field = product default, no quantity = 1", async () => {
    await expect(placeOrder("p1", {}, fd({ buyerName: "Ana" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(hoisted.createOrder.mock.calls[0][1]).toMatchObject({ size: undefined, quantity: 1 });
  });
  it("an unknown size or a bad quantity is a form error, and nothing is ordered", async () => {
    const bads: Record<string, string>[] = [{ size: "huge" }, { quantity: "0" }, { quantity: "11" }, { quantity: "two" }];
    for (const bad of bads) {
      const out = await placeOrder("p1", {}, fd({ buyerName: "Ana", ...bad }));
      expect(out).toMatchObject({ field: "form", error: m.product.sizeInvalid });
    }
    expect(hoisted.createOrder).not.toHaveBeenCalled();
  });
  it("a size the product does not have (server invalid_size) is a form error with the values kept", async () => {
    hoisted.createOrder.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "invalid_size" }));
    const out = await placeOrder("p1", {}, fd({ buyerName: "Ana", size: "4in", quantity: "1" }));
    expect(out).toMatchObject({ field: "form", error: m.product.sizeInvalid, values: { size: "4in", quantity: "1" } });
  });
});
