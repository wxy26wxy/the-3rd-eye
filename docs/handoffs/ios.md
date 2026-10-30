# Handoff · ios

## Owns
`ios/**` (except `ios/App/Theme/Tokens.swift`, generated from `design/tokens.json`).

## Current task
T081 · remove duplicated voice/speech UI and rely on iOS system accessibility (see "System accessibility (T081)" below and `docs/accessibility.md`). Earlier: T070 deep link, T060 TestFlight, T051 fix wave, T030 SwiftUI creator app.

## Install on your iPhone (deployed site)
1. On the Mac: `cd ios && xcodegen generate && open MakerStory.xcodeproj` (needs Xcode and `brew install xcodegen`).
2. Plug in the iPhone (unlock it, tap "Trust"). On the phone turn on Settings → Privacy & Security → Developer Mode if asked, and restart it.
3. In Xcode select the **MakerStory** target → **Signing & Capabilities** → Team: your Apple ID ("Personal Team"; add it under Xcode → Settings → Accounts if missing). If the bundle id `com.makerstory.app` is taken, change it to something unique like `com.<yourname>.makerstory`.
4. Pick **Product → Scheme → Edit Scheme… → Run → Build Configuration: Release**, so the app talks to `https://maker-story-three.vercel.app` (Debug talks to `http://localhost:3000`, which on a phone is the phone itself). To use another deployment, set Build Settings → User-Defined → `API_BASE_URL` (Release) to its https URL.
5. Choose the phone as the run destination and press **Run**. First time only: on the phone open Settings → General → VPN & Device Management → your Apple ID → Trust, then open the app.
6. In the app: on My designs, Orders or Messages, the sign-out button (top right) shows the version and server URL in its confirmation; tap Cancel to stay signed in. Sign in with your creator code (codes are issued per creator and are not in the repo). Allow camera and microphone when asked; if you said no, the app shows an "Open Settings" button.
7. Check on the phone: record a story video (captions need the soundtrack, which the app now sends), accept or edit the drafted story, send a thank-you with a short video. Free provisioning expires after 7 days; press Run again to renew.

## Build and run
```
cd ios
xcodegen generate
xcodebuild -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData build
xcodebuild test -scheme MakerStory -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData
xcrun simctl boot "iPhone 17"; xcrun simctl install booted build/DerivedData/Build/Products/Debug-iphonesimulator/MakerStory.app; xcrun simctl launch booted com.makerstory.app
```
Server: build setting `API_BASE_URL` (Debug default `http://localhost:3000`, Release default `https://maker-story-three.vercel.app`; empty or invalid falls back to the deployed site), e.g. `xcodebuild ... API_BASE_URL=https://<deployment> build`. Only `localhost` has an ATS exception; any deployed server must be https. On a physical phone `localhost` is the phone itself, so point it at the deployment.
Without the backend: `python3 scripts/mock_api.py` (port 3999) and build with `API_BASE_URL=http://localhost:3999`. UI tests (voice branch: the confirmation text on the loading screen and the "WHAT THE IMAGE SHOWS" card with the description on Voice result; deep link):
`xcodebuild test -scheme MakerStoryUITests -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData API_BASE_URL=http://localhost:3999`
On a phone: see "Install on your iPhone" above. No entitlements are used.
The mock also answers `POST /creators/me/story-video` (logs `audioUrl`, returns a `storyDraft`) and `POST /orders/o1/thank-you`.

