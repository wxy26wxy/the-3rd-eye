# Architecture

One Next.js app (`web/`) on Vercel serves the shop, story-tag pages, admin, and `/api/v1` for the iOS app. Neon Postgres via Drizzle. Vercel Blob for files (public store for shop images; private store for originals, print files, videos). All model calls go through `web/lib/ai` and are traced to the `ai_calls` table.

## Model map (exact ids)
| Stage | Model | Endpoint |
|---|---|---|
| Speech → text | `muse-voice-transcribe-1.0` | `POST https://api.meta.ai/v1/asr/transcribe` (multipart; plain fetch) |
| Shape prompt, describe images, listing agent, prompts | `muse-spark-1.3` | Responses API `POST https://api.meta.ai/v1/responses` |
| Generate / refine / compose images | `muse-image-1.0` | Responses API (`previous_response_id` for refine) or `/v1/images/*` |
| Find & cut out drawings | `sam-3.1` | Responses API, `stream: true`, parsed with `@meta-sam/parser` |
| Story / thank-you drafts (open weights) | `muse-glimmer` (Muse Glimmer 30B, Apache-2.0) | Ollama on the development Mac, in this order: native `POST <OLLAMA_BASE_URL without /v1>/api/chat` (JSON Schema `format`), then OpenAI-compatible `${OLLAMA_BASE_URL}/chat/completions` (default `http://localhost:11434/v1`), then `muse-spark-1.3` (`provider: "meta-fallback"`, always on Vercel) |

Status of request shapes: all live-verified on 2026-10-28 except where the table at the bottom says otherwise. Each module records `verified: <date>` in its header comment once a live probe succeeds; `scripts/probe_*.ts` perform the probes and write fixtures.

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
- Private store `maker-story-private` → linked with prefix `BLOB_PRIVATE`. Private stores have no read/write token: `lib/storage` selects it with `storeId: BLOB_PRIVATE_STORE_ID` and OIDC credentials (the SDK reads `VERCEL_OIDC_TOKEN` locally via `@vercel/oidc`; on Vercel it is automatic), `access: "private"`. Short-lived read URLs come from `issueSignedToken` + `presignUrl`. Only when `BLOB_PRIVATE_STORE_ID` is absent does it fall back to the public store under `private/<sha256(pathname)>.<ext>` (logged once). Verified live 2026-10-28 (put, write-once, read, presigned GET, delete).
- What goes where: public = cleaned art, thumbs, mockups, client uploads (`POST /uploads` uses the public token: story videos, thank-you media and caption soundtracks are public by design under unguessable pathnames; photo uploads are deleted once the private original exists); private = generated/photo originals, masks, print PNG (stickers and totes), die-cut SVG. Where `docs/api.md` calls `storyVideoUrl` and thank-you `videoUrl` "private pathnames", read "pathnames served through `/media`": they live in the public store today. The database stores logical pathnames for private files; `/media/<pathname>` serves them (rules in docs/api.md "Clarifications").

## Env vars
`META_API_KEY`, `OLLAMA_BASE_URL`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `BLOB_PRIVATE_STORE_ID`, `VERCEL_OIDC_TOKEN` (local only), `CREATOR_SESSION_SECRET`, `ADMIN_PASSWORD`, `PAYMENTS_MODE`, `NEXT_PUBLIC_SITE_URL`, `AI_FIXTURES`, `AI_STORY`, `FFMPEG_PATH` (optional, local audio conversion).

