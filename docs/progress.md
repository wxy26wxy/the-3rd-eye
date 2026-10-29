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
### T020 · web · feat/web-T01x · Public site, admin, mobile-web creator flow
- UI primitives on generated tokens (`web/components/ui/*`), mascot `Tag` (3 poses), inline QR encoder (`web/components/qr`, verified against a decoder for versions 1–9), all copy in `web/messages/en.json`.
- Pages: `/`, `/p/[id]` (+ staged buy → `/buy/success`), `/artists`, `/c/[slug]`, `/t/[token]` (tap once, note, follow, share, read aloud), `/how-it-works`, `/for-studios`, `/accessibility`, `/admin` (+ `/admin/trace/[artworkId]`) behind basic auth in `web/proxy.ts`, `/captions/[creatorId]` (WebVTT).
- Creator flow `/create/*` (welcome, code sign-in, product, method, speak, drawing, result, photo, select, ready, listing, story-video, live) calling `/api/v1` through `/create/bff/*` with the httpOnly creator cookie.
- Data via `web/lib/db/queries.contract.ts` (stubs marked `TODO(T010)`); `WEB_FIXTURES=1` for example data.
- Verify: `pnpm --filter web lint`; `pnpm --filter web build` (needs the backend's `lib/ai/fixtures` and `lib/ai/meta` modules, see handoff); `WEB_FIXTURES=1 ADMIN_PASSWORD=x pnpm --filter web start` and open `/`, `/p/p-frog`, `/t/EXAMPLETAG01`, `/admin`.
- Unfinished: bind the contract to `queries.ts`; end-to-end creator flow needs the live `/api/v1` routes.

## 2026-10-29

### T040 · integration · main · Backend and web bound together, preview deployed
- Web data contract bound to `lib/db/queries.ts` and `lib/pipeline/public.ts`; fixtures removed. New queries: order confirmation, admin notes, artwork trace. Admin orders show buyer notes.
- Fixed: every artwork cut-out failed in production builds (`potrace` bundled; now a server external package). Seed repairs Leo's bus tote listing (moderation false positive). Env sync no longer pushes a localhost site URL.
- `lib/**/*.test.ts` now runs: 70 tests pass (was 53). Lint 0 errors. Build green.
- Local smoke (`next start` with real env): shop, buy, story tag, note into admin, admin status change, creator code sign-in, voice WAV transcribe, shape, 4 variants with descriptions, refine, select, product, listing agent, approve, story video upload (Blob client upload, captions made locally with ffmpeg), live, admin trace. Details in the T040 report.
- Commits: `d89c7bb` … (see `git log 1225386..day-1`). Tag `day-1`.
- Unfinished: see the morning summary.

## Morning summary (Oct 29)

**Links**
- Preview (behind Vercel login): https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app
- Production alias (public, made automatically because it was the project's first deployment): https://maker-story-three.vercel.app. Same code and database. On a phone this one opens without a Vercel login.

**Works locally** (`pnpm --filter web build && pnpm --filter web start`, real `.env.local`): everything in the brief's demo path. Shop with the 6 example products, product page, Buy, order confirmation with the story-tag link, story tag page (video or "not recorded yet"), Send a note (shows up in `/admin` under the buyer), admin status buttons, AI trace page, creator sign-in with a code, speak or type an idea, 4 variants with spoken descriptions, change it (refine), use this, sticker mockup, listing agent, put it in the shop, story video upload with captions, "You're live".

**Works on the preview now** (no secrets needed): `/`, `/p/<id>`, `/artists`, `/c/<slug>`, `/how-it-works`, `/for-studios`, `/accessibility`, Buy, `/buy/success`, `/t/<token>`, Send a note. Try the story tag `/t/DNTDT4R3X1C7` (a test order of Leo's bus sticker).

**Does not work on Vercel until the secrets are synced and a new deployment is made:** creator sign-in and the whole `/create` flow (`CREATOR_SESSION_SECRET`, `META_API_KEY`), `/admin` (503 until `ADMIN_PASSWORD`).

**Run first (from the repo root, on the dev Mac):**
```
bash scripts/vercel_env_sync.sh
cd web && vercel deploy --yes          # new preview with the secrets
# optional, to update the public alias too: vercel deploy --prod --yes
```

**Three things to test first on a phone** (after the sync and redeploy; use the newest deployment URL):
1. **Buy and the story tag.** Open `/`, tap "Red Double-Decker Bus Sticker by Leo", type a name, tap "Buy for $4.00". On the thank-you page tap "Open the story tag". Check the page reads well, tap "Read aloud", write a note, tap "Send note". Then open `/admin` (user `admin`, password from `.env.local`): your order is at the top with your note, and the QR code opens the same story tag when scanned with the camera.
2. **Make a sticker by voice.** Open `/create`, "Start creating", enter code `JUNE-DOOR-3`, choose Sticker, "Say it out loud", tap "Start talking", say an idea ("a green frog wearing a tiny red hat"), stop, "Done". Wait for 4 pictures (about 30 s), tap "Hear what the image shows" on one, "Use this", "Yes, list it!", wait for the listing, "Put it in the shop". This is the first test of the phone microphone → WAV path on a real device.
3. **Record the story video.** Continue from test 2 (or sign in again with `JUNE-DOOR-3`): on "Make your story video!" tap "Record a video", record 10–20 s with the front camera, "Use this video". Then buy June's new sticker and open its story tag: the video should play. Captions will be missing on Vercel (see below).

**Known not working or rough:**
- Secrets on Vercel until `scripts/vercel_env_sync.sh` runs (it was blocked tonight on purpose), then a redeploy is needed.
- iOS branch is not merged yet; iOS is not bound to the API.
- Captions for story videos uploaded from the phone web flow are not made on Vercel (no ffmpeg there, and the web flow does not send the soundtrack WAV). The video still saves and plays.
- Story-video talking points mention the newest variant's description, not always the chosen one.
- On a refine, the cut-out can keep only the main subject (the "add a moon" test lost the moon; the spoken description says so honestly).
- June's birds tote is published although its print check said not OK (published before the approve gate existed). Check it before printing a tote.
- The preview needs a Vercel login; the public alias does not.
- Missing products, artists or tags show the not-found page with `noindex` but HTTP 200 (known, deferred).
