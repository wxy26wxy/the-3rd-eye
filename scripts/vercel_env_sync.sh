#!/usr/bin/env bash
# Pushes the app's own settings from web/.env.local to the Vercel project
# (production + preview). Provisioned variables (DATABASE_URL, BLOB_*, POSTGRES_*)
# are managed by the integrations and are not touched. Values are never printed.
# Usage: bash scripts/vercel_env_sync.sh
set -euo pipefail
cd "$(dirname "$0")/../web"
NAMES=(META_API_KEY CREATOR_SESSION_SECRET ADMIN_PASSWORD PAYMENTS_MODE NEXT_PUBLIC_SITE_URL)
for n in "${NAMES[@]}"; do
  v=$(grep -E "^$n=" .env.local | head -1 | cut -d= -f2- | tr -d '"' || true)
  if [ -z "$v" ]; then echo "skip $n (empty locally)"; continue; fi
  for e in production preview; do
    if printf '%s' "$v" | vercel env add "$n" "$e" --force >/dev/null 2>&1; then echo "set $n ($e)"; else echo "FAILED $n ($e)"; fi
  done
done
# On Vercel there is no local Ollama; the story stage falls back to Muse Spark.
for e in production preview; do printf '%s' meta | vercel env add AI_STORY "$e" --force >/dev/null 2>&1 && echo "set AI_STORY=meta ($e)"; done
echo "done. Pull locally with: vercel env pull .env.local --yes (then re-add local-only keys)"
