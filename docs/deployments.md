# Deployments

| Date | Environment | Deployment URL | Git tag/sha | Approved by | Rollback target | Notes |
|---|---|---|---|---|---|---|
| 2026-10-29 | production (automatic: first deployment of the project; `vercel deploy` without `--prod`) | https://maker-story-jfdrmoibb-xinyao-wangs-projects.vercel.app (alias https://maker-story-three.vercel.app, public) | 7333535 | not approved (assigned by Vercel) | none yet | Shop, artist, product and story-tag pages render the seeded data. Model, creator and admin routes fail closed until the secrets are synced. |
| 2026-10-29 | preview | https://maker-story-4pvv2k5o3-xinyao-wangs-projects.vercel.app | 7333535 (web code unchanged at tag `day-1`; later commits are docs and scripts) | integration (T040) | none yet | Behind Vercel login. Verified `/`, `/artists`, `/how-it-works`, `/c/leo`, `/p/[id]`, `/t/DNTDT4R3X1C7` with seeded data. `/admin` 503 and creator sign-in fail until `ADMIN_PASSWORD`, `CREATOR_SESSION_SECRET`, `META_API_KEY` are synced. |
