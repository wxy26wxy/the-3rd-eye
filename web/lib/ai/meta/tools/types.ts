import type { JsonSchema } from "../responses";

export type ToolContext = {
  productType: "sticker" | "tote";
  width: number;
  height: number;
  creatorShareBps: number;
  loadImage: () => Promise<Buffer>;
  moderate: (text: { title: string; description: string; tags: string[] }) => Promise<{ ok: boolean; reason: string }>;
};

export type ToolDef = {
  name: string;
  description: string;
  parameters: JsonSchema;
  handler: (args: unknown, ctx: ToolContext) => Promise<unknown>;
};
