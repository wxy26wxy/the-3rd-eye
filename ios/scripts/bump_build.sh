#!/usr/bin/env bash
# Increments CURRENT_PROJECT_VERSION in project.yml (TestFlight needs a new build number per upload).
set -euo pipefail
cd "$(dirname "$0")/.."
cur=$(grep -E '^\s*CURRENT_PROJECT_VERSION:' project.yml | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')
next=$((cur + 1))
sed -i '' -E "s/^(\s*CURRENT_PROJECT_VERSION:) \"${cur}\"/\1 \"${next}\"/" project.yml
echo "build ${cur} → ${next}"
