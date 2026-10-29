# Progress log

Append-only. Each entry: task id · role · branch · what was done · commits · how to verify · what is unfinished. Task ids are `T###` and are referenced in commit messages.

## 2026-10-28

### T001 · pm · main · Repository bootstrap
- Repo created with license, ignore rules, `scripts/check_clean.sh`, workspace config, `docs/` process memory.
- Next.js app scaffolded in `web/` (App Router, TypeScript, no Tailwind). Vercel project linked.
- Verify: `bash scripts/check_clean.sh` prints ok; `pnpm --filter web build` succeeds.

### T010 · backend · feat/backend-T01x · Backend and AI pipeline
- Data layer: `lib/db/queries.ts` (all reads/writes, soft-delete aware), DTOs in `lib/api/dto.ts`, `lib/ids.ts` (12-char Crockford NFC tokens), `lib/auth.ts` (HMAC creator tokens via Bearer or `ms_creator` cookie, admin basic auth), `lib/http.ts` (JSON errors, zod). Schema pushed to Neon; migration `web/drizzle/0000_*.sql`.
- Storage: `lib/storage` (public store by token, private store by `BLOB_PRIVATE_STORE_ID` + OIDC, write-once, presigned reads, hashed-public fallback); client uploads at `/api/v1/uploads`.
- AI: `traced()` → `ai_calls`; Meta providers (Voice Transcribe, Spark shape/describe/listing agent with 5 tools, Muse Image generate/refine/compose, SAM 3.1 streaming + parser with threshold fallback, sticker print pipeline, mockups, captions); story drafts on Muse Glimmer via Ollama (native → /v1 → Spark fallback); offline fixture registry (`AI_FIXTURES=1`). Request shapes verified against live probes (`scripts/probe_meta.ts`, fixtures in `web/test/fixtures/`); verification table in `docs/architecture.md`.
- Routes: every path in `docs/api.md` plus `/api/v1/public/{orders,tap,reply}` and `/media/[...path]`; clarifications appended to `docs/api.md`.
- Seed: `scripts/seed.ts` ran live — 3 fictional example creators, 6 published products (4 stickers, 2 totes) with real art, print files, mockups and agent-written listings. Login codes in `docs/handoffs/backend.md`.
- Commits: `9518f81` … (see `git log 14b15cb..feat/backend-T01x`).
- Verify (from `web/`): `pnpm test` (31 tests); `pnpm build` with no `.env.local`; `pnpm probe`; sign in with `POST /api/v1/auth/code {"code":"LEO-SUNRISE-1"}` then `GET /api/v1/artworks`.
- Unfinished / UNVERIFIED: client upload end to end, SAM box/point prompts, captioning a real video (needs a WAV `audioUrl` on Vercel), Ollama `/v1` route live, Stripe (staged only).
