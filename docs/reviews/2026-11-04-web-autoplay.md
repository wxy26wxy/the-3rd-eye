# Review: web story video autoplay (75f00ed, base 7942f99)

## Verdict

- Spec compliance: Yes (autoplay muted, real play button, Tap for sound pill, reduced motion intent, captions default, strings, CSS, tests, docs all present). Two behaviours do not hold in practice, see Major 1 and 2.
- Quality: Request changes

## Findings

### Major 1: reduced motion is not honoured, the `autoplay` attribute starts the video anyway
`web/components/site/VideoPoster.tsx:39` and `:25`.
The video is rendered server-side with `autoplay=""`, `muted=""` and `preload="auto"`. The browser starts it from the HTML attribute before hydration, so the `prefers-reduced-motion` check in the effect (line 25) runs too late. The effect only sets `v.muted = false` and returns. A reduced-motion visitor still gets a moving video, and with `muted=false` set after the fact the element is left playing silently with `muted` state `true` until `volumechange` fires.
Fix: do not render the `autoPlay` attribute. Start playback only from the effect with `v.play()` (muted property already set), after the reduced-motion check. That also removes the double-start (attribute plus `play()`) and the question of which one wins. Update the test that asserts `autoplay=""` to assert its absence plus `muted` and `preload="auto"`.

### Major 2: a play that happens before hydration is missed, leaving the play button over a playing video and no pill
`web/components/site/VideoPoster.tsx:19`, `:40`, `:44`, `:49`.
`started` only flips from `onPlay`. Media events do not bubble and React attaches the `play` listener at hydration. With `autoplay` in the server HTML and `preload="auto"`, the video can start before hydration on a fast connection; that `play` event is lost. Result: `started` stays `false`, the 64 px play button stays drawn over a running video, and the "Tap for sound" pill never shows. The effect's `play()` call on an already playing element fires no new `play` event, so nothing recovers it.
Fix: removing the attribute (Major 1) closes most of this, because playback then begins from the effect after listeners exist. For robustness also derive the initial state from the element without setState in an effect, for example a ref callback or `onLoadedMetadata`/`onPlaying` handler that sets `started` when `!v.paused`, or `onPlaying` in addition to `onPlay`.

### Minor 1: "Tap for sound" pill target is about 30 px high
`web/components/site/StoryVideo.module.css` (`.sound`, padding `--space-xs` and `--space-l`, caption 13 px at line height 1.4).
That is roughly 18 px of text plus 12 px padding, under the 44 pt target the accessibility doc applies elsewhere, and it sits on a phone-first page. Fix: `min-height: 2.75rem` with `display: inline-flex; align-items: center`.

### Minor 2: focus ring on the pill can vanish over a bright frame
`web/components/site/StoryVideo.module.css` (`.sound:focus-visible`, `.play:focus-visible`).
A white outline is correct on the dark `--primary` frame, but the pill is a white shape over live video; on a bright shot a white ring around a white pill has little contrast. The play button has the same issue only until first play, when the frame is dark, so it is fine. Fix for the pill: a two-tone ring (`box-shadow: 0 0 0 2px var(--text), 0 0 0 4px var(--surface)`), as `app/globals.css` already does at line 98.

### Minor 3: pill wording and announcement
`web/messages/en.json` (`common.tapForSound`), `web/components/site/VideoPoster.tsx:49`.
The pill is a real button, reachable by Tab after the video's own controls and announced as "Tap for sound, button". "Tap" is touch-specific for keyboard and screen-reader users. Consider "Turn sound on". When it disappears (after unmuting) focus is lost to the body; acceptable for a transient control, but moving focus to the video would be kinder. Not blocking.

### Minor 4: no client-side coverage of the stateful paths
`web/test/video-poster.test.ts`.
See What was checked. The pill, the refused-autoplay `.catch`, the reduced-motion branch and `onVolumeChange` sync are untested.

## What was checked

