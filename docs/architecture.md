# Architecture

One Next.js app (`web/`) on Vercel serves the shop, story-tag pages, admin, and `/api/v1` for the iOS app. Neon Postgres via Drizzle. Vercel Blob for files (public store for shop images; private store for originals, print files, videos). All model calls go through `web/lib/ai` and are traced to the `ai_calls` table.

## Model map (exact ids)
| Stage | Model | Endpoint |
|---|---|---|
| Speech → text | `muse-voice-transcribe-1.0` | `POST https://api.meta.ai/v1/asr/transcribe` (multipart; plain fetch) |
| Shape prompt, describe images, listing agent, prompts | `muse-spark-1.3` | Responses API `POST https://api.meta.ai/v1/responses` |
| Generate / refine / compose images | `muse-image-1.0` | Responses API (`previous_response_id` for refine) or `/v1/images/*` |
| Find & cut out drawings | `sam-3.1` | Responses API, `stream: true`, parsed with `@meta-sam/parser` |
| Story / thank-you drafts (open weights) | `muse-glimmer` (Muse Glimmer 30B, Apache-2.0) | Ollama OpenAI-compatible `${OLLAMA_BASE_URL}/chat/completions`, default `http://localhost:11434/v1`; falls back to `muse-spark-1.3` |

Status of request shapes: **UNVERIFIED until the first live call** (keys pending). Each module records `verified: <date>` in its header comment once a live probe succeeds; `scripts/probe_*.ts` perform the probes and write fixtures.

## Facts that shaped the code
- Meta Model API: `Authorization: Bearer $META_API_KEY`; OpenAI SDK works with `baseURL: https://api.meta.ai/v1`. Keys stay server-side.
- Strict JSON schema: `additionalProperties: false` everywhere, every property in `required`, no `oneOf`/`allOf`, ≤ 10 nesting levels.
- Muse Image: `size` only sets aspect ratio; native resolution is fixed (measure on first call); **no transparent output and no masks** → generate on pure white, cut with SAM. `output_format: png`. Multiple `input_image` parts allowed for composition/style anchoring.
- SAM 3.1: one text phrase per request; returns every instance; streaming special tokens; the API never emits `response.output_text.done`, so stop on `response.completed`. Parser: `decode_mask_to_raster`, `decode_mask_to_rle`, `decode_mask_to_svg_path` (JS names may differ — check the package).
- Spark tool calling: `tool_choice` accepts only `"auto"`; parallel calls on by default; reply with `function_call_output` + `previous_response_id`.
- `reasoning.effort`: minimal | low | medium | high | xhigh | max.
- Ollama (Muse Glimmer): OpenAI-compatible chat completions at `OLLAMA_BASE_URL`; ask for JSON via `response_format: { type: "json_object" }` plus a schema in the system prompt and validate with zod; 30 s timeout, 1 retry; when unreachable or invalid, fall back to Spark 1.3 and record `provider: "meta-fallback"`.
- There is no Meta text-to-speech model; descriptions are spoken on-device.
- Vercel: Node runtime by default; 4.5 MB request body cap; Hobby `maxDuration` 300 s; `proxy.ts` (not `middleware.ts`) in Next 16.

## Storage
- Public store `maker-story-public` → `BLOB_READ_WRITE_TOKEN` (linked).
- Private store `maker-story-private` → created; link it in the Vercel dashboard with env prefix `BLOB_PRIVATE` so `BLOB_PRIVATE_READ_WRITE_TOKEN` exists. Until then `lib/storage` falls back to the public store with unguessable hashed pathnames and logs a warning at startup.

## Env vars
`META_API_KEY`, `OLLAMA_BASE_URL`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `BLOB_PRIVATE_READ_WRITE_TOKEN`, `CREATOR_SESSION_SECRET`, `ADMIN_PASSWORD`, `PAYMENTS_MODE`, `NEXT_PUBLIC_SITE_URL`, `AI_FIXTURES`, `AI_STORY`.
