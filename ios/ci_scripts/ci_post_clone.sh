#!/bin/sh
# Xcode Cloud runs this after cloning. The Xcode project is generated from
# ios/project.yml by XcodeGen and is not committed, so generate it here before
# Xcode Cloud looks for ios/The3rdEye.xcodeproj.
set -eu
if ! command -v xcodegen >/dev/null 2>&1; then
  brew install xcodegen
fi
cd "${CI_PRIMARY_REPOSITORY_PATH:-$(dirname "$0")/../..}/ios"
xcodegen generate