- Autoplay path. `v.muted = true` before `play()` is the right call for iOS Safari and Chrome Android; the property is what the autoplay policy reads, and React renders `muted=""` in HTML but does not reliably reflect the prop to the property on hydration, so setting it explicitly is correct. The effect runs after hydration, when the `<source>` child is already in the server DOM; `play()` on a `<video>` with `<source>` children is valid (it queues behind resource selection). The race is not source-related but the attribute-plus-`play()` duplication in Major 1 and 2.
- `started` and the pill. With autoplay, `onPlay` sets `started` and `muted` is `true`, so the pill shows (subject to Major 2). After the user unmutes through native controls, `onVolumeChange` sets `muted` false and the pill goes. After the video ends and replays, `started` stays true and the pill state follows `muted`; no play button reappears, correct since native controls are available. If never unmuted, the pill persists, including while paused mid-way; fine.
- Refused-autoplay (Low Power Mode). `.catch` sets `v.muted = false`; `volumechange` sets `muted` false; `started` stays false, so the play button is visible and no pill. State is consistent. The tap runs `playWithSound` with a user gesture, so it plays with sound. Correct.
- Accessibility. Both controls are real `<button type="button">`; the play button is labelled `Play <name>` and removed after first play, so a mid-way pause label is not an issue. The `<video>` keeps its own `aria-label`. Captions track is still `default`. Text contrast of `--text` (#111827) on `--surface` (#FFFFFF) is far above 4.5:1. Reduced motion: see Major 1. Focus and target size: Minor 1 and 2.
- Other users of `VideoPoster`. Only `StoryVideo` imports it. `StoryVideo` is used by `StoryTagView` and `CreatorProfile` (both pass `autoPlay`) and `components/product/ProductParts.tsx` (no autoplay: `preload="metadata"`, muted false, no pill; it does gain the real play button, which is intended).
- React compiler lint rule. The effect contains no setState; state updates are in element event handlers. `pnpm lint` is clean.
- Tests. `web/test/video-poster.test.ts` pins autoplay, muted, preload, playsinline, play button label, source URL and default captions track, and the non-autoplay case (no autoplay, metadata preload, button present, no pill text). `web/test/site-pages.test.ts` assertion updated. Gap: the pill cannot render server-side. A client-side test is not feasible as the setup is Node-only (`environment: "node"`, no jsdom, happy-dom or testing-library in `web/package.json`). A cheap alternative: extract the effect body into a pure function `startMuted(v, reducedMotion)` that takes a fake element (`{ muted, play }`) and unit-test the reduced-motion, success and rejection branches in Node.
- Clean-repo rules. Searched the added lines for assistant or model-vendor names, absolute machine paths and env values: none found.

## Gates run

- `pnpm vitest run test/video-poster.test.ts test/site-pages.test.ts` in `web`: 2 files, 24 tests passed.
- `pnpm lint` in `web`: clean, no output beyond the script header.
- Full build and iOS suites not run, as instructed. The real-device behaviour (Major 1 and 2) was found by reading the code, not reproduced on a phone; re-check on the phone after the fix.

## Re-review (fix round 1)

Scope: commits 1cd2461 and 7903081 (fix diff `review-autoplay-fix.diff`). Only the earlier findings were re-checked.

- Major 1 (reduced motion defeated by the attribute): addressed. `autoPlay={autoPlay}` is gone from the `<video>` (`web/components/site/VideoPoster.tsx:42`). Playback starts only in the effect (lines 23-30), after the reduced-motion check; `muted={muted}` still renders `muted=""` in the server HTML because the initial state is `autoPlay`.
- Major 2 (play missed before hydration): addressed. With no attribute, nothing can play before the effect, and effects run after React has attached the `play` listener, so `onPlay` (line 43) cannot be missed. `started` therefore reliably hides the play button and shows the pill.
- Minor 1 (pill height): addressed. `.sound` is `inline-flex` with `min-height: 2.75rem` (`web/components/site/StoryVideo.module.css`).
- Minor 2 (focus ring): addressed. `.sound:focus-visible` uses a two-tone `box-shadow` (text colour inside, surface outside), matching `app/globals.css`.
- Minor 3 (wording and focus): addressed. String is now `common.turnSoundOn` / "Turn sound on" in `web/messages/en.json` and the docs; `playWithSound` calls `v.focus()` so focus does not drop to the body when the button unmounts. The `tabIndex={-1}` side effect: it only removes the `<video>` element itself from the Tab order and makes it script-focusable. The native controls are separate focusable parts inside the element and are unaffected in Chromium, and Safari does not tab to the element's controls the same way. One small loss: in Firefox the video element with controls is normally a Tab stop (keyboard play/pause, arrow-seek), and that stop is gone until the user clicks or the script focuses it; the play and sound buttons are still reachable, so no blocker. See new Minor below.
- Minor 4 (no client-side test): accepted as a known gap (Node-only setup, no DOM library). Confirmed the SSR tests were updated: `web/test/video-poster.test.ts` now asserts `not.toMatch(/autoplay/i)` and still asserts `muted=""`, `preload="auto"` and `playsinline`; the pill-absent assertion uses `turnSoundOn`. The `startMuted` extraction idea from Minor 4 remains optional.

New finding (Minor): `web/components/site/VideoPoster.tsx:37` and `:42`. After a keyboard activation, `v.focus()` on a `tabIndex={-1}` video may draw the browser's default focus outline around the whole frame (programmatic focus after keyboard use matches `:focus-visible`). Check once on desktop Chrome and Firefox; if it looks wrong, give `.video:focus-visible` an inset ring in `StoryVideo.module.css` rather than removing the outline. Not blocking.

Gates (re-run): `pnpm vitest run test/video-poster.test.ts test/site-pages.test.ts` in `web`: 2 files, 24 tests passed. `pnpm lint` in `web`: clean.

Re-review verdict: Quality: Approve.

## Fix round 2 (PM)
- The new Minor: the player gets an inset focus ring (`.video:focus-visible`) instead of the browser default around the frame.
