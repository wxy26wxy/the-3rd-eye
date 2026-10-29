import sharp from "sharp";
import { obj } from "../responses";
import type { ToolDef } from "./types";

/** Pure: judges contrast from greyscale statistics (0–255). */
export function contrastFromStats(s: { min: number; max: number; stdev: number; mean: number }) {
  const range = s.max - s.min;
  const ok = s.stdev >= 25 && range >= 100;
  return {
    ok, stdev: Math.round(s.stdev), range, mean: Math.round(s.mean),
    message: ok ? "Good contrast: shapes will read clearly when printed." : "Low contrast: the design may look faint when printed.",
  };
}

export const checkContrastTool: ToolDef = {
  name: "check_contrast",
  description: "Measures the artwork's contrast (greyscale spread) to predict how clearly it prints.",
  parameters: obj({}),
  handler: async (_args, ctx) => {
    const stats = await sharp(await ctx.loadImage()).flatten({ background: "#ffffff" }).greyscale().stats();
    const c = stats.channels[0];
    return contrastFromStats({ min: c.min, max: c.max, stdev: c.stdev, mean: c.mean });
  },
};
