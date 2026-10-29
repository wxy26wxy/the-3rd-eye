# Progress log

Append-only. Each entry: task id · role · branch · what was done · commits · how to verify · what is unfinished. Task ids are `T###` and are referenced in commit messages.

## 2026-10-28

### T001 · pm · main · Repository bootstrap
- Repo created with license, ignore rules, `scripts/check_clean.sh`, workspace config, `docs/` process memory.
- Next.js app scaffolded in `web/` (App Router, TypeScript, no Tailwind). Vercel project linked.
- Verify: `bash scripts/check_clean.sh` prints ok; `pnpm --filter web build` succeeds.

### T030 · ios · feat/ios-T01x · SwiftUI creator app
- XcodeGen project (`ios/project.yml`, target `MakerStory`, `com.makerstory.app`, iOS 17, no entitlements), bundled OFL fonts (Bagel Fat One, Rubik), Theme layer over generated tokens, all designed screens (Welcome → Pick product → Choose method → photo branch Camera / Finding drawings / Tap to select, voice branch Speak / Drawing your idea / Voice result → Design ready → Listing details → Story video → Video saved → You're live; Home tabs Create / My designs / Orders (10 s polling, badge) / Messages; Order detail; Thank-you composer; Settings; Code entry), networking (`APIClient`, Blob client upload, transcription), on-device speech.
- Verify:
  - `cd ios && xcodegen generate`
  - `xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData build` → BUILD SUCCEEDED, no warnings in app code
  - `xcodebuild test -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData` → 19 tests, 0 failures
  - Run: `xcrun simctl boot "iPhone 17"; xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/MakerStory.app; xcrun simctl launch booted com.makerstory.app`
  - Point at a deployment: add `API_BASE_URL=https://<host>` to the xcodebuild command.
- Unfinished: not yet exercised end to end against live routes (backend in progress); API fixtures are hand-written from docs/api.md; camera and microphone need a real phone (the simulator falls back to the photo library).

### T030 fix round 1 · ios · feat/ios-T01x
- Speech stops on create-flow route change (not on disappear), so arrival speech (confirmation, voice-result description, design ready, video saved, you're live) is no longer cancelled by the previous screen. Voice approval runs the same validation as the button. Sign out resets the orders store. Merged main (T005 `TypeScale` tokens) and removed the token build workaround. An empty answer to a clarifying question skips it. The spoken confirmation is shown as text while drawing. Videos upload as private Blob media with a public fallback. Retake returns to the source used. Choice cards and other custom buttons no longer expose a duplicate nested button to VoiceOver. Fixed a freeze: stopping speech mid-sentence deadlocked the main thread on iOS 27 (stop now runs off the main thread). Voice input is recorded as 16 kHz WAV (the transcription model accepts WAV only).
- Verify: `xcodebuild test -scheme MakerStory ...` (unit, 27 tests); `python3 ios/scripts/mock_api.py &` then `xcodebuild test -scheme MakerStoryUITests ... API_BASE_URL=http://localhost:3999` (voice flow UI test).
