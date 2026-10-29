#!/usr/bin/env bash
# Archive the Release build and upload it to TestFlight.
#   bash ios/scripts/testflight.sh            # bump build number, archive, upload
#   bash ios/scripts/testflight.sh --no-bump  # reuse the current build number
# Signing: Xcode must be signed in with the team's Apple ID (Xcode → Settings → Accounts);
# -allowProvisioningUpdates creates the App Store profile. For a headless upload export
# APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID and APP_STORE_CONNECT_KEY_PATH
# (an App Store Connect API key kept outside the repo) and they are passed through.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "${1:-}" != "--no-bump" ]]; then bash scripts/bump_build.sh; fi
build=$(grep -E '^\s*CURRENT_PROJECT_VERSION:' project.yml | head -1 | sed -E 's/.*"([0-9]+)".*/\1/')
version=$(grep -E '^\s*MARKETING_VERSION:' project.yml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
echo "maker story ${version} (${build}) → TestFlight"
xcodegen generate >/dev/null
auth=()
if [[ -n "${APP_STORE_CONNECT_KEY_PATH:-}" ]]; then
  auth=(-authenticationKeyPath "$APP_STORE_CONNECT_KEY_PATH" \
        -authenticationKeyID "$APP_STORE_CONNECT_KEY_ID" \
        -authenticationKeyIssuerID "$APP_STORE_CONNECT_ISSUER_ID")
fi
archive="build/MakerStory-${version}-${build}.xcarchive"
xcodebuild -scheme MakerStory -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive" -allowProvisioningUpdates "${auth[@]}" archive | tail -3
xcodebuild -exportArchive -archivePath "$archive" \
  -exportOptionsPlist ExportOptions.plist -exportPath "build/export-${build}" \
  -allowProvisioningUpdates "${auth[@]}" | tail -5
echo "Uploaded ${version} (${build}), git $(git rev-parse --short HEAD). Record it in docs/deployments.md."
