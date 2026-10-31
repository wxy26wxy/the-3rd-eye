import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fmt, m } from "@/components/messages";

// Fixture data for the states that cannot be reached on the shared database without writing to it.
vi.mock("@/lib/db/queries.contract", () => ({
  ORDER_STATUSES: ["placed", "printing", "shipped", "delivered"],
  listAdminOrders: async () => [],
  getArtworkTrace: async () => null,
  getOrderConfirmation: async () => null,
}));
vi.mock("@/components/site/origin", () => ({
  siteOrigin: async () => "https://example.test",
  storyTagPath: (t: string) => `/t/${t}`,
}));
vi.mock("@/app/admin/actions", () => ({
  addCreator: async () => ({}),
  rotateCreatorCode: async () => ({}),
  setCreatorHidden: async () => ({}),
  setOrderStatus: async () => ({}),
}));

const { OrdersTable } = await import("@/components/admin/OrdersTable");
const { CreatorsPanel, RotateConfirm } = await import("@/components/admin/CreatorsPanel");
const { TraceView } = await import("@/components/admin/TraceView");
const { OrderSuccess } = await import("@/components/product/OrderSuccess");
const { default: StoryTagNotFound } = await import("@/app/t/[token]/not-found");

const html = (el: ReactElement) => renderToStaticMarkup(el);
const c = m.admin.creators;

describe("Empty and missing states (T106 fix round 1)", () => {
  it("orders table with no orders: the grey empty card (board 2031:4384)", async () => {
    const out = html(await OrdersTable());
    expect(out).toMatch(new RegExp(`<p class="[^"]*empty[^"]*">${m.admin.empty}</p>`));
    expect(out).not.toContain("<table");
  });

  it("creators panel with no creators: the empty line, the Add creator form, the live region", () => {
    const out = html(createElement(CreatorsPanel, { creators: [] }));
    expect(out).toContain(c.empty);
    expect(out).not.toContain("<table");
    expect(out).toContain(`>${c.addTitle}</h3>`);
    expect(out).toContain(`>${c.displayName}</label>`);
    expect(out).toContain('aria-live="polite"');
    expect(out).toMatch(new RegExp(`<button type="submit"[^>]*>.*${c.add}`));
  });

  it("New code confirm: labelled group with the warning, the example note, Yes and Cancel", () => {
    const out = html(createElement(RotateConfirm, { id: "c1", name: "Rosa M.", isExample: true, action: () => {}, pending: false, onCancel: () => {} }));
    expect(out).toMatch(new RegExp(`role="group" aria-label="${fmt(c.newCodeLabel, { name: "Rosa M." })}"`));
    expect(out).toContain('name="creatorId" value="c1"');
    expect(out).toContain(fmt(c.rotateConfirm, { name: "Rosa M." }));
    expect(out).toContain(c.exampleNote);
    expect(out).toMatch(new RegExp(`<button type="submit"[^>]*>${c.rotateYes}</button>`));
    expect(out).toMatch(new RegExp(`<button type="button"[^>]*>${c.rotateCancel}</button>`));
    const plain = html(createElement(RotateConfirm, { id: "c1", name: "Leo", isExample: false, action: () => {}, pending: false, onCancel: () => {} }));
    expect(plain).not.toContain(c.exampleNote);
  });

  it("AI trace missing: the grey card and Back to orders (board 2034:4158)", async () => {
    const out = html(await TraceView({ params: Promise.resolve({ artworkId: "none" }) }));
    expect(out).toContain(m.admin.traceMissing);
    expect(out).toMatch(new RegExp(`href="/admin"[^>]*>.*${m.admin.backToOrders}`));
  });

  it("order success with no order: h1 with the missing line and Keep shopping only", async () => {
    const out = html(await OrderSuccess({ searchParams: Promise.resolve({ order: "nope" }) }));
    expect(out).toMatch(new RegExp(`<h1[^>]*>${m.success.missing}</h1>`));
    expect(out).toMatch(new RegExp(`href="/"[^>]*>.*${m.success.keepShopping}`));
    expect(out).not.toContain(m.success.openTag);
  });

  it("story tag not active: eyebrow, h1, Go to the shop, inside the site frame (board 2024:2556)", () => {
    const out = html(createElement(StoryTagNotFound));
    expect(out).toContain(`>${m.tag.eyebrow}</p>`);
    expect(out).toMatch(new RegExp(`<h1[^>]*>${m.tag.notFound}</h1>`));
    expect(out).toContain(m.notFound.home);
    expect(out.match(/<main/g)).toHaveLength(1);
    expect(out.match(/<header/g)).toHaveLength(1);
  });
});
