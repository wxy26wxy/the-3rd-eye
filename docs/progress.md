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
- Verify (from `web/`): `pnpm test` (31 tests); `pnpm build` with no `.env.local`; `pnpm probe`; sign in with `POST /api/v1/auth/code {"code":"<Leo's code>"}` (see web/.creator-codes.local) then `GET /api/v1/artworks`.
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
2. **Make a sticker by voice.** Open `/create`, "Start creating", enter June's code (see web/.creator-codes.local), choose Sticker, "Say it out loud", tap "Start talking", say an idea ("a green frog wearing a tiny red hat"), stop, "Done". Wait for 4 pictures (about 30 s), tap "Hear what the image shows" on one, "Use this", "Yes, list it!", wait for the listing, "Put it in the shop". This is the first test of the phone microphone → WAV path on a real device.
3. **Record the story video.** Continue from test 2 (or sign in again with June's code): on "Make your story video!" tap "Record a video", record 10–20 s with the front camera, "Use this video". Then buy June's new sticker and open its story tag: the video should play. Captions will be missing on Vercel (see below).

**Known not working or rough:**
- Secrets on Vercel until `scripts/vercel_env_sync.sh` runs (it was blocked tonight on purpose), then a redeploy is needed.
- iOS branch is not merged yet; iOS is not bound to the API.
- Captions for story videos uploaded from the phone web flow are not made on Vercel (no ffmpeg there, and the web flow does not send the soundtrack WAV). The video still saves and plays.
- Story-video talking points mention the newest variant's description, not always the chosen one.
- On a refine, the cut-out can keep only the main subject (the "add a moon" test lost the moon; the spoken description says so honestly).
- June's birds tote is published although its print check said not OK (published before the approve gate existed). Check it before printing a tote.
- The preview needs a Vercel login; the public alias does not.
- Missing products, artists or tags show the not-found page with `noindex` but HTTP 200 (known, deferred).
### T030 · ios · feat/ios-T01x · SwiftUI creator app
- XcodeGen project (`ios/project.yml`, target `MakerStory`, `com.makerstory.app`, iOS 17, no entitlements), bundled OFL fonts (Bagel Fat One, Rubik), Theme layer over generated tokens, all designed screens (Welcome → Pick product → Choose method → photo branch Camera / Finding drawings / Tap to select, voice branch Speak / Drawing your idea / Voice result → Design ready → Listing details → Story video → Video saved → You're live; Home tabs Create / My designs / Orders (10 s polling, badge) / Messages; Order detail; Thank-you composer; Settings; Code entry), networking (`APIClient`, Blob client upload, transcription), on-device speech.
- Verify:
  - `cd ios && xcodegen generate`
  - `xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData build` → BUILD SUCCEEDED, no warnings in app code
  - `xcodebuild test -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData` → 19 tests, 0 failures
  - Run: `xcrun simctl boot "iPhone 17"; xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/MakerStory.app; xcrun simctl launch booted com.makerstory.app`
  - Point at a deployment: add `API_BASE_URL=https://<host>` to the xcodebuild command.
- Unfinished: not yet exercised end to end against live routes (backend in progress); API fixtures are hand-written from docs/api.md; camera and microphone need a real phone (the simulator falls back to the photo library).

### T030 fix round 1 · ios · feat/ios-T01x
- Speech stops on create-flow route change (not on disappear), so arrival speech (confirmation, voice-result description, design ready, video saved, you're live) is no longer cancelled by the previous screen. Voice approval runs the same validation as the button. Sign out resets the orders store. Merged main (T005 `TypeScale` tokens) and removed the token build workaround. An empty answer to a clarifying question skips it. The spoken confirmation is shown as text while drawing. Videos upload as private Blob media with a public fallback. Retake returns to the source used. Choice cards and other custom buttons no longer expose a duplicate nested button to VoiceOver. Fixed a freeze: stopping speech mid-sentence deadlocked the main thread on iOS 27 (stop now runs off the main thread). Voice input is recorded as 16 kHz WAV (the transcription model accepts WAV only).
- Verify: `xcodebuild test -scheme MakerStory ...` (unit, 27 tests); `python3 ios/scripts/mock_api.py &` then `xcodebuild test -scheme MakerStoryUITests ... API_BASE_URL=http://localhost:3999` (voice flow UI test).

### iOS (merged after the morning summary was written)
The iOS creator app is on `main` (`ios/`). To put it on your iPhone:
1. `cd ios && xcodegen generate && open MakerStory.xcodeproj`
2. In Xcode: select the MakerStory target → Signing & Capabilities → Team: your personal Apple ID (free provisioning). Plug in the phone, pick it as the run destination, press Run. The first time, approve the developer profile on the phone under Settings → General → VPN & Device Management.
3. The app talks to `http://localhost:3000` by default. For the phone, set the `API_BASE_URL` build setting to the preview or production URL (Build Settings → User-Defined → API_BASE_URL) and run again.
Simulator: `xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' build` then run from Xcode. Sign in with a seeded creator code from `docs/handoffs/backend.md`.

### T050 · fix wave from the v0.1 review · main (web + backend; iOS fixed separately)
- **What changed:** story tag shows the creator's thank-you (text, image, captioned video, tag-scoped media) and the two-way note thread; web story video extracts its soundtrack as WAV and sends `audioUrl`, so captions work on Vercel; failed captions clear old ones; totes get a 150 dpi print PNG and every print file is sized to its spec (≤ 2× upscale); the publish gate uses the server's print checks and moderates the final text; agent re-runs on published products wait for approve; creator screens show the API's reasons with Retry / Retake; random login codes (only in `web/.creator-codes.local`), 30-day tokens, per-kind upload caps (25 / 200 / 10 MB, no SVG, 400 on bad JSON), moderated buyer and ship notes, production share stored; Muse Glimmer drafts the story from the captioned video (Use / Edit / Skip) and talking points use the chosen artwork; BFF `maxDuration 300`; photos lose EXIF in the browser and the public upload is deleted after the private copy; layering (`lib/image`, registry mockups and shaping style); minors (docs honesty, one admin auth with `WWW-Authenticate` on `/media`, soft deletes in public queries, earnings round down, `(site)/error.tsx`, schema lint).
- **How to verify** (from `web/`): `pnpm test` (87 tests, incl. `/media` with tag, token expiry, publish gate, tote print file, upload caps); `pnpm lint` (0 problems); `pnpm build`. Local smoke done 2026-10-29: tote create → listing → approve over HTTP (print PNG 3842×1500 at 150 dpi, alpha kept; anonymous `/media` 401, creator 200); story video with `audioUrl` → WebVTT captions + Glimmer draft (`provider: "ollama"`, ~6 s; `mentionDisability:false` dropped the disability from a transcript that mentioned it); buy → thank-you via API → `/t/1KYK3YV8CVXS` shows text, image, captioned video and the thread; tag media 302, print file with tag 403; a hostile note → 422 `note_rejected`. Sign in with the codes in `web/.creator-codes.local` (the old codes no longer work).
- **Still open:** secrets on Vercel (`scripts/vercel_env_sync.sh`, then redeploy) and a full creator run on Vercel; the browser soundtrack extraction has not been tried on a real iPhone (Safari, .mov); iOS `audioUrl` (iOS branch) and iOS sign-in with the new codes; Vercel firewall rate limits (docs/risks.md); Glimmer only runs while the dev Mac serves the app (Vercel uses the Spark fallback).
### T051 · ios · feat/ios-T051 · fix wave from the v0.1 review
- Captions (Critical 2, iOS side): story and thank-you videos are capped at 30 s / 15 s (library videos are trimmed with a note), their soundtrack is converted to 16 kHz mono 16-bit PCM WAV and uploaded as kind `audio`, and `audioUrl` is sent with `videoUrl`. If a video has no sound the video is still sent.
- Story draft (Important 5): after the story video is saved, a "Here's a story we drafted from your video" sheet offers Use (`PUT /creators/me { storyText }`), Edit (voice or keyboard, then save) and Skip; it reads aloud and has a "Read it to me" button. `Creator.storyDraft` is optional and decoded tolerantly.
- Exposure (Important 4, client): a 401 on any signed-in request clears the token, signs out, stops polling and opens the code screen with an explanation; a wrong code shows the server's message. No example login code in the app or tests (placeholder `TEST-CODE`).
- Originals (Important 8): photos are uploaded as JPEG written with ImageIO, with no GPS/EXIF/TIFF metadata (unit test checks with `CGImageSource`).
- Deferred minors: speech stops on tab switch, backgrounding and audio interruptions (stale "Stop" state cleared); polling pauses in the background; long calls wait 300 s with a "Still working" hint after 30 s; Release defaults to `https://maker-story-three.vercel.app`; `AccessPrefs`/`Split` decode with defaults; library videos respect the length cap; camera denial shows guidance and an Open Settings button (plus a library fallback for videos); URL cancellation surfaces as `CancellationError`; `ThemeEffects` checked against `design/tokens.json`.
- Commits: c9a000b, 2d2ade5, 759b3f7, 220289f, 76e12f3, 0e11f9c, 198f47a, d92bf31, c0d46a7, fef818b, 6df2d51, 0ca6f82, plus the docs commit.
- Verify (from `ios/`):
  - `xcodegen generate`
  - `xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData build` → BUILD SUCCEEDED, no warnings in app code
  - `xcodebuild test -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData` → 58 tests, 0 failures
  - `python3 scripts/mock_api.py &` then `xcodebuild test -scheme MakerStoryUITests -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData API_BASE_URL=http://localhost:3999` → voice-flow UI test passes
  - Phone install against the deployed site: `docs/handoffs/ios.md` → "Install on your iPhone".
- Unfinished / needs a device: soundtrack extraction from a real camera video (AAC) was not run, because the simulator's audio server stalls the decoder. The unit tests use a PCM source. Also not run on a device: camera-permission flow, interruptions, and the story-draft sheet and token expiry against the live backend. Older docs (this file's morning summary) still name seeded sign-in codes. Those lines are outside iOS ownership and should be removed when the codes rotate.

## v0.2 (Oct 29, early morning) — state after the fix waves
Tag `v0.2`. Since the morning summary above: the story-tag page now shows the creator's thank-you (text, image, captioned video) and the note thread; videos are captioned on Vercel because both clients upload a WAV soundtrack; totes have a print file and the publish gate uses real print/moderation checks; example login codes were replaced with random ones kept only in `web/.creator-codes.local` on this Mac (old codes and tokens no longer work; sign in again); creator tokens expire after 30 days; buyer notes are moderated; the Glimmer story draft appears after your story video (Use / Edit / Skip); originals are uploaded without metadata and the public copy is deleted after the private one is stored; iOS: WAV soundtrack, story-draft sheet, sign-out on expiry, 300 s timeouts, speech stops on tab switch/background.
Still open before judges (see `docs/reviews/2026-10-29-final-v0.1.md` and `docs/risks.md`): rate limits in the Vercel firewall; one real phone run of both creator flows against the deployed URL (captions from a camera video are device-unverified); delete the soundtrack WAV after captioning; limit the public-original delete to upload kinds; tags not re-moderated when only tags change; moderation outage returns 500 to buyers.
Smoke data in the shared database from tonight: an order by "T050 Smoke Buyer" (story tag `1KYK3YV8CVXS`, has a test thank-you video — usable as a demo of the tag page) and one extra note on tag `DNTDT4R3X1C7`. Delete them from `/admin` if you want a clean shop.

### T060 · ios · feat/ios-T060 · TestFlight distribution
- Added the app icon (generated from tokens by `pnpm icon`, 1024 px, no alpha), `DEVELOPMENT_TEAM`, version 0.3.0, `ITSAppUsesNonExemptEncryption=false`, `CFBundleIconName`, `ios/ExportOptions.plist`, `ios/scripts/testflight.sh` and `bump_build.sh`. See `docs/handoffs/ios.md` → TestFlight.
- Verify: simulator build and `xcodebuild test` (58 tests) still pass; `bash ios/scripts/testflight.sh` archives and uploads once Xcode is signed in with the Program team.
- Done: Xcode signed in with the Program team `WHMG95UWKZ` (the free personal team `B849U4U9UJ` cannot upload); build 0.3.0 (1) uploaded 2026-10-29 16:01 and processing. Next: add the tester in App Store Connect.

### T070 · ios · feat/ios-T070 · `makerstory://code/<CODE>` deep link
- The app registers the `makerstory` URL scheme; a code link opens the code screen with the code filled in (signed-out only; no auto-submit; VoiceOver announcement). See `docs/handoffs/ios.md` → Deep link.
- Verify (from `ios/`): `xcodebuild test -scheme MakerStory …` → 62 tests; `python3 scripts/mock_api.py &` then `xcodebuild test -scheme MakerStoryUITests … -only-testing:MakerStoryUITests/DeepLinkUITests API_BASE_URL=http://localhost:3999` → passes; manual: `xcrun simctl openurl booted makerstory://code/ABC123` → prompt → code screen.

### T086 · design · feat/design-T086 · readiness for the next canvas version (docs only)
- Rewrote `docs/handoffs/design.md` (heads-up for the designer and agent; one-hour intake checklist), updated `docs/design/screens.md` (screens with no board, removed elements, rename, intake log). No code or tokens changed.
- Dry run against canvas version `1793328546-ac11`: no earlier id was recorded, so it is the baseline. Colours, type sizes and grain match `design/tokens.json` except 4 illustration colours without a token (listed in the handoff).
- Verify: read the two docs; `bash scripts/check_clean.sh` passes; `git diff main --stat` shows only the three doc files.
- Gap: there is no automated no-raw-values lint on web or iOS; the checklist uses grep commands until one is added.
