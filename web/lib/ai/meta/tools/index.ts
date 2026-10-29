import { checkContrastTool } from "./check-contrast";
import { checkResolutionTool } from "./check-resolution";
import { finalizeListingTool } from "./finalize-listing";
import { moderateContentTool } from "./moderate-content";
import { suggestPriceTool } from "./suggest-price";
import type { ToolDef } from "./types";

export const LISTING_TOOLS: ToolDef[] = [checkResolutionTool, checkContrastTool, suggestPriceTool, moderateContentTool, finalizeListingTool];
export type { ToolContext, ToolDef } from "./types";

/** Responses API function-tool definitions (strict). */
export function toolSpecs(tools: ToolDef[] = LISTING_TOOLS) {
  return tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters, strict: true }));
}