## Layout
- `App/Theme/` — the only place tokens are read: `Theme` aliases, `ThemeColors` (standard / high contrast via `@Environment(\.themeColors)`; `ThemeColors.resolved(for:)` picks high contrast when the system's Increase Contrast is on), `TextRole` fonts (Bagel Fat One + Rubik, Dynamic Type), `DisplayText`, `PillButton(Style)`, `IconButton`, `Card`/`ChoiceCard`, `StepPill`, `Starburst`, `ScallopDivider`/`CreamSheet`, `GrainOverlay`/`screenBackground()`, `TagMascot` (listening, cheering, waving). `ThemeEffects` holds `effects`/`motion` values the generator does not emit yet.
- `App/Networking/` — `APIClient` (all `/api/v1` routes, Bearer token in Keychain), `Models` (Codable from docs/api.md), `APIError`, `BlobUploader`, `Transcriber`, `Keychain`.
- `App/Services/` — `VideoTools` (length cap by passthrough trim; soundtrack → 16 kHz mono WAV via `AVAssetReader`) and `VideoUpload` (video + WAV upload, used by story and thank-you), `AudioRecorder` (16 kHz mono PCM WAV, ≤ 60 s; used only by `SpeakView` and "Say what to change"), `Poller`, `OrdersStore` (10 s polling, unread badge), `Money` (share), `ImageTools`, `DeepLink`. No text-to-speech.
- `App/Components/` — `SlowWorkHint` (after 30 s on long calls), `CameraAccess`/`CameraDeniedCard` (permission check, Settings link), `FlowScreen`, `TabScreen` (header with `SignOutButton`), `LoadingScreen` (announces the "I HEARD" text and the detail together), `VoiceCapture`/`RecordButton` (only `SpeakView` and `VoiceResultView`), `LabeledTextField` (no mic; keyboard dictation), `View.announces(_:)` (VoiceOver announcement on appear and on change; the text must also be on screen), `RemoteImage`, `ErrorCard`, `MediaPicker`, `SafariView`.
- `App/Screens/` — one view per file, named after the design boards.
- Copy: `App/Resources/Localizable.xcstrings` (refresh with `xcodebuild -exportLocalizations -project MakerStory.xcodeproj -localizationPath /tmp/loc -exportLanguage en`).

## Interface exposed to others
- Calls exactly the routes and field names in `docs/api.md`. Upload pathnames: `creators/<creatorId>/{photos|story-video|thank-you-images|thank-you-videos|audio}/<uuid>.<ext>`; the token request carries `clientPayload` `{"kind": "<folder>"}`.
- Story video and thank-you video requests carry `audioUrl` (pathname of `creators/<id>/audio/<uuid>.wav`, 16 kHz mono 16-bit PCM, ≤ 30 s / 15 s) when the video has sound.
- Reads optional `Creator.storyDraft` (`{ headline?, bio_short|bioShort?, story_text|storyText? }` or a string) from the story-video answer or `GET /creators/me`; "Use" sends `PUT /creators/me { storyText }`.
- Any 401 on a request that carried the token signs the app out (token expiry). Long calls wait 300 s.
- Photos are uploaded as JPEG without EXIF/GPS/TIFF metadata.
- Photo artworks are created with the Blob `url`; videos are sent as Blob `pathname`.
- `POST /listings/{id}/run` is sent with an empty JSON object body.

## Open questions for other roles
- backend: please document `Creator.storyDraft` in docs/api.md (the app accepts the `/story/draft` field names or camelCase) and clear it once the creator chose Use or Skip, or the sheet comes back on the next story video. The app does not tell the server about Skip.
- backend: the soundtrack WAV sits in the public store after captioning; deleting it once captions are made would match the "originals" fix.
- backend: `/uploads` must answer the client-token event with `{ clientToken }`. Videos are put with `access: private` (one retry as public if refused); photos are public. Please compute `creatorShareCents` as floor(price × creator_bps / 10 000) to match the app.
- backend: `GET /orders?since=` only brings new orders; status and unread changes on older orders appear on pull to refresh / tab open. A `since` that also covers updated rows would make the badge exact.

## Not verified on a device
Soundtrack extraction from a real camera `.mov` (unit test uses a generated 1 s PCM asset), camera-permission flow, interruption handling, the story-draft sheet against the live backend, 401 from the live backend's token expiry.

## Last updated
2026-10-29 (T081)

## TestFlight (T060)
- Icon: `pnpm icon` renders `ios/App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` from `design/tokens.json` (no alpha, as App Store Connect requires). To use a designer-made icon, replace that PNG.
- Settings in `ios/project.yml`: `DEVELOPMENT_TEAM` (the Apple Developer Program team), `MARKETING_VERSION` (0.3.0), `CURRENT_PROJECT_VERSION` (build number; `ios/scripts/bump_build.sh` increments it, every upload needs a new one). `Info.plist` sets `ITSAppUsesNonExemptEncryption` to false (HTTPS only) so builds skip the export-compliance question.
- Release builds talk to the production site (`API_BASE_URL` in `project.yml`); TestFlight installs are Release.
- Upload: `bash ios/scripts/testflight.sh` (bumps the build number, `xcodegen generate`, archives with `-allowProvisioningUpdates`, exports with `ios/ExportOptions.plist` using `method app-store-connect`, `destination upload`). Xcode must be signed in with the team's Apple ID (Xcode → Settings → Accounts), or export `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_PATH` for an App Store Connect API key kept outside the repo.
- First time only: create the app record in App Store Connect (My Apps → + → New App → iOS, bundle id `com.makerstory.app`, SKU `maker-story`).
- Testers: App Store Connect → TestFlight. Internal testers are team members (add the person under Users and Access first); they get the build minutes after processing. External testers use a group with a public link; the first build goes through Beta App Review (about a day). Give each tester one creator code privately; never put codes in the test notes.
- Log every upload in `docs/deployments.md` (version, build, git sha, who was invited).

## Deep link (T070)
- `makerstory://code/<CODE>` (scheme registered in `Info.plist` `CFBundleURLTypes`) is parsed by `App/Services/DeepLink.swift`; `AppState.open(_:)` stores it as `pendingCode` while signed out, `RootView` pushes the code screen, and `CodeEntryView` fills the field once and shows "We filled in your code from the link. Tap Sign in." (no auto-submit). Ignored while signed in.
- The web task T070 shows this link on the `/admin` one-time code card next to the web link (merged separately). iOS shows the system "Open in maker story?" prompt first.
- Tests: `Tests/DeepLinkTests.swift` (parse, cleanup, length cap, pending only while signed out) and `UITests/DeepLinkUITests.swift` (opens the link against `scripts/mock_api.py`, accepts the Springboard prompt, checks the prefilled field).
- Universal links (https) would need an apple-app-site-association file on the site; not done.

## System accessibility (T081)
- No in-app speech, no per-field mic, no settings sheet, no helper-mode toggle (ADR 2026-10-29 in `docs/decisions.md`). iOS dictation, VoiceOver, Dynamic Type (up to `accessibility5`) and Increase Contrast do those jobs. `simpleMode` from the web profile is still read; the other `AccessPrefs` flags are decoded but unused on iOS.
- Voice result shows a "WHAT THE IMAGE SHOWS" card (`spokenDescription`, else `altText`, for the selected picture) and announces it on arrival and when the picture changes; the picture's VoiceOver label is its alt text.
- Announced once (and shown): the clarifying question (SpeakView), the drawing confirmation (loading screen), "Your design is ready! …", "You're live! …", "Video saved!", the story talking points, the drafted story, the AI listing summary and the listing validation error.
- Kept voice features: "Say it out loud" (SpeakView, starts in voice mode; "Type instead" stays) and "Say what to change" on Voice result.
- Listing approval is a tap; the thank-you is typed (the `draftThankYou` client call stays in `APIClient` but no screen uses it).
- Sign out: icon button in the tab-screen header (My designs, Orders, Messages) with a confirmation that also shows the version and server URL.
- Tests: `Tests/SystemAccessibilityTests.swift` (contrast → palette, description fallback); `UITests/VoiceFlowUITests.swift` asserts the description card and that no Hear/Stop button exists.
- VoiceOver test script (Speak → Voice result with the description card): `docs/accessibility.md`.
