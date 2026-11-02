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
- Approved by: the product owner (plan approval, 2026-10-29 evening). Next: T085 renames the project to The 3rd Eye; this alias stops working at that point.

## 2026-10-29 · T085 rename (pending: filled in when the controller renames the Vercel project and uploads the new build)
- Production: Vercel project `the-3rd-eye`, expected alias https://the-3rd-eye.vercel.app (if Vercel assigns a suffixed alias, that host goes into `NEXT_PUBLIC_SITE_URL` in production and `.env.local`, `web/.env.example`, and `DEPLOYED_SITE_URL` in `ios/project.yml`). Deployment URL, git sha and approver: to be recorded after the redeploy.
- TestFlight: new app record "The 3rd Eye", bundle id `com.the3rdeye.app`, SKU `the-3rd-eye`; build 0.4.0 (1) from `bash ios/scripts/testflight.sh --no-bump` (`project.yml` already holds 0.4.0 / 1; later uploads bump as usual) (archive `ios/build/The3rdEye-0.4.0-1.xcarchive`). The tester is invited again to this app's internal group.
- Rollback caveat: the old alias https://maker-story-three.vercel.app stops resolving, so build 0.3.0 (1) of the old app record stops working; rolling the web back does not bring the old alias back. Recovery is installing build 0.4.0 (1).

## 2026-10-30 · production · The 3rd Eye (7de964e)
- Vercel project renamed `maker-story` → `the-3rd-eye`; new production host https://the-3rd-eye.vercel.app attached; the old alias https://maker-story-three.vercel.app stays attached on purpose so the TestFlight build 0.3.0 (1) already installed keeps working until 0.4.0 (1) replaces it. `NEXT_PUBLIC_SITE_URL` (production) now `https://the-3rd-eye.vercel.app`.
- Deployment https://the-3rd-nmm800mm8-xinyao-wangs-projects.vercel.app (`vercel deploy --yes --prod` from `web/` at main 7de964e: rename + T080 cutout pipeline + T081-independent web changes). Verified: `<title>` is "The 3rd Eye · art with a story you can hold"; `/create/code?c=` prefill works. Rollback target: https://maker-story-hroeg8lkl-xinyao-wangs-projects.vercel.app (v0.3).
- Approved by: the product owner (rename decision and plan approval, 2026-10-29).

## 2026-10-30 · production · v0.4 + web cutout parity (c285533)
- https://the-3rd-7cskup1jd-xinyao-wangs-projects.vercel.app → https://the-3rd-eye.vercel.app. Adds the web Select-screen cutout adjuster (T084) on top of v0.4 (rename, T080 pipeline). Rollback target: https://the-3rd-nmm800mm8-xinyao-wangs-projects.vercel.app.
- Approved by: the product owner (plan approval). TestFlight 0.4.0 (1) of The 3rd Eye still pending on the Apple account sign-in.

## 2026-10-30 · production · live price in the product summary (147b9a7)
- https://the-3rd-comuhhw6q-xinyao-wangs-projects.vercel.app → https://the-3rd-eye.vercel.app. Adds `priceCents`/`description`/`mockupUrl` to the product summary on `GET /artworks` and keeps a published price on approve when the client omits it (T087). Rollback target: https://the-3rd-7cskup1jd-xinyao-wangs-projects.vercel.app.

## 2026-10-30 · production · rate limiting + demo docs (8e350f9)
- https://the-3rd-835bbkwxt-xinyao-wangs-projects.vercel.app → https://the-3rd-eye.vercel.app. Adds in-app per-IP rate limits (login code 10/min, note form 30/min, model routes 20/min; signed client IP across the BFF) and the demo script / README refresh. Rollback target: https://the-3rd-comuhhw6q-xinyao-wangs-projects.vercel.app.

## 2026-10-30 · production · review fix wave (9531526)
- https://the-3rd-9mxe9dflc-xinyao-wangs-projects.vercel.app → https://the-3rd-eye.vercel.app. T090: scoped public-original delete, 503 on moderation outage, tags-aware moderation reuse, captions-route test, live row on draft edits, Select-screen follow-ups (persisted cutout, zero-pieces box, tappable labels, tokens), fragment sign-in link, a11y nits. Rollback target: https://the-3rd-835bbkwxt-xinyao-wangs-projects.vercel.app.

## 2026-10-30 · TestFlight · The 3rd Eye 0.4.0 (1)
- First build of the new App Store Connect record (bundle `com.the3rdeye.app`). Archived from main at v0.5 (b0277f5) with `xcodebuild archive` (`-project The3rdEye.xcodeproj`); uploaded by the product owner from Xcode Organizer because the command-line export could not see the Apple sign-in ("Failed to Use Accounts"). Points at https://the-3rd-eye.vercel.app. Rollback: expire the build in App Store Connect; the old "maker story" app's 0.3.0 (1) still works against the kept alias.
- Next: add the tester to the internal group once the build shows "Ready to Test"; later uploads via `bash ios/scripts/testflight.sh` (bumps to build 2) once the account issue is solved or an App Store Connect API key is in place.

