# Rewind runbook

Every change in this project can be traced and undone. Use the smallest step that fixes the problem.

## Code
- Undo one commit while keeping history: `git revert <sha>`; push the revert.
- Return to a known-good day: `git checkout -b recover day-3` (tags: `day-1`…`day-7`, `checkpoint-*`, `freeze-nov2`, `submitted`).
- Find what changed a behaviour: `git log --oneline -- <path>` then read the `T###` entry in `docs/progress.md`.
- Never force-push or rewrite history on `main`.

## Production deployment (Vercel)
- Every push creates an immutable preview; production is promoted by hand.
- Roll back: `vercel rollback` (or Instant Rollback in the dashboard) to the deployment listed as the rollback target in `docs/deployments.md`.
- Promote a specific preview: `vercel promote <deployment-url>`.

## Database (Neon)
- Before any migration a branch `pre-<migration-name>` is created in the Neon console; after seeding, a branch `demo-content`.
- Restore: point `DATABASE_URL` at the branch (Vercel env → redeploy) or use Neon point-in-time restore.
- Rows are soft-deleted (`deleted_at`); to undelete, null the column.
- Re-seed demo content: `pnpm --filter web exec dotenv -e .env.local -- tsx ../scripts/seed.ts` (idempotent).

## Assets (Vercel Blob)
- Files are write-once at hashed paths; a new version is a new path. To revert an asset, point the database row back at the previous path (the previous path is in `ai_calls` / the row's history).

## AI stages
- Every model call is in the `ai_calls` table with its request hash and response id. Replay a stage offline with `META_FIXTURES=1` after recording fixtures with `scripts/record_fixtures.ts`.
- A Muse Image variant can be continued from its stored `gen_response_id`.

## Design
- Tokens are versioned: `git log -- design/tokens.json`; revert the file and run `pnpm tokens`.

## iOS
- Each day's simulator build is archived under `ios/builds/day-N/` (not committed). The app shows its git sha in Settings. Point a build at an older API with the `API_BASE_URL` build setting.
