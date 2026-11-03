import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { MAX_ITERATIONS, MetaListingAgent } from "@/lib/ai/meta/listing-agent";
import type { ResponsesLike } from "@/lib/ai/meta/client";
import { checkResolution } from "@/lib/ai/meta/tools/check-resolution";
import { contrastFromStats } from "@/lib/ai/meta/tools/check-contrast";
import { suggestPrice } from "@/lib/ai/meta/tools/suggest-price";
import { normalizeListing } from "@/lib/ai/meta/tools/finalize-listing";

describe("listing tool handlers (pure)", () => {
  it("check_resolution compares the cleaned art's short side, allowing one ×2, to the product spec (T134)", () => {
    expect(checkResolution({ productType: "sticker", width: 450, height: 1600 }).ok).toBe(true); // 450 × 2 = 900
    const small = checkResolution({ productType: "sticker", width: 449, height: 1200 });
    expect(small.ok).toBe(false);
    expect(small.requiredShortSidePx).toBe(900);
    expect(checkResolution({ productType: "tote", width: 749, height: 2000 }).ok).toBe(false);
    expect(checkResolution({ productType: "tote", width: 750, height: 2000 }).ok).toBe(true);
  });

  it("check_contrast passes a lightness spread ≥ 30 or chroma ≥ 25, warns otherwise", () => {
    expect(contrastFromStats({ lightnessSpread: 60, chroma: 0 }).ok).toBe(true);
    expect(contrastFromStats({ lightnessSpread: 5, chroma: 40 }).ok).toBe(true);
    const faint = contrastFromStats({ lightnessSpread: 12, chroma: 3 });
    expect(faint).toMatchObject({ ok: false, warning: true });
    expect(contrastFromStats({ lightnessSpread: 2, chroma: 1, mean: 49.6 }).ok).toBe(true); // dark piece
    expect(contrastFromStats({ lightnessSpread: 2, chroma: 1, mean: 50.4 }).ok).toBe(false);
  });

  it("suggest_price stays in range and scales with complexity", () => {
    expect(suggestPrice("sticker", "simple", 5000).price_cents).toBe(400);
    expect(suggestPrice("sticker", "detailed", 5000).price_cents).toBe(700);
    expect(suggestPrice("tote", "medium", 5000)).toMatchObject({ price_cents: 2600, creator_earns_cents: 1300 });
    expect(suggestPrice("sticker", "medium", 3337).creator_earns_cents).toBe(183); // 183.5 rounds down, like order shares
  });

  it("normalizeListing clamps price, trims and caps tags", () => {
    const l = normalizeListing({ title: "  Frog  ", description: "d", tags: Array(12).fill("Tag"), price_cents: 99999, print_ok: true, notes: "" }, "sticker");
    expect(l).toMatchObject({ title: "Frog", price_cents: 700, print_ok: true });
    expect(l.tags).toHaveLength(8);
  });
});

/** Fake Responses client replaying a scripted transcript; records every request. */
function scripted(replies: unknown[] | ((i: number, body: Record<string, unknown>) => unknown)) {
  const calls: Record<string, unknown>[] = [];
  const client: ResponsesLike = {
    create: async (body) => {
      calls.push(body);
      const i = calls.length - 1;
      return typeof replies === "function" ? replies(i, body) : replies[i];
    },
  };
  return { client, calls };
}
const fc = (id: string, name: string, args: unknown) => ({ type: "function_call", call_id: id, name, arguments: JSON.stringify(args) });
const resp = (id: string, output: unknown[]) => ({ id, output });
const textResp = (id: string, text: string) => ({ id, output: [{ type: "message", content: [{ type: "output_text", text }] }] });

