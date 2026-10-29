#!/usr/bin/env bash
# Increments CURRENT_PROJECT_VERSION in project.yml (TestFlight needs a new build number per upload).
set -euo pipefail
cd "$(dirname "$0")/.."
read_build() { grep -E '^[[:space:]]*CURRENT_PROJECT_VERSION:' project.yml | head -1 | sed -E 's/.*"([0-9]+)".*/\1/'; }
cur=$(read_build)
[[ "$cur" =~ ^[0-9]+$ ]] || { echo "bump_build: cannot read CURRENT_PROJECT_VERSION" >&2; exit 1; }
next=$((cur + 1))
sed -i '' -E "s/^([[:space:]]*CURRENT_PROJECT_VERSION:) \"${cur}\"/\1 \"${next}\"/" project.yml
[[ "$(read_build)" == "$next" ]] || { echo "bump_build: project.yml was not updated" >&2; exit 1; }
echo "build ${cur} → ${next}"
