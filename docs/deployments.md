# Deployments

| Date | Environment | Deployment URL | Git tag/sha | Approved by | Rollback target | Notes |
|---|---|---|---|---|---|---|
| 2026-10-29 | production (automatic: first deployment of the project; `vercel deploy` without `--prod`) | https://maker-story-jfdrmoibb-xinyao-wangs-projects.vercel.app (alias https://maker-story-three.vercel.app, public) | 7333535 | not approved (assigned by Vercel) | none yet | Shop, artist, product and story-tag pages render the seeded data. Model, creator and admin routes fail closed until the secrets are synced. |
| 2026-10-29 | preview | https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app | 7333535 (web code unchanged at tag `day-1`; later commits are docs and scripts) | integration (T040) | none yet | Behind Vercel login. Verified `/`, `/artists`, `/how-it-works`, `/c/leo`, `/p/[id]`, `/t/DNTDT4R3X1C7` with seeded data. `/admin` 503 and creator sign-in fail until `ADMIN_PASSWORD`, `CREATOR_SESSION_SECRET`, `META_API_KEY` are synced. |
| 2026-10-29 | preview | https://maker-story-5yr6mz0yf-xinyao-wangs-projects.vercel.app | e561333 (T050 fix wave) | T050 | https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app | Behind Vercel login. Build green; `/t/1KYK3YV8CVXS` renders the thank-you and thread (checked with `vercel curl`). Creator routes answer `500 auth_not_configured` until `scripts/vercel_env_sync.sh` runs and a redeploy follows. Database migration 0002 is already applied (shared DB). |

## 2026-10-29 · TestFlight build 0.3.0 (1)
- Uploaded from branch `feat/ios-T060` at git 9553cb4 (the archive was signed with the working tree of 1f14cc8 plus the team-id change) by running the archive and export commands from `ios/scripts/testflight.sh` by hand; team `WHMG95UWKZ`. Later uploads use the script.
- Points at production https://maker-story-three.vercel.app. Invite: one tester (client), internal group. Rollback: expire the build in App Store Connect → TestFlight; testers keep the previous build.
