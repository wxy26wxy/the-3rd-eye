# Handoff · ios

## Owns
`ios/**` (except `ios/App/Theme/Tokens.swift`, generated from `design/tokens.json`).

## Current task
T030 · SwiftUI creator app (XcodeGen, iOS 17) building and running in the simulator against `docs/api.md`.

## Build and run
```
cd ios
xcodegen generate
xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData build
xcodebuild test -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData
xcrun simctl boot "iPhone 17"; xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/MakerStory.app; xcrun simctl launch booted com.makerstory.app
```
Server: build setting `API_BASE_URL` (Debug default `http://localhost:3000`), e.g. `xcodebuild ... API_BASE_URL=https://<deployment> build`. Only `localhost` has an ATS exception; any deployed server must be https. On a physical phone `localhost` is the phone itself, so point it at the deployment.
Without the backend: `python3 scripts/mock_api.py` (port 3999) and build with `API_BASE_URL=http://localhost:3999`. UI test of the voice branch (checks the confirmation text on the loading screen, that the description is speaking when Voice result appears, and that stopping it mid-sentence doesn't freeze the app). Speech events are logged under subsystem `com.makerstory.app`, category `speech` (`xcrun simctl spawn booted log stream --level debug --predicate 'subsystem == "com.makerstory.app"'`):
`xcodebuild test -scheme MakerStoryUITests -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build/DerivedData API_BASE_URL=http://localhost:3999`
On a phone: open `ios/MakerStory.xcodeproj` in Xcode, choose your Personal Team under Signing, pick the phone, Run. No entitlements are used.

## Layout
- `App/Theme/` — the only place tokens are read: `Theme` aliases, `ThemeColors` (standard / high contrast via `@Environment(\.themeColors)`), `TextRole` fonts (Bagel Fat One + Rubik, Dynamic Type), `DisplayText`, `PillButton(Style)`, `IconButton`, `Card`/`ChoiceCard`, `StepPill`, `Starburst`, `ScallopDivider`/`CreamSheet`, `GrainOverlay`/`screenBackground()`, `TagMascot` (listening, cheering, waving). `ThemeEffects` holds `effects`/`motion` values the generator does not emit yet.
- `App/Networking/` — `APIClient` (all `/api/v1` routes, Bearer token in Keychain), `Models` (Codable from docs/api.md), `APIError`, `BlobUploader`, `Transcriber`, `Keychain`.
- `App/Services/` — `Speech` (AVSpeechSynthesizer; respects "Speak descriptions"; hands off to VoiceOver announcements when VoiceOver is on; stopped by any real create-flow route change in `AppState.createPath.didSet`, so arrival speech is not cancelled by the old screen; never stops the synthesizer on the main thread, see docs/decisions.md), `AudioRecorder` (16 kHz mono PCM WAV, ≤ 60 s), `Poller`, `OrdersStore` (10 s polling, unread badge), `Money` (share), `VoiceIntent` ("yes" detection), `ImageTools`.
- `App/Components/` — `FlowScreen`, `TabScreen`, `LoadingScreen`, `VoiceCapture`/`RecordButton`/`MicIconButton`, `VoiceTextField`, `RemoteImage`, `ErrorCard`, `MediaPicker`, `SafariView`.
- `App/Screens/` — one view per file, named after the design boards.
- Copy: `App/Resources/Localizable.xcstrings` (refresh with `xcodebuild -exportLocalizations -project MakerStory.xcodeproj -localizationPath /tmp/loc -exportLanguage en`).

## Interface exposed to others
- Calls exactly the routes and field names in `docs/api.md`. Upload pathnames: `creators/<creatorId>/{photos|story-video|thank-you-images|thank-you-videos}/<uuid>.<ext>`; the token request carries `clientPayload` `{"kind": "<folder>"}`.
- Photo artworks are created with the Blob `url`; videos are sent as Blob `pathname`.
- `POST /listings/{id}/run` is sent with an empty JSON object body.

## Open questions for other roles
- backend: `/uploads` must answer the client-token event with `{ clientToken }`. Videos are put with `access: private` (one retry as public if refused); photos are public. Please compute `creatorShareCents` as floor(price × creator_bps / 10 000) to match the app.
- backend: `GET /orders?since=` only brings new orders; status and unread changes on older orders appear on pull to refresh / tab open. A `since` that also covers updated rows would make the badge exact.

## Last updated
2026-10-28
