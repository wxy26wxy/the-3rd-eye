import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { fmt, m, money } from "@/components/messages";

const call = (id: string, stage: string, at: number) => ({
  id, jobId: null, stage, provider: "meta", model: stage === "edit" ? "muse-image-1.0" : "x", requestHash: "h", requestJson: {}, responseId: null,
  responseJson: {}, latencyMs: 10, costEstimateCents: null, artworkId: "child", listingId: null, error: null, createdAt: new Date(at), createdByTask: "T111",
});
const order = (over: Record<string, unknown>) => ({
  id: "o1234567-0000-0000-0000-000000000000", status: "placed", buyerName: "Ana", buyerEmail: null, shipNote: null, size: "4in", quantity: 2,
  amountCents: 1400, creatorShareCents: 700, createdAt: new Date(0),
  product: { id: "p1", title: "Bus", type: "sticker", mockupUrl: null, printPngUrl: null, printSvgUrl: null, artworkId: "a1" },
  creator: { displayName: "Leo", slug: "leo" }, token: null, tapCount: 0, messages: [], ...over,
});
vi.mock("@/lib/db/queries.contract", () => ({
  ORDER_STATUSES: ["placed", "printing", "shipped", "delivered"],
  listAdminOrders: async () => [order({}), order({ id: "o2", size: null, quantity: 3, product: { ...order({}).product, type: "tote" } })],
  getArtworkTrace: async () => ({
    artwork: {
      id: "child", source: "photo", transcript: "make the sky purple", shapedPrompt: null, originalUrl: "creators/c1/originals/e.png",
      cleanedUrl: "https://blob.example/cut.png", maskUrl: "creators/c1/masks/m.png", cutPathSvg: null, altText: "Bus", spokenDescription: "A bus under a purple sky.",
      differencesFromPrompt: "The sky is lilac.", parentArtworkId: "parent", changeInstruction: "make the sky purple", createdAt: new Date(0),
    },
    photo: { originalUrl: "creators/c1/originals/photo.png", maskUrl: null },
    changes: [{ id: "child", instruction: "make the sky purple", transcript: "make the sky purple", beforeUrl: "https://blob.example/before.png", afterUrl: "https://blob.example/after.png", differences: "The sky is lilac." }],
    variants: [],
    candidates: [{ id: "k1", url: "https://blob.example/t.png", altText: null, chosen: true }],
    calls: [call("s", "segment", 1), call("t", "transcribe", 2), call("e", "edit", 3), call("d", "describe", 4)],
  }),
}));
vi.mock("@/components/site/origin", () => ({ siteOrigin: async () => "https://example.test", storyTagPath: (t: string) => `/t/${t}` }));
vi.mock("@/app/admin/actions", () => ({ setOrderStatus: async () => ({}) }));

const { OrdersTable } = await import("@/components/admin/OrdersTable");
const { TraceView } = await import("@/components/admin/TraceView");
const html = (el: ReactElement) => renderToStaticMarkup(el);

describe("admin (T111)", () => {
  it("orders table shows size × qty and the sample pricing", async () => {
    const out = html(await OrdersTable());
    expect(out).toContain(fmt(m.admin.sizeQty, { size: m.product.sizes["4in"], quantity: 2 }));
    expect(out).toContain(fmt(m.admin.qtyOnly, { quantity: 3 }));
    expect(out).toContain(fmt(m.admin.samplePricing, { four: money(200), sheet: money(600) }).replace("'", "&#x27;"));
  });

  it("trace steps in the v0.8 order; edit calls sit under Edit instruction", async () => {
    const out = html(await TraceView({ params: Promise.resolve({ artworkId: "child" }) }));
    const titles = [m.admin.traceStepPhoto, m.admin.traceStepChange, m.admin.traceStepEdit, m.admin.traceStepBeforeAfter, m.admin.traceDescription, m.admin.traceStepDecision, m.admin.traceSticker];
    const at = titles.map((t) => out.indexOf(`</span>${t}</h2>`));
    expect(at.every((x) => x > 0)).toBe(true);
    expect([...at].sort((x, y) => x - y)).toEqual(at);
    const edit = out.indexOf("edit · muse-image-1.0");
    expect(edit).toBeGreaterThan(at[2]);
    expect(edit).toBeLessThan(at[3]);
    expect(out).toContain('src="https://blob.example/before.png"');
    expect(out).toContain('src="https://blob.example/after.png"');
    expect(out).toContain("make the sky purple");
    expect(out).toContain("/media/creators/c1/originals/photo.png");
  });
});
