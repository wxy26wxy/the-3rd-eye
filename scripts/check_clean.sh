#!/usr/bin/env bash
# Fails if the tree or git history contains tooling attribution or scratch files
# that do not belong in this repository.
set -u
cd "$(dirname "$0")/.."
status=0
patterns='Co-Authored-By|CLAUDE\.md|\.claude/|[Gg]enerated with \[|Anthropic|claude\.ai|Claude Code'
# Bare assistant name, any case (scratch paths such as /private/tmp/<name>-501 have slipped into filed reviews before).
bare_name='claude'
# Only files git would ship: tracked plus untracked-but-not-ignored.
hits=$(git ls-files -co --exclude-standard -z 2>/dev/null | grep -zv 'scripts/check_clean.sh' | xargs -0 grep -EIl "$patterns" 2>/dev/null || true)
barehits=$(git ls-files -co --exclude-standard -z 2>/dev/null | grep -zv 'scripts/check_clean.sh' | xargs -0 grep -Iil "$bare_name" 2>/dev/null || true)
hits=$(printf '%s\n%s\n' "$hits" "$barehits" | sed '/^$/d' | sort -u)
if [ -n "$hits" ]; then
  echo "check_clean: disallowed text in files:"; echo "$hits"; status=1
fi
if git rev-parse --git-dir >/dev/null 2>&1; then
  loghits=$(git log --all --format='%H %s%n%b' 2>/dev/null | grep -En "$patterns" || true)
  if [ -n "$loghits" ]; then echo "check_clean: disallowed text in git history:"; echo "$loghits"; status=1; fi
fi
# Brand (T085): the old product name must not appear outside dated history. Allowed: the history
# logs below (entries describe the past) and the Blob store names maker-story-public/-private,
# which are infrastructure labels; those two names are removed from each file before matching,
# so another mention of the old name on the same line is still caught.
# Self-test: the pattern catches, case-insensitively, "maker story", "makerstory", "maker-story",
# "maker_story", "maker.story", "maker  story" (two spaces), "maker–story" (en dash),
# "maker · story" (middle dot), "MakerStory" and "MAKER STORY"; up to 3 non-alphanumeric
# characters between the words. Check by adding a scratch file with each variant and running this.
brand='maker[^[:alnum:]]{0,3}story'
brand_allowed='^(docs/(decisions|deployments|progress|incidents)\.md|docs/reviews/.*)$'
brandhits=$(git ls-files -co --exclude-standard -z 2>/dev/null | grep -zEv "$brand_allowed" | grep -zv '^scripts/check_clean.sh$' \
  | while IFS= read -r -d '' f; do
      [ -f "$f" ] || continue
      grep -Iq . "$f" 2>/dev/null || continue   # skip binary and empty files
      sed -E 's/maker-story-(public|private)//g' "$f" | LC_ALL=en_US.UTF-8 grep -EIni "$brand" | awk -v f="$f" '{ print f ":" $0 }'
    done)
if [ -n "$brandhits" ]; then
  echo "check_clean: old product name outside history (rename to The 3rd Eye):"; echo "$brandhits"; status=1
fi
for f in CLAUDE.md .claude; do [ -e "$f" ] && { echo "check_clean: $f must not exist"; status=1; }; done
[ $status -eq 0 ] && echo "check_clean: ok"
exit $status
