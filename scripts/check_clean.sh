#!/usr/bin/env bash
# Fails if the tree or git history contains tooling attribution or scratch files
# that do not belong in this repository.
set -u
cd "$(dirname "$0")/.."
status=0
patterns='Co-Authored-By|CLAUDE\.md|\.claude/|[Gg]enerated with \[|Anthropic|claude\.ai|Claude Code'
# Only files git would ship: tracked plus untracked-but-not-ignored.
hits=$(git ls-files -co --exclude-standard -z 2>/dev/null | grep -zv 'scripts/check_clean.sh' | xargs -0 grep -EIl "$patterns" 2>/dev/null || true)
if [ -n "$hits" ]; then
  echo "check_clean: disallowed text in files:"; echo "$hits"; status=1
fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  loghits=$(git log --all --format='%H %s%n%b' 2>/dev/null | grep -En "$patterns" || true)
  if [ -n "$loghits" ]; then echo "check_clean: disallowed text in git history:"; echo "$loghits"; status=1; fi
fi
# Brand (T085): the old product name must not appear outside dated history. Allowed: the history
# logs below (entries describe the past) and the Blob store names, which are infrastructure labels.
brand='maker[ _-]?story'
brand_allowed='^(docs/(decisions|deployments|progress|incidents)\.md|docs/reviews/.*)$'
brandhits=$(git ls-files -co --exclude-standard 2>/dev/null | grep -Ev "$brand_allowed" | grep -v '^scripts/check_clean.sh$' \
  | tr '\n' '\0' | xargs -0 grep -EInHi "$brand" 2>/dev/null | grep -Ev 'maker-story-(public|private)' || true)
if [ -n "$brandhits" ]; then
  echo "check_clean: old product name outside history (rename to The 3rd Eye):"; echo "$brandhits"; status=1
fi
for f in CLAUDE.md .claude; do [ -e "$f" ] && { echo "check_clean: $f must not exist"; status=1; }; done
[ $status -eq 0 ] && echo "check_clean: ok"
exit $status