## Live findings (backend, 2026-10-28)
- **Voice Transcribe**: multipart parts `request` (JSON `{ "model": "muse-voice-transcribe-1.0", "audioEncoding": "WAV" }`) and `audio` (the file). `WAV` is the only accepted `audioEncoding` (MP3, M4A, AAC, MP4, OGG, WEBM, FLAC, OPUS, LINEAR16… → "Malformed request"). Response `{ sessionId, transcript, audioDurationMs, turns: [] }`; no timestamps, so captions spread cues over `audioDurationMs`. Unknown request fields are ignored.
- **Muse Image**: Responses API with `tools: [{ type: "image_generation", output_format: "png", size: "1024x1024" }]` works; output items are `reasoning`, an empty `message`, and `image_generation_call` with base64 PNG in `result`. Native resolution **1600×1600** regardless of `size`. Generate ≈ 8 s, refine (`previous_response_id`) ≈ 16 s, compose with two `input_image` parts ≈ 16 s. It tends to draw its own white sticker border; SAM cuts the subject inside it.
- **SAM 3.1**: `stream: true` with one user message `[input_image (data URL), input_text phrase]` and `metadata.include_confidence: "true"`. Events: created, in_progress, output_item.added, content_part.added, output_text.delta, output_text.done, content_part.done, output_item.done, completed. `@meta-sam/parser` exports `parseImageStream`, `recordsOfKind`, `decodeMaskToRaster`, `decodeMaskToRLE`, `decodeMaskToSVGPath`, `buildObjectPrompt` (camelCase). The mask raster covers the record's `bounds`; `lib/ai/meta/sam.ts` places it in the full frame. Images are downscaled to ≤ 2048 px for the request and masks scaled back.
- **Muse Spark 1.3**: strict `json_schema` and `reasoning.effort` work; output = `reasoning` item + `message` with `output_text`. The listing agent's function tools, `function_call_output` + `previous_response_id`, and `tool_choice: "auto"` work end to end (5 tool calls in 4 turns on the smoke run).
- **Ollama / Muse Glimmer**: via `/v1/chat/completions` the model spends 100–300 tokens on `message.reasoning` before `content`; with `max_tokens` < ~400 content is empty (`finish_reason: "length"`), so the compatible route uses `max_tokens: 1500` and `reasoning_effort: "low"`. The native `POST /api/chat` with `think: false, stream: false, format: "json", options.num_predict: 400` returns clean JSON in ~16 tokens plus a literal trailing `<|eot|>` (stripped before `JSON.parse`). Order: native → `/v1` → Spark fallback (`provider: "meta-fallback"`). `ai_calls.provider` is `ollama` for both Ollama routes.
- **Deadlines**: every Meta call has a 90 s timeout and one SDK retry, combined with the request's 270 s deadline signal (`lib/deadline.ts`); Ollama calls 30 s. Long routes run inside `runPipeline` and return `504 deadline_exceeded` before Vercel's 300 s kill.
- **Next 16**: malformed percent-encoding in a `/media/...` path is rejected by Next's router (500) before the handler runs; the handler itself never decodes twice and maps `URIError` to 400. A `proxy.ts` rule could turn this into 400 if needed.
- **Next 16**: route handlers wrapped in a try/catch must rethrow Next's control-flow errors (they carry a string `digest`), or GET routes that read headers break prerender bail-out. Scripts that import server modules run with `tsx --conditions=react-server` so `server-only` resolves to its empty export.

## Live findings (backend, T080, 2026-10-29): SAM object prompts and photos of objects
- **Box and point prompts work** with the same request shape as phrases: one user message `[input_image, input_text]`, where `input_text` is the `buildObjectPrompt` output instead of a phrase. Probe image 320×256 (black disc r=50 at (90,128), grey square 200..280 × 88..168):
  - box: `input_text` = `<0f>1<|box;x1=30;y1=68;x2=149;y2=187;w=320;h=256|>` → 200, ≈1.9 s, output `<0f>1<|box;x1=39;y1=77;x2=140;y2=179;w=320;h=256;c=0.977|><|mask;x=0;y=0;c=0.977;data=103,102,…|>`; parsed: one box record and one mask record, `objectId "1"`, `identity "image:*:1"`, bounds `{39,77,141,180}` (the disc), confidence 0.977.
  - points: `<0f>1<|point;x=240;y=128;w=320;h=256|>-<|point;x=90;y=128;w=320;h=256|>` (positive on the square, negative on the disc; a negative point is prefixed with `-`) → 200, ≈1.0 s, one object with bounds `{200,88,280,168}` (the square only), confidence 0.977.
  - Same event sequence as phrase requests (this time `response.output_text.done` was present). The object id in the response is the id we sent. Recordings: `web/test/fixtures/segment/probe-box-events.json`, `probe-points-events.json` (used by `web/test/sam-prompts.test.ts`).
