# Deployments

| Date | Environment | Deployment URL | Git tag/sha | Approved by | Rollback target | Notes |
|---|---|---|---|---|---|---|
| 2026-10-29 | production (automatic: first deployment of the project; `vercel deploy` without `--prod`) | https://maker-story-jfdrmoibb-xinyao-wangs-projects.vercel.app (alias https://maker-story-three.vercel.app, public) | 7333535 | not approved (assigned by Vercel) | none yet | Shop, artist, product and story-tag pages render the seeded data. Model, creator and admin routes fail closed until the secrets are synced. |
| 2026-10-29 | preview | https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app | 7333535 (web code unchanged at tag `day-1`; later commits are docs and scripts) | integration (T040) | none yet | Behind Vercel login. Verified `/`, `/artists`, `/how-it-works`, `/c/leo`, `/p/[id]`, `/t/DNTDT4R3X1C7` with seeded data. `/admin` 503 and creator sign-in fail until `ADMIN_PASSWORD`, `CREATOR_SESSION_SECRET`, `META_API_KEY` are synced. |
| 2026-10-29 | preview | https://maker-story-5yr6mz0yf-xinyao-wangs-projects.vercel.app | e561333 (T050 fix wave) | T050 | https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app | Behind Vercel login. Build green; `/t/1KYK3YV8CVXS` renders the thank-you and thread (checked with `vercel curl`). Creator routes answer `500 auth_not_configured` until `scripts/vercel_env_sync.sh` runs and a redeploy follows. Database migration 0002 is already applied (shared DB). |

## 2026-10-29 · TestFlight build 0.3.0 (1)
- Uploaded from branch `feat/ios-T060` at git 9553cb4 (the archive was signed with the working tree of 1f14cc8 plus the team-id change) by running the archive and export commands from `ios/scripts/testflight.sh` by hand; team `WHMG95UWKZ`. Later uploads use the script.
- Points at production https://maker-story-three.vercel.app. Invite: one tester (client), internal group. Rollback: expire the build in App Store Connect → TestFlight; testers keep the previous build.

## 2026-10-29 · production · v0.3 (1efbed7)
- https://maker-story-hroeg8lkl-xinyao-wangs-projects.vercel.app → alias https://maker-story-three.vercel.app. `vercel deploy --yes --prod` from `web/` after the T070 web merge; migration 0003 (`creators.hidden`) applied first with `pnpm migrate`.
- New: `/admin` Creators panel (add creator, one-time code card with QR, sign-in link and app link, New code, hide from shop), `/create/code?c=` prefill, hidden creators excluded from public pages. Rollback target: https://maker-story-o9k5oafyh-xinyao-wangs-projects.vercel.app (v0.2 + T050 fixes); rolling back does not require reverting the migration (the column is additive).
- Approved by: the founder (plan approval, 2026-10-29 evening). Next: T085 renames the project to The 3rd Eye; this alias stops working at that point.

## 2026-10-29 · T085 rename (pending: filled in when the controller renames the Vercel project and uploads the new build)
- Production: Vercel project `the-3rd-eye`, expected alias https://the-3rd-eye.vercel.app (if Vercel assigns a suffixed alias, that host goes into `NEXT_PUBLIC_SITE_URL` in production and `.env.local`, `web/.env.example`, and `DEPLOYED_SITE_URL` in `ios/project.yml`). Deployment URL, git sha and approver: to be recorded after the redeploy.
- TestFlight: new app record "The 3rd Eye", bundle id `com.the3rdeye.app`, SKU `the-3rd-eye`; build 0.4.0 (1) from `bash ios/scripts/testflight.sh --no-bump` (`project.yml` already holds 0.4.0 / 1; later uploads bump as usual) (archive `ios/build/The3rdEye-0.4.0-1.xcarchive`). The tester is invited again to this app's internal group.
- Rollback caveat: the old alias https://maker-story-three.vercel.app stops resolving, so build 0.3.0 (1) of the old app record stops working; rolling the web back does not bring the old alias back. Recovery is installing build 0.4.0 (1).

## 2026-10-30 · production · The 3rd Eye (7de964e)
- Vercel project renamed `maker-story` → `the-3rd-eye`; new production host https://the-3rd-eye.vercel.app attached; the old alias https://maker-story-three.vercel.app stays attached on purpose so the TestFlight build 0.3.0 (1) already installed keeps working until 0.4.0 (1) replaces it. `NEXT_PUBLIC_SITE_URL` (production) now `https://the-3rd-eye.vercel.app`.
- Deployment https://the-3rd-nmm800mm8-xinyao-wangs-projects.vercel.app (`vercel deploy --yes --prod` from `web/` at main 7de964e: rename + T080 cutout pipeline + T081-independent web changes). Verified: `<title>` is "The 3rd Eye · art with a story you can hold"; `/create/code?c=` prefill works. Rollback target: https://maker-story-hroeg8lkl-xinyao-wangs-projects.vercel.app (v0.3).
- Approved by: the founder (rename decision and plan approval, 2026-10-29).

## 2026-10-30 · production · v0.4 + web cutout parity (c285533)
- https://the-3rd-7cskup1jd-xinyao-wangs-projects.vercel.app → https://the-3rd-eye.vercel.app. Adds the web Select-screen cutout adjuster (T084) on top of v0.4 (rename, T080 pipeline). Rollback target: https://the-3rd-nmm800mm8-xinyao-wangs-projects.vercel.app.
- Approved by: the founder (plan approval). TestFlight 0.4.0 (1) of The 3rd Eye still pending on the Apple account sign-in.
