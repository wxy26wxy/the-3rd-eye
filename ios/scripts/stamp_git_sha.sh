#!/usr/bin/env bash
# Writes the short git sha into the built Info.plist (key GitSHA) so Settings
# can show exactly which commit is running. Falls back to the GIT_SHA build
# setting ("dev") when git is unavailable.
set -uo pipefail
plist="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"
sha=$(git -C "${SRCROOT}" rev-parse --short HEAD 2>/dev/null || echo "${GIT_SHA:-dev}")
if ! git -C "${SRCROOT}" diff --quiet HEAD 2>/dev/null; then sha="${sha}+"; fi
/usr/libexec/PlistBuddy -c "Set :GitSHA ${sha}" "$plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :GitSHA string ${sha}" "$plist"
