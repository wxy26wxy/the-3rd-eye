import { contrastFromStats, measureContrast } from "@/lib/products/checks";
import { obj } from "../responses";
import type { ToolDef } from "./types";

export { contrastFromStats };

export const checkContrastTool: ToolDef = {
  name: "check_contrast",
  description: "Measures the artwork's colour contrast (lightness spread and colourfulness of its opaque pixels) to predict how clearly it prints; a low result is a warning, not a block.",
  parameters: obj({}),
  handler: async (_args, ctx) => measureContrast(await ctx.loadImage()),
};
