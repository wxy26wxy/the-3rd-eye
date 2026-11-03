import { checkResolution } from "@/lib/products/checks";
import { obj } from "../responses";
import type { ToolDef } from "./types";

export { checkResolution };

export const checkResolutionTool: ToolDef = {
  name: "check_resolution",
  description: "Checks whether the cut-out artwork has enough pixels (allowing one 2x upscale) to print sharply at the product's size.",
  parameters: obj({}),
  handler: async (_args, ctx) => checkResolution(ctx),
};
