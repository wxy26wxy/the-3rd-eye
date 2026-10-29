import { contrastFromStats, measureContrast } from "@/lib/products/checks";
import { obj } from "../responses";
import type { ToolDef } from "./types";

export { contrastFromStats };

export const checkContrastTool: ToolDef = {
  name: "check_contrast",
  description: "Measures the artwork's contrast (greyscale spread) to predict how clearly it prints.",
  parameters: obj({}),
  handler: async (_args, ctx) => measureContrast(await ctx.loadImage()),
};
