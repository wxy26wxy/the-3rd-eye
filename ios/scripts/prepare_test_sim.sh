#!/usr/bin/env bash
# Prepares a simulator for the UI tests (T145): turns off the keyboard's suggestions, autocorrection,
# slide-to-type and its first-use tips, which can keep the app from reporting "idle" while a text
# field has focus (XCTest then waits 60 s per step), and removes the app for a fresh install.
# Run it once on the simulator the tests clone, before `xcodebuild test`:
#   scripts/prepare_test_sim.sh <sim id>
set -euo pipefail
sim="${1:?usage: scripts/prepare_test_sim.sh <sim id>}"
state=$(xcrun simctl list devices | grep "$sim" | grep -o "(Booted)" || true)
[ -n "$state" ] || xcrun simctl boot "$sim"
xcrun simctl bootstatus "$sim" >/dev/null
for key in KeyboardPrediction KeyboardAutocorrection KeyboardAutocapitalization KeyboardCheckSpelling \
           KeyboardContinuousPathEnabled KeyboardShowPredictionBar KeyboardInlinePrediction KeyboardSmartPunctuation; do
  xcrun simctl spawn "$sim" defaults write com.apple.Preferences "$key" -bool NO
done
for key in DidShowContinuousPathIntroduction KeyboardDidShowProductivityTutorial DidShowGestureKeyboardIntroduction; do
  xcrun simctl spawn "$sim" defaults write com.apple.Preferences "$key" -bool YES
done
xcrun simctl uninstall "$sim" com.the3rdeye.app 2>/dev/null || true
# Parallel testing clones a shut-down simulator.
xcrun simctl shutdown "$sim"
echo "prepared $sim"
