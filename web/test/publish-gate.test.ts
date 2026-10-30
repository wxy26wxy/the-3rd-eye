import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

type Row = Record<string, unknown>;
const state: {
  listing: Row | null; draftCopy: unknown; published: boolean; moderateCalls: unknown[];
  agentOut: { listing: Row; trace: Row[] }; printPng: Buffer | null; artPng: Buffer | null;
} = { listing: null, draftCopy: null, published: false, moderateCalls: [], agentOut: { listing: {}, trace: [] }, printPng: null, artPng: null };

vi.mock("@/lib/db/queries", () => ({
  getListing: async () => (state.listing ? { ...state.listing, draftCopy: state.draftCopy } : null),
  upsertListing: async (v: Row) => { state.listing = { ...state.listing, ...v }; if ("draftCopy" in v) state.draftCopy = v.draftCopy; return state.listing; },
  setListingDraftCopy: async (_id: string, copy: unknown) => { state.draftCopy = copy; },
  updateProduct: async (_id: string, patch: Row) => { state.published = patch.status === "published"; return { id: "p1", ...patch }; },
  getCreatorById: async () => ({ storyVideoUrl: "x", storyText: null, split: { creator_bps: 5000 } }),
  insertProduct: async () => null,
}));
vi.mock("@/lib/ai/registry", () => ({
  ai: async () => ({
    listingAgent: {
      run: async () => state.agentOut,
      moderate: async (text: Row) => { state.moderateCalls.push(text); return { ok: !String(text.title).includes("bad"), reason: "nope" }; },
    },
  }),
}));
vi.mock("@/lib/storage", () => ({
  storage: () => ({ read: async (p: string) => (p.includes("print") ? state.printPng! : state.artPng!) }),
  creatorPath: () => "",
}));

import { approveListing, runListingAgent } from "@/lib/pipeline/products";

const png = (w: number, h: number, contrasty = true) => sharp(Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/>` +
  (contrasty ? `<rect x="0" y="0" width="${w / 2}" height="${h}" fill="#000"/>` : "") + "</svg>",
)).png().toBuffer();

const draftProduct = { id: "p1", creatorId: "c1", type: "sticker", priceCents: 500, status: "draft", printPngUrl: "creators/c1/print/a.png", mockupUrl: null } as never;
const artwork = { id: "a1", cleanedUrl: "https://x.public.blob.vercel-storage.com/creators/c1/cleaned/a.png", altText: "A frog", source: "text2image" } as never;
const modelSays = (over: Row = {}, trace: Row[] = []) => {
  state.agentOut = { listing: { title: "Frog", description: "A frog.", tags: ["frog"], price_cents: 550, print_ok: true, notes: "", ...over }, trace };
};

describe("publish gate uses the server's tool results", () => {
  beforeEach(async () => {
    state.listing = null; state.draftCopy = null; state.published = false; state.moderateCalls = [];
    state.printPng = await png(1000, 1000); state.artPng = await png(400, 400);
  });

  it("model claims print_ok but its own check_resolution said no → print_ok false, approve 409", async () => {
    modelSays({ print_ok: true }, [{ step: 1, tool: "check_resolution", result: { ok: false, message: "Too small for a 3 in sticker" } }]);
    const { listing } = await runListingAgent(draftProduct, artwork);
    expect(listing.print_ok).toBe(false);
    expect((state.listing!.printCheck as Row).print_ok).toBe(false);
    await expect(approveListing(draftProduct, { approvedVia: "tap" })).rejects.toMatchObject({ status: 409, code: "print_check_failed" });
    expect(state.published).toBe(false);
  });

  it("model skipped the tools → the server measures the print file itself", async () => {
    state.printPng = await png(500, 500);
    modelSays({ print_ok: true });
    expect((await runListingAgent(draftProduct, artwork)).listing.print_ok).toBe(false);
    state.printPng = await png(1000, 1000);
    expect((await runListingAgent(draftProduct, artwork)).listing.print_ok).toBe(true);
    state.artPng = await png(400, 400, false); // flat white art: contrast fails
    expect((await runListingAgent(draftProduct, artwork)).listing.print_ok).toBe(false);
  });

  it("moderates the FINAL text when the agent moderated something else", async () => {
    modelSays({ title: "bad final title" }, [{ step: 1, tool: "moderate_content", args: { title: "Nice draft", description: "A frog." }, result: { ok: true, reason: "" } }]);
    await runListingAgent(draftProduct, artwork);
    expect(state.moderateCalls).toHaveLength(1);
    expect((state.listing!.moderation as Row).ok).toBe(false);
    await expect(approveListing(draftProduct, { approvedVia: "tap" })).rejects.toMatchObject({ code: "moderation_failed" });
  });

  it("moderates again when the agent checked other tags than the final ones", async () => {
    modelSays({ tags: ["frog", "bad tag"] }, [{ step: 1, tool: "moderate_content", args: { title: "Frog", description: "A frog.", tags: ["frog"] }, result: { ok: true, reason: "" } }]);
    await runListingAgent(draftProduct, artwork);
    expect(state.moderateCalls).toHaveLength(1);
    expect((state.moderateCalls[0] as Row).tags).toEqual(["frog", "bad tag"]);
  });

  it("reuses the agent's moderation when it checked exactly the final text", async () => {
    modelSays({ tags: ["pond", "frog"] }, [{ step: 1, tool: "moderate_content", args: { title: "Frog", description: "A frog.", tags: [" frog", "pond"] }, result: { ok: true, reason: "" } }]);
    await runListingAgent(draftProduct, artwork);
    expect(state.moderateCalls).toHaveLength(0);
    await approveListing(draftProduct, { approvedVia: "tap" });
    expect(state.published).toBe(true);
  });

  it("re-running on a published product keeps the live copy until approve", async () => {
    state.listing = { productId: "p1", title: "Live title", description: "Live.", tags: [], printCheck: { print_ok: true }, moderation: { ok: true, reason: "" }, approvedAt: new Date() };
    modelSays({ title: "New title" });
    await runListingAgent({ ...(draftProduct as object), status: "published" } as never, artwork);
    expect(state.listing.title).toBe("Live title");
    expect((state.draftCopy as Row).title).toBe("New title");
    await approveListing(draftProduct, { approvedVia: "tap" });
    expect(state.listing.title).toBe("New title");
    expect(state.draftCopy).toBeNull();
  });
});