async function ctx() {
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#000" } })
    .composite([{ input: Buffer.from('<svg width="64" height="64"><rect width="32" height="64" fill="#fff"/></svg>') }]).png().toBuffer();
  return {
    productId: "p1", productType: "sticker" as const, altText: "A green frog with a crown",
    imageUrl: `data:image/png;base64,${png.toString("base64")}`, width: 1600, height: 1600, creatorShareBps: 5000,
  };
}
const trace = { stage: "listing" };

describe("listing agent loop", () => {
  it("runs tools, replies with function_call_output + previous_response_id, and stops at finalize", async () => {
    const draft = { title: "Frog King", description: "A frog.", tags: ["frog"], price_cents: 550, print_ok: true, notes: "" };
    const { client, calls } = scripted([
      resp("r1", [fc("c1", "check_resolution", {}), fc("c2", "check_contrast", {})]),
      resp("r2", [fc("c3", "suggest_price", { complexity: "medium" })]),
      resp("r3", [fc("c4", "moderate_content", { title: "Frog King", description: "A frog.", tags: ["frog"] })]),
      textResp("m1", JSON.stringify({ ok: true, reason: "Fine." })), // moderation second call
      resp("r4", [fc("c5", "finalize_listing", draft)]),
    ]);
    const agent = new MetaListingAgent(client);
    const out = await agent.run(await ctx(), { trace });
    expect(out.listing).toEqual(draft);
    expect(out.trace.map((s) => s.tool)).toEqual(["check_resolution", "check_contrast", "suggest_price", "moderate_content", "finalize_listing"]);
    expect(out.trace[1].result).toMatchObject({ ok: true });
    expect(out.trace[3].result).toEqual({ ok: true, reason: "Fine." });
    expect(calls).toHaveLength(5);
    expect(calls[0]).toMatchObject({ tool_choice: "auto" });
    expect(calls[1]).toMatchObject({ previous_response_id: "r1" });
    expect(calls[1].input).toEqual([
      expect.objectContaining({ type: "function_call_output", call_id: "c1" }),
      expect.objectContaining({ type: "function_call_output", call_id: "c2" }),
    ]);
    expect(calls[4]).toMatchObject({ previous_response_id: "r3" });
  });

  it("caps the loop at MAX_ITERATIONS and forces a final strict-JSON listing", async () => {
    const forced = { title: "Forced", description: "d", tags: [], price_cents: 10, print_ok: false, notes: "n" };
    const { client, calls } = scripted((i, body) =>
      body.text ? textResp("final", JSON.stringify(forced)) : resp(`r${i}`, [fc(`c${i}`, "check_resolution", {})]));
    const out = await new MetaListingAgent(client).run(await ctx(), { trace });
    const loopCalls = calls.filter((c) => !c.text);
    expect(loopCalls).toHaveLength(MAX_ITERATIONS);
    expect(calls).toHaveLength(MAX_ITERATIONS + 1);
    const last = calls[calls.length - 1];
    expect(last).toMatchObject({ previous_response_id: `r${MAX_ITERATIONS - 1}` });
    expect(last.input).toEqual(expect.arrayContaining([expect.objectContaining({ type: "function_call_output", call_id: `c${MAX_ITERATIONS - 1}` })]));
    expect(out.listing).toMatchObject({ title: "Forced", price_cents: 400 }); // clamped into the sticker range
    expect(out.trace.filter((s) => s.tool === "check_resolution")).toHaveLength(MAX_ITERATIONS);
    expect(out.trace.at(-1)?.text).toMatch(/forced/i);
  });

  it("forces a final listing when the model answers in text without finalizing", async () => {
    const forced = { title: "T", description: "d", tags: ["a"], price_cents: 500, print_ok: true, notes: "" };
    const { client, calls } = scripted([textResp("r1", "Here is my idea."), textResp("f", JSON.stringify(forced))]);
    const out = await new MetaListingAgent(client).run(await ctx(), { trace });
    expect(calls).toHaveLength(2);
    expect(out.listing.title).toBe("T");
    expect(out.trace[0].text).toBe("Here is my idea.");
  });
});
