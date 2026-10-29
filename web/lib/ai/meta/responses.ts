/**
 * Helpers for Responses API payloads: strict JSON schemas, output extraction,
 * function calls, image results, image inputs. Pure functions (no network).
 */
import type { ImageRef } from "../types";

export type JsonSchema = Record<string, unknown>;

/** Strict object: additionalProperties false and every property required (Meta strict-mode rules). */
export function obj(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: "object", additionalProperties: false, properties, required: Object.keys(properties) };
}
export const str = (description?: string): JsonSchema => (description ? { type: "string", description } : { type: "string" });
export const nullableStr = (description?: string): JsonSchema => ({ type: ["string", "null"], ...(description ? { description } : {}) });
export const int = (description?: string): JsonSchema => ({ type: "integer", ...(description ? { description } : {}) });
export const bool = (description?: string): JsonSchema => ({ type: "boolean", ...(description ? { description } : {}) });
export const arr = (items: JsonSchema): JsonSchema => ({ type: "array", items });
export const enumStr = (values: string[]): JsonSchema => ({ type: "string", enum: values });

export function strictFormat(name: string, schema: JsonSchema) {
  return { format: { type: "json_schema", name, schema, strict: true } };
}

type OutputItem = { type?: string; content?: { type?: string; text?: string }[]; result?: string | null; call_id?: string; name?: string; arguments?: string; id?: string };
type ResponseShape = { id?: string; output_text?: string; output?: OutputItem[] };

export function responseId(resp: unknown): string {
  return (resp as ResponseShape)?.id ?? "";
}

export function outputText(resp: unknown): string {
  const r = resp as ResponseShape;
  if (typeof r?.output_text === "string" && r.output_text.length > 0) return r.output_text;
  return (r?.output ?? [])
    .flatMap((item) => (item.type === "message" ? item.content ?? [] : []))
    .filter((c) => c.type === "output_text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("");
}

/** Parses the JSON text output; tolerates a ```json fence. */
export function parseJsonOutput<T>(resp: unknown): T {
  const text = outputText(resp).trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  if (!text) throw new Error("Model returned no text output");
  return JSON.parse(text) as T;
}

export type FunctionCall = { callId: string; name: string; args: unknown; rawArgs: string };

export function functionCalls(resp: unknown): FunctionCall[] {
  return ((resp as ResponseShape)?.output ?? [])
    .filter((item) => item.type === "function_call")
    .map((item) => {
      let args: unknown = {};
      try {
        args = JSON.parse(item.arguments || "{}");
      } catch {
        args = { _unparsed: item.arguments };
      }
      return { callId: item.call_id ?? item.id ?? "", name: item.name ?? "", args, rawArgs: item.arguments ?? "" };
    });
}

/** Base64 PNGs from `image_generation_call` output items. */
export function imageResults(resp: unknown): string[] {
  return ((resp as ResponseShape)?.output ?? [])
    .filter((item) => item.type === "image_generation_call" && typeof item.result === "string" && item.result.length > 0)
    .map((item) => item.result as string);
}

export function imageUrlOf(ref: ImageRef): string {
  if (ref.base64) return `data:${ref.mime ?? "image/png"};base64,${ref.base64}`;
  if (ref.url) return ref.url;
  throw new Error("ImageRef needs url or base64");
}

export function inputImage(ref: ImageRef) {
  return { type: "input_image", image_url: imageUrlOf(ref), detail: "auto" };
}

export function userMessage(content: unknown[]) {
  return { role: "user", content };
}
