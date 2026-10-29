import { arr, obj, str } from "../responses";
import type { ToolDef } from "./types";

export const moderateContentTool: ToolDef = {
  name: "moderate_content",
  description: "Checks the proposed title, description and tags are safe and respectful to publish.",
  parameters: obj({ title: str(), description: str(), tags: arr(str()) }),
  handler: async (args, ctx) => {
    const a = (args ?? {}) as { title?: string; description?: string; tags?: string[] };
    return ctx.moderate({ title: String(a.title ?? ""), description: String(a.description ?? ""), tags: Array.isArray(a.tags) ? a.tags.map(String) : [] });
  },
};