## 2026-10-30 · tag v0.7-rc1 (bbe6c8d) · production promotion pending
- Release candidate: Sky tokens v2, the web primitives, the web creator flow on the Sky boards (T102, T105) and the iOS theme and components (T103). Tagged at bbe6c8d on 2026-10-30. Nothing was promoted to production from this tag; it was superseded by v0.7 the next day.
- Production URL: https://the-3rd-eye.vercel.app. Deployment id: pending (the PM fills it in later).
- Approver: the product owner. Rollback target: the previous production deployment (Vercel instant rollback); for code, tag `v0.6`.

## 2026-10-31 · tag v0.7 (3f2cac5) + docs 9e41723 · promoted to production
- Sky design on every screen of both platforms: web creator flow (T105), public site and admin (T106), iOS screens (T104), plus the T108 backend follow-ups (die-cut outline wraps every piece of a multi-piece cut, typed buy errors, name/studio and list separators from `en.json`, private Blob store credential checks). No database migration in this release.
- Production URL: https://the-3rd-eye.vercel.app. Production deployment id: `dpl_9uvgSeEd9qW1t1vc6P2CzXWmtRfH` (built from main 9e41723 = tag v0.7 plus docs-only commits; build 26 s, 42 routes).
- Promoted by the product owner from the CLI (`vercel deploy --yes --prod` from `web/`) on 2026-10-31. Smoke after promotion: `/`, `/artists`, `/how-it-works`, `/accessibility`, `/create` return 200, an unknown path returns 404, and the home page serves the Sky hero (sky photo, nav drawer, optimized images).
- Approver: the product owner. Rollback target: the previous production deployment (Vercel instant rollback, no rebuild); for code, tag `v0.6`.

## 2026-10-31 · TestFlight · The 3rd Eye 0.5.0 builds (1) and (2) · upload pending
- Version 0.5.0, build numbers (1) and (2) (the second only if a second upload is needed; `ios/project.yml` holds build 1 at v0.7), are uploaded by the product owner from Xcode Organizer (the command-line export cannot see the Apple sign-in). Status: pending; this entry is updated once App Store Connect shows them as "Ready to Test".
- Rollback: expire the build in App Store Connect → TestFlight; testers keep the previous build (0.4.0 (1)).

## 2026-11-02 · tag v0.8-rc1 (pending) · production promotion pending
- Release candidate for Design v3 (photo-first): T110 design intake (tokens v3, Outfit, sticker-loading animation), T111 backend (`POST /artworks/{id}/change` with Muse Image edit, `POST /artworks/{id}/cutout`, order size and quantity, admin trace relabel), T112 site (shop and product page redesign, Add to bag → order sheet), T113 web creator flow (Choose a pattern → Change it → Before and after → Your cutout → Making your sticker), T114 iOS v3, T115 docs. Tag and sha: pending (tagged once T112–T114 are merged).
- **Prerequisite: migration 0004 must be applied to the shared database before this build is deployed.** The product owner runs `pnpm migrate drizzle/0004_t111_change_and_sizes.sql` from `web/` (additive: `artworks.change_instruction`, `orders.size`, `orders.quantity` with default 1). Without it, `change` and `cutout` and every order with a size fail.
- Production URL: https://the-3rd-eye.vercel.app. Deployment id: pending (the PM fills it in after `vercel deploy --yes --prod` from `web/`, run by the product owner).
- TestFlight: The 3rd Eye 0.5.0 build 3 (the v0.8 iOS app), uploaded by the product owner from Xcode Organizer; pending.
- Approver: the product owner. Rollback target: the v0.7 production deployment `dpl_9uvgSeEd9qW1t1vc6P2CzXWmtRfH` (Vercel instant rollback); the migration is additive, so rolling back the web does not require reverting it. For code, tag `v0.7`.

## 2026-11-03 · tag v0.8 (pending) · promoted to production (pending)
- Fixes on top of `v0.8-rc1` until the freeze (Nov 3, 9:00 AM); tag `v0.8` at the freeze. Tag and sha: pending.
- Prerequisite as for `v0.8-rc1`: migration 0004 applied (once; it is not run again).
- Production URL: https://the-3rd-eye.vercel.app. Deployment id: pending. Smoke after promotion (to record): `/`, `/p/<id>` (Size, quantity, Add to bag → order sheet → staged order, size × qty on `/admin`), `/t/<token>`, `/create` photo → Choose a pattern → Change it → Before and after → Your cutout → Making your sticker.
- TestFlight: 0.5.0 build 3 if no iOS fix was needed after rc1, otherwise the next build number; pending.
- Approver: the product owner. Rollback target: the `v0.8-rc1` deployment, then the v0.7 deployment `dpl_9uvgSeEd9qW1t1vc6P2CzXWmtRfH`; for code, tag `v0.8-rc1`.
