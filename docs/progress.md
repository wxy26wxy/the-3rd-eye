# Progress log

Append-only. Each entry: task id · role · branch · what was done · commits · how to verify · what is unfinished. Task ids are `T###` and are referenced in commit messages.

## 2026-10-28

### T001 · pm · main · Repository bootstrap
- Repo created with license, ignore rules, `scripts/check_clean.sh`, workspace config, `docs/` process memory.
- Next.js app scaffolded in `web/` (App Router, TypeScript, no Tailwind). Vercel project linked.
- Verify: `bash scripts/check_clean.sh` prints ok; `pnpm --filter web build` succeeds.

### T020 · web · feat/web-T01x · Public site, admin, mobile-web creator flow
- UI primitives on generated tokens (`web/components/ui/*`), mascot `Tag` (3 poses), inline QR encoder (`web/components/qr`, verified against a decoder for versions 1–9), all copy in `web/messages/en.json`.
- Pages: `/`, `/p/[id]` (+ staged buy → `/buy/success`), `/artists`, `/c/[slug]`, `/t/[token]` (tap once, note, follow, share, read aloud), `/how-it-works`, `/for-studios`, `/accessibility`, `/admin` (+ `/admin/trace/[artworkId]`) behind basic auth in `web/proxy.ts`, `/captions/[creatorId]` (WebVTT).
- Creator flow `/create/*` (welcome, code sign-in, product, method, speak, drawing, result, photo, select, ready, listing, story-video, live) calling `/api/v1` through `/create/bff/*` with the httpOnly creator cookie.
- Data via `web/lib/db/queries.contract.ts` (stubs marked `TODO(T010)`); `WEB_FIXTURES=1` for example data.
- Verify: `pnpm --filter web lint`; `pnpm --filter web build` (needs the backend's `lib/ai/fixtures` and `lib/ai/meta` modules, see handoff); `WEB_FIXTURES=1 ADMIN_PASSWORD=x pnpm --filter web start` and open `/`, `/p/p-frog`, `/t/EXAMPLETAG01`, `/admin`.
- Unfinished: bind the contract to `queries.ts`; end-to-end creator flow needs the live `/api/v1` routes.
