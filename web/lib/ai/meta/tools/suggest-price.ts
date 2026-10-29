import { PRICE_RANGES } from "@/lib/products/registry";
import { enumStr, obj } from "../responses";
import type { ToolContext, ToolDef } from "./types";

export type Complexity = "simple" | "medium" | "detailed";

/** Pure: sticker 400–700, tote 2200–3000 cents, by complexity; rounded to 50 cents. */
export function suggestPrice(productType: ToolContext["productType"], complexity: Complexity, creatorShareBps: number) {
  const { min, max } = PRICE_RANGES[productType];
  const f = complexity === "simple" ? 0 : complexity === "medium" ? 0.5 : 1;
  const price = Math.round((min + (max - min) * f) / 50) * 50;
  return { price_cents: price, range: { min, max }, creator_earns_cents: Math.round((price * creatorShareBps) / 10_000) };
}

export const suggestPriceTool: ToolDef = {
  name: "suggest_price",
  description: "Suggests a fair price in cents for the product from how complex the artwork is.",
  parameters: obj({ complexity: enumStr(["simple", "medium", "detailed"]) }),
  handler: async (args, ctx) => {
    const c = (args as { complexity?: string })?.complexity;
    const complexity: Complexity = c === "simple" || c === "detailed" ? c : "medium";
    return suggestPrice(ctx.productType, complexity, ctx.creatorShareBps);
  },
};
