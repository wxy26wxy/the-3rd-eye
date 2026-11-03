# Handoff · pm

> Read `docs/context.md` first: the shared state for every lane and session (flow, rules, infra, open items).

## Owns
`docs/brief.md`, `docs/progress.md` summaries, `docs/deployments.md`, `docs/handoffs/pm.md`, `scripts/vercel_env_sync.sh`, `scripts/check_clean.sh`.

## Current task
Oct 29 · day 2: secrets to Vercel, phone tests, iOS binding, first physical sticker.

## Task list for Oct 29
1. **Secrets** (morning, first): `bash scripts/vercel_env_sync.sh`, then `cd web && vercel deploy --yes`; decide whether to also run `vercel deploy --prod --yes` for the public alias. Record the new deployment in `docs/deployments.md`.
2. **Phone tests** (after 1): the three tests in "Morning summary (Oct 29)" in `docs/progress.md` (buy + story tag + note; voice sticker with June's code from web/.creator-codes.local; story video recording). Log results and bugs in `docs/progress.md`; anything broken goes to the web or backend handoff.
3. **Merge and bind iOS**: review and merge the iOS branch into `main`, then bind it to `/api/v1` against the preview (sign-in code, WAV recording, uploads with kind `story-video`, `audioUrl` for captions). Small commits, run `bash scripts/check_clean.sh`.
4. **Physical sticker print**: from `/admin`, download the Print PNG and Die SVG of one test order (start with June's sticker), print and cut a die-cut sticker, attach an NFC tag that opens its `/t/<token>` URL, and test the tap on iPhone and Android. Note size, border and colour issues.
5. **Mock-judge review schedule**: book two mock-judge reviews (suggested: Oct 31 after the iOS binding, Nov 2 after polish), each with the 3-minute demo path (voice sticker → shop → buy → story tag tap). Collect notes in `docs/reviews/`.
6. Follow-ups found in T040 (assign): captions for phone-web story videos on Vercel (send a soundtrack WAV or bundle ffmpeg); story prompts should use the chosen artwork; refine cut-outs dropping secondary elements; June's birds tote print check; true 404 for missing pages.

## Interface exposed to others
- Deployments and rollback targets in `docs/deployments.md`.
- `scripts/vercel_env_sync.sh` pushes app settings (never prints values; skips a localhost site URL).

## Open questions for other roles
- **backend**: store the chosen SAM candidate and a generation id on artworks so the trace does not rely on time windows.
- **web**: send a WAV soundtrack (`audioUrl`) with story videos so captions work on Vercel.

## Last updated
2026-10-29
