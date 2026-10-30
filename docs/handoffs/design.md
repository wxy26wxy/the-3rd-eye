# Handoff · design

## Owns
`design/tokens.json`, `scripts/gen_tokens.ts` output review, `docs/design/screens.md`, this file. The design agent never edits the canvas (it is the designer's, read-only for the team) and never copies its files into the repo.

## Current task
T086: be ready to absorb the next canvas version within one hour.

## Baseline canvas version
`1793328546-ac11` (recorded by the T086 dry run, 2026-10-29). No earlier version id was written down, so this is the first entry. The ADR line in `docs/decisions.md` for each intake must carry the new id.

## Block A · Heads-up for the next version

For the designer and for the agent. Decided 2026-10-29; the code and id rename is task T085.

1. **Rename.** The brand changes from "maker story" to **The 3rd Eye**. The wordmark reads "THE 3RD EYE" in the same display style (Bagel Fat One, uppercase, cream with ink stroke and shadow). The mascot Tag is unchanged. Every board shows the old wordmark today: the logo board, the welcome header, the sticker/tote and story-page headers, and the Web-Green nav, hero and footer. The small mark (dark rounded square, lime dot, cream wave) has not been confirmed as kept; ask the designer.
2. **Removed from iOS (T081).** The Accessibility settings sheet, the helper-mode button, the "Hear what the image shows" play bar and the per-field mic icons. Voice stays only on "Say it out loud" and "Say what to change". The canvas still draws the helper-mode button on the welcome board and a "Your helper can hold the phone" line on the method board; both should go in the next version.
3. **No board on the canvas yet** (listed with descriptions in `docs/design/screens.md`): Adjust cutout (replaces Tap to select), Design detail, My designs status badges, admin Creators panel with the one-time code card, the web `/create/code?c=` prefill hint. Until boards arrive they are built from the existing tokens and primitives and marked "no board yet".
4. **What the team asks of the designer in the new version:** boards for the five items above; the new wordmark; confirmation of the 4 off-token colours listed under "Open questions"; keep board titles stable (the intake diffs by title and file name).

## Block B · Intake checklist for a new canvas version

Trigger: the PM says "new design version + link". Target: done within one hour. Rule: the agent never edits the canvas; everything below reads it and writes only to the repo.

Setup: Node 24 (with nvm: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24`).

1. **Read the version.** The PM supplies the canvas link (it is not stored in the repo). Use a read-only listing and read of the canvas (the Artifact tool: `list` with `scope: files`); note the version id printed in the header. The paths below are as seen in the baseline dry run; if they differ, work from the file listing. Read `project/canvas.json` (board list, titles, order) and every changed `project/*.dc.html`. Save nothing in git.
2. **Board inventory diff.** Compare against the previous id in this file and the board tables in `docs/design/screens.md`. For each board: new, removed, renamed, moved in flow, or unchanged. Record the result in a table in `docs/design/screens.md` under "Canvas intake log".
3. **Token diff.** Extract colours, font sizes, radii, shadows, spacing from the changed boards (for colours: `grep -oiE '#[0-9a-f]{6}\b'` over the board files, count, compare with `design/tokens.json` `color`). For radii, shadows, spacing and type sizes, read the board `style` attributes (for example `grep -oE 'border-radius: ?[0-9]+px'`) and compare with the matching token groups. Anything new or changed becomes an edit to `design/tokens.json` (keep `meta.updated` and `meta.source`; `meta.name` and `meta.source` still say "maker story" and follow the T085 rename), then regenerate: `pnpm tokens` (runs `scripts/gen_tokens.ts`, writes `web/app/tokens.css` and `ios/App/Theme/Tokens.swift`). Also run `pnpm icon` if the mark or colours changed. Values the generator does not yet emit (`effects`, `motion`) are mirrored in `ios/App/Theme` and checked by `ios/Tests/ThemeEffectsTests.swift`; run it (see step 4).
4. **No-raw-values check, both platforms.** There is no automated lint for this today (the web ESLint config and the iOS tests do not check it); run the manual check and report hits to Web and iOS:
   - web: `grep -rnE '#[0-9a-fA-F]{3,8}\b|[0-9]+px' web/components web/app --include='*.tsx' --include='*.css' | grep -v 'app/tokens.css'`. Baseline on main (ad42366): 7 accepted hits, all `1px` hairlines or visually hidden inputs: `ui/ChoiceCard.module.css:22`, `admin/Admin.module.css:7` and `:52`, `create/Create.module.css:75` and `:93`, `app/globals.css:73` and `:74`. Anything beyond these is new; report it.
   - iOS: `grep -rnE 'Color\(red|#colorLiteral|\.system\(size|Color\(hex' ios/App --include='*.swift' | grep -v 'Theme/'`. Baseline: 0 hits.
   Run `pnpm lint` from the root. For iOS, run the build and test commands in `docs/handoffs/ios.md` (section "Build and run", from `ios/`) with `-only-testing:MakerStoryTests/ThemeEffectsTests` added to the `xcodebuild test` line. The scheme name (now `MakerStory`) changes with T085; use the name in `ios/project.yml`. Proposing a real lint rule is a follow-up for the PM.
5. **Screen-map diff.** For every board that changed, update its row in `docs/design/screens.md` and classify it:
   - **tokens-only**: values changed, structure same.
   - **layout**: same components, different arrangement or spacing.
   - **new component**: a control or pattern with no primitive yet.
   - **copy**: wording only.
   Give each an estimate: S (under 1 hour), M (half a day), L (a day or more).
   - **new screen**: a board with no code behind it yet; usually L.
6. **Copy diff.** Compare every string on changed boards with `web/messages/en.json` and `ios/App/Resources/Localizable.xcstrings`. List additions, edits and deletions per file with key names. The agent does not edit these files; it hands the list to the owners (step 9).
7. **Accessibility flags back to the designer.** For each changed board: text/background contrast pairs under 4.5:1 (3:1 for large text; display headlines on green are a known deviation, see screens.md), targets under 44 px (60 px for primary actions), focus order, VoiceOver reading order and labels for new icon-only controls, motion that needs a reduced-motion variant. Send as a short list with board names.
8. **Decision line.** Add one line to `docs/decisions.md`: date, "canvas version `<id>` absorbed", what changed in one sentence, and the rejected alternative if any.
9. **Hand-off.** Create tasks with the next free T-number in the T09x range from the screen list: tokens-only first (Web and iOS in parallel, the same hour), then layout, then new components, then copy. Each task lists the boards, the class and estimate, and the verification (screenshots against the board, `pnpm test`, `xcodebuild test`). Update the baseline version id at the top of this file and the intake log in `docs/design/screens.md`.

## Open questions for the designer
- Four colours appear on the current canvas without a token: `#FBF4DF` (paper in camera and select illustrations), `#3C4A3D` (viewfinder and photo frame), `#CFE0A0` (loading spinner track), `#56705A` (waiting-step text, about 4.9:1 on cream and close to the existing `textMuted` `#4C6A50`). Are they tokens or illustration-only? Until answered they stay illustration-only and `#56705A` should map to `textMuted`.
- Is the small mark kept under the new name?

## Interface exposed to others
`design/tokens.json` is the only source of design values. After an intake, the per-screen `T09x` list in `docs/design/screens.md` is what Web and iOS build from.

## Last updated
2026-10-29
