# Decisions log

Append-only. Newest at the bottom. Format: date · decision · why · alternatives considered.

- 2026-10-28 · **One backend: Next.js on Vercel** serves the shop, story-tag pages, admin, and `/api/v1` for iOS. · Fewer moving parts for a 7-day build; same code paths for web and mobile. · Separate Python service (rejected: extra deployment and glue).
- 2026-10-28 · **No Meta text-to-speech exists; use on-device speech** (iOS `AVSpeechSynthesizer`, web `speechSynthesis`) to read Spark-written descriptions. · Honest; works offline; zero latency. · Third-party TTS (rejected: not a Meta model, extra cost).
- 2026-10-28 · **Spark standard mode only, never contributor mode.** · Creator photos and voice must not be used for training. · Contributor pricing (rejected on privacy grounds).
- 2026-10-28 · **Payments staged** behind `PAYMENTS_MODE=staged`; Buy creates an order directly. Stripe test mode can be enabled later. · Demo priority is the creator and story-tag flows. · Stripe now (deferred).
- 2026-10-28 · **Story video is per creator, recorded once at first listing**, replayed on every product, redoable anytime. · Matches the designed flow; lowers the burden on creators. · Per-artwork video (kept as optional later).
- 2026-10-28 · **Product chosen before creation method** (sticker or tote, then photo/upload/voice). · Matches the designed flow. · Method first (previous draft).
- 2026-10-28 · **Design tokens are the single source of truth** (`design/tokens.json` → generated CSS and Swift). · Full redesigns must be a token change plus a generator run. · Hand-written styles per platform (rejected).
- 2026-10-28 · **Revenue split default 50% creator / 30% organization / 20% production**, configurable per creator by admin. · Simple and creator-first. · 70/30 (kept as an option).
- 2026-10-28 · **Example creators are fictional and labelled as such** until real artists consent to be featured.
- 2026-10-28 · **Neon Postgres + Drizzle, Vercel Blob (public + private stores)** provisioned through the Vercel Marketplace.
- 2026-10-28 · **Private Blob store not yet linked** (CLI cannot attach a second store with a custom prefix); `lib/storage` uses the public store with hashed, unguessable pathnames until `BLOB_PRIVATE_READ_WRITE_TOKEN` exists. · Unblocks the overnight build; the `Storage` interface isolates the change. · Wait for the dashboard step (rejected: blocks everything).
- 2026-10-28 · **Shared contracts written first** (`lib/db/schema.ts`, `lib/ai/types.ts`, `docs/api.md`) so web and iOS build in parallel with the backend.
- 2026-10-28 · **Open-weight stage runs on Muse Glimmer locally via Ollama, not Baseten.** Story and thank-you drafts use `muse-glimmer` through Ollama's OpenAI-compatible endpoint (`OLLAMA_BASE_URL`, default `http://localhost:11434/v1`); when unreachable (e.g. on Vercel) the stage falls back to Muse Spark 1.3 and records `provider: "meta-fallback"`. · No partner credits were granted; the development Mac (M3 Max, 64 GB) runs the 30B model for free; "own hardware" qualifies for the open-weight bonus. · Baseten (rejected: cost and account setup for a tiny stage).
