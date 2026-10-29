# Progress log

Append-only. Each entry: task id · role · branch · what was done · commits · how to verify · what is unfinished. Task ids are `T###` and are referenced in commit messages.

## 2026-10-28

### T001 · pm · main · Repository bootstrap
- Repo created with license, ignore rules, `scripts/check_clean.sh`, workspace config, `docs/` process memory.
- Next.js app scaffolded in `web/` (App Router, TypeScript, no Tailwind). Vercel project linked.
- Verify: `bash scripts/check_clean.sh` prints ok; `pnpm --filter web build` succeeds.
