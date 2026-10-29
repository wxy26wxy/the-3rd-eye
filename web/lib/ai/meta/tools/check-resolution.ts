import { PRINT_SPECS } from "@/lib/products/registry";
import { obj } from "../responses";
import type { ToolContext, ToolDef } from "./types";

/** Pure: is the artwork big enough to print at the product's target size? */
export function checkResolution(ctx: Pick<ToolContext, "productType" | "width" | "height">) {
  const spec = PRINT_SPECS[ctx.productType];
  const short = Math.min(ctx.width, ctx.height);
  const maxPrintInches = Math.round((short / spec.dpi) * 10) / 10;
  const ok = short >= spec.minShortSidePx;
  return {
    ok, width: ctx.width, height: ctx.height, requiredShortSidePx: spec.minShortSidePx, maxPrintInches,
    message: ok
      ? `Sharp enough for a ${spec.targetInches} in ${ctx.productType} at ${spec.dpi} dpi.`
      : `Too small for a ${spec.targetInches} in ${ctx.productType}: short side ${short}px, needs ${spec.minShortSidePx}px.`,
  };
}

export const checkResolutionTool: ToolDef = {
  name: "check_resolution",
  description: "Checks whether the artwork has enough pixels to print sharply at the product's size.",
  parameters: obj({}),
  handler: async (_args, ctx) => checkResolution(ctx),
};