- **Phrases for photos of objects.** On a generated phone-style photo of a knitted bear on a wooden table, `"drawing"`, `"object"`, `"item"` and `"thing"` returned no SAM result at all (the threshold fallback then returned the dark table); `"toy"` (0.93) and `"handmade object"` (0.91) returned the bear. On a photo of a wallet and a clay figure on a white desk, `"object"` found both (0.69 / 0.68), `"handmade object"` found both (0.81 / 0.75), `"drawing"` returned low-score shapes (0.30, 0.05, 0.01). So `SAM_PHRASES = ["drawing", "handmade object"]`, results under 0.1 are dropped when anything scores higher. Cut-outs of the bear, wallet and figure with `finishMask` had no holes and soft edges (opt-in check `web/test/live/sam-photo.live.test.ts`).
- **Drawings on paper (fix round 1, 2026-10-29).** Three generated phone-style photos: a child's marker drawing (sun, house, tree, flowers) on printer paper on a wooden table; a black-marker cat with small stars on paper on a grey desk; a sketchbook page with a red flower and a blue fish on a dark table.
  - `"drawing"` found the pieces in every photo (scores 0.62–0.94): the sun, house, cloud, tree and flowers as separate pieces; the cat plus each star; the flower and fish (0.92 / 0.94) plus two bubbles.
  - `"handmade object"` returned a large frame-spanning region in every photo (bbox = the full frame, 37–49 % of the frame, score 0.41–0.56: the paper or the table around it) plus near-duplicates of the drawings at 0.01–0.06.
  - After the merge (IoU, score floor, the new container rule: > 40 % of the frame and its box contains another result's box) the candidates were only drawing pieces; the paper never became a candidate, and the bear, wallet and figure photos were unchanged (1 and 2 candidates).
  - Gap: a 37 % paper/table region is under the 40 % container threshold; it lost here only on score (0.41 vs ≥ 0.76 drawing pieces, cap 6). The single-candidate auto-select is skipped above 50 % of the frame.
- **Mask finishing** (`finishMask` in `lib/image/mask.ts`): at ≤ 2048 px (request scale), each part → fill holes → drop pieces < 0.5 % of its main blob **and** < 0.02 % of the frame (min 64 px); union of parts; close 2 px; fill holes; blur σ 0.6 and **linear** resize to the cut size → 8-bit alpha. The original (opaque) is upscaled with lanczos before the cut when the cut's short side is under 900 px (≤ ×2); the RGBA cut is never resampled. The stored `maskUrl` PNG is that soft alpha (white = inside).

## Verification status
| Module | Status |
|---|---|
| `lib/ai/meta/transcribe.ts` (Voice Transcribe) | verified 2026-10-28 (probe + HTTP `/transcribe`, WAV and m4a→WAV via local ffmpeg) |
| `lib/ai/meta/shape-prompt.ts` (Spark) | verified 2026-10-28 (clear and ambiguous ideas) |
| `lib/ai/meta/image.ts` generate / refine / compose (Muse Image) | verified 2026-10-28 |
| `lib/ai/meta/describe.ts` (Spark vision) | verified 2026-10-28 |
| `lib/ai/meta/sam.ts` findAll (SAM 3.1 + parser) | verified 2026-10-28; `segment` with a box and with positive + negative points verified 2026-10-29 (T080, recordings in `web/test/fixtures/segment/probe-{box,points}-events.json`); `findCandidates` (two phrases) checked live on two object photos 2026-10-29 |
| `lib/image/sticker.ts` (moved from `lib/ai/meta/`, pure image math) | unit-tested; print files produced for the seeded stickers; tote print PNG since T050 |
| `lib/ai/meta/mockup.ts` | verified 2026-10-28 (sticker and tote mockups in the seed) |
| `lib/ai/meta/listing-agent.ts` + tools | verified 2026-10-28; loop cap and forced final unit-tested |
| `lib/ai/meta/story.ts` Ollama native + Spark fallback | verified 2026-10-28 locally; `/v1` compatible route UNVERIFIED live (unit-tested) |
| `lib/ai/meta/captions.ts` | transcription verified; captioning a real video UNVERIFIED (needs WAV `audioUrl` or ffmpeg) |
| `lib/storage/blob.ts` public + private (OIDC) | verified 2026-10-28 |
| `POST /uploads` (client upload) | UNVERIFIED end to end (needs a browser/iOS client) |
| `lib/deadline.ts` + `lib/pipeline/run.ts` (270 s deadline, 504) | unit-tested; not exercised against a real hung call |
| Ownership checks on client refs, `/media` matrix, approve gates | unit-tested + live HTTP 2026-10-28 (403 cross-creator, tag ≠ print, admin/own 302, moderation 409) |
| `lib/db/queries.ts` + routes | verified 2026-10-28 against Neon (seed + local HTTP smoke of auth, creators, orders, messages, thank-you, public actions, media) |
