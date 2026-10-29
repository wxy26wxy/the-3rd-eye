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
- Unfinished: not yet exercised end to end against live routes (backend in progress); API fixtures are hand-written from docs/api.md; `gen_tokens.ts` should emit `enum TypeScale` (iOS works around it at build time); camera and microphone need a real phone (the simulator falls back to the photo library).
