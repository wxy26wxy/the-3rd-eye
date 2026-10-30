# Handoff · design

## Owns
`design/tokens.json`, `design/assets/`, `scripts/gen_tokens.ts` / `scripts/sync_assets.ts` / `scripts/gen_app_icon.ts` output review, `docs/design/screens.md`, this file. The design agent reads the Figma file and never writes to it.

## Source of truth
Since 2026-10-30 (T100) the single design source is **the Figma file (key `vIOMPzc2kjP18BbgduLmc8`)**, page `0:1` "Exploration 5 · Sky", eight iPhone frames at 390×844. It replaces the designer canvas ("Direction A"); the canvas link stays out of the repo. Name the file only by its key: its title carries the old product name and `scripts/check_clean.sh` rejects it.

The file has **no Figma variables**; values in `design/tokens.json` were read from node styles with `get_design_context`. The source of every value (node id, brief, ruling, accessibility floor, derived, carry-over) is in `docs/design/tokens.md`; node ids per screen are in `docs/design/screens.md`.

## Current task
T100 done on `feat/design-T100` (tokens v2, assets, docs; fix round 1 applied). Waiting on:
1. **The waving mascot.** `mascot-wave.png` stays `pending` in `tokens.json` (skipped by `pnpm assets`, not emitted to `web/lib/assets.ts` / `Tokens.Asset`): the waving mascot exists only inside Welcome's flattened background (`21:4229` has one image fill and no mascot layer) and in no other node of either file. Ask the designer for the separate PNG; until then `welcome-bg.png` is used whole.
2. **A 2x Welcome background** (see the intake record).

The user's copy of the file (key `dAdjR5HFtOutFlUZi957Do`, same page and node ids, on the user's own team with a Full seat) is the file to read from now on; another agent adds the generated boards to it (T101). Read-only for the design agent.

## Figma intake checklist (next version)

Trigger: the user says "new Figma version" (and the key, if it is a new file). Target: within one hour. Setup: Node 24 (`export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24`), `pnpm install --frozen-lockfile`.

Budget the Figma calls: a View seat allows very few per month; a Full seat on a paid plan allows many per day. Order calls so the most valuable come first: metadata, then `get_design_context` per changed frame (it returns asset URLs too), then `download_assets` only for what `get_design_context` did not cover. Asset URLs expire after 7 days: download with `curl -L` into a scratch folder right away.

1. **Session.** `create_session` with the file key and a one-line task. Pass the returned id on every later call. Load the `figma-design-to-code` skill before the first `get_design_context`.
2. **Inventory.** `get_metadata` on page `0:1`. Compare frame ids, names and sizes with the node table in `docs/design/screens.md`: new, removed, renamed, moved. Record the result in the "Figma intake log" there.
3. **Per-board context.** `get_design_context` on each new or changed frame (the screenshot comes with it). Keep the generated code in the scratch folder only; it is a reference, not code for the repo.
4. **Token diff.** From the returned styles, collect colours (`bg-[#…]`, `text-[#…]`, `border-[#…]`), font family / size / weight / line height / tracking, radii (`rounded-[…]`), border widths, shadows, paddings and gaps. Compare with `design/tokens.json`. Every new or changed value becomes an edit there, and its row in `docs/design/tokens.md` gets the node id. Values marked ruling, a11y or carry-over there need a decision before a board overwrites them. Values seen once on a single node (an illustration colour, an odd size) go to "Open questions" below instead of becoming tokens. Then `pnpm tokens` (writes `web/app/tokens.css`, `web/lib/brand.ts`, `web/lib/assets.ts`, `ios/App/Theme/Tokens.swift`) and `pnpm icon` if the logo or `color.accent` / `color.ink` changed. `effects` and `motion` are mirrored by hand in `ThemeEffects` (`ios/App/Theme/Theme.swift`) and checked by `ios/Tests/ThemeEffectsTests.swift`.
5. **Asset export.** For each image or vector on a board: raw photos come from `get_design_context` image URLs (the original upload) or `download_assets` `rawImages`; vectors from the SVG URLs. Commit to `design/assets/` with the names in `tokens.json` `assets` (PNG at 2x of its largest slot on the boards, SVG as exported). A photo with a Figma mask or crop is rendered at 2x with the same geometry the node uses (T100 did this for `mascot-book.png` and `tote.png`; numbers below). Then `pnpm assets` (copies to `web/public/assets/` and `ios/App/Assets.xcassets/<name>.imageset/` with 1x and 2x, keeps SVG vector, registers Inter in `Info.plist`). Check every file is non-empty and has the expected size: `file design/assets/*`.
6. **Raw-value check, both platforms.**
   - web: `grep -rnE '#[0-9a-fA-F]{3,8}\b|[0-9]+px' web/components web/app --include='*.tsx' --include='*.css' | grep -v 'app/tokens.css'`. Baseline after T100: the same 7 accepted hits as before (`1px` hairlines and visually hidden inputs: `ui/ChoiceCard.module.css:22`, `admin/Admin.module.css:7` and `:52`, `create/Create.module.css:75` and `:93`, `app/globals.css:73` and `:74`).
   - iOS: `grep -rnE 'Color\(red|#colorLiteral|\.system\(size|Color\(hex' ios/App --include='*.swift' | grep -v 'Theme/'`. Baseline: 0.
   - Then `pnpm -C web lint`, `pnpm -C web test`, `pnpm -C web build`, and from `ios/`: `xcodegen generate` and `xcodebuild -project The3rdEye.xcodeproj -scheme The3rdEye -destination 'id=<simulator id>' -only-testing:The3rdEyeTests/ThemeEffectsTests test`.
7. **Screen map.** Update the node table in `docs/design/screens.md`: node id → screen → web route / iOS view → status (designed / generated / pending). Classify each change as tokens-only, layout, new component, copy or new screen, with an S / M / L estimate.
8. **Copy diff.** Compare the board strings with `web/messages/en.json` and `ios/App/Resources/Localizable.xcstrings`; hand the list to Web and iOS (they own those files). A copy change also changes the matching UI test label and `screens.md` in the same commit.
9. **Accessibility flags.** Contrast pairs under 4.5:1 (3:1 for large text and for UI boundaries), targets under 44 px (primary under 56), icon-only controls without a label, reading order, motion. Write them to `docs/accessibility.md` "Designer flags" and to the open questions below.
10. **ADR line.** One entry in `docs/decisions.md`: date, "Figma file `<key>` intake", what changed, rejected alternatives. Never the file title.
11. **Hand-off.** Tasks in the T10x range: tokens-only first (Web and iOS in parallel), then layout, new components, copy.

## T100 intake record (2026-10-30)
- Original file: `create_session`, `get_metadata` (page `0:1`), `get_design_context` on Welcome `21:4229`, Pick sticker or tote `45:700`, Choose how to make it `21:4340`, Sticker ready `21:4509`; then the View seat's MCP allowance ran out.
- Copy (fix round 1): `get_design_context` on Finding drawings `21:4390`, Tap to select `21:4450`, Adjust `40:488`, You're live `21:4554`; `download_assets` on `45:813`, `45:746` (scale 2) and `21:4566`. All 8 boards are now read from node styles; new findings are in `docs/design/tokens.md` ("Seen on the boards, not tokenised").
- `mascot-book.png` (360×513): the raw fill of node `45:815` (1024×1152, opaque background) scaled to the node's image box (241.179×271.326), cropped to the "Vector 1" mask box (x 30.602, y 12.807, 179.753×256.664) and masked by `mascot-outline.svg`, at 2x. The same image is used on Pick sticker or tote (`45:724`, smaller slot). Compared with Figma's own 2x export of `45:813` (406×560): same crop and halo, but Figma's export bakes in the unmasked off-white image corners and a drop shadow, so the local render (clean alpha) is kept.
- `tote.png` (260×346): the raw fill of node `45:746` (1024×1152 with alpha), placed as the node does (left −9.84 %, top −11.18 %, 131.11 % × 111.2 % of the 130×173 slot) and cropped to the slot, at 2x. Figma's 2x export (307×393) is the same crop on a white background with the node's shadow baked in; the local render keeps alpha, and the shadow is `shadow.soft` in code.
- `mascot-magnifier.gif` (320×320, 121 frames, about 5 s, loops): the "Cloud dreamscape" fill of Finding drawings (`21:4406`). It is an animated GIF of the magnifier mascot on green, not a sky photo, so the brief's `sky-1` and `mascot-magnifier` are this one file. The slot is 342×415 with `object-fit: cover`, so it plays at about 1.2x upscaled; ask the designer for a larger source. Web serves the GIF (5.7 MB; T102 may prefer the MP4 in a muted looping `<video>`); iOS gets `Resources/Animations/mascot-magnifier.mp4` (147 KB). No APNG: it would be 12 MB.
- `sky.png` (684×572): the "Cloud dreamscape" fill of You're live (`21:4566`, raw JPEG 1024×1024), centre-cropped to the slot's 342×286 aspect and scaled to 2x. The mascot, the fern sticker and the tote badge on that board are separate layers, not in the fill.
- `mascot-front.png` (204×240): the "Mascot" fill on You're live (`21:4569`, component "Mascot / Front", `5:2`), as uploaded (palette PNG). The slot is 153.85×181, so it is about 1.3x; ask the designer for a larger source.
- `welcome-bg.png` (574×1024): Welcome's frame fill as uploaded (it includes the waving mascot, the totes and the clouds). The frame is 390×844, so the image is about 1.2x, not 2x; it is the largest version in both files. Ask the designer for a 780×1688 (or larger) export.
- Icons (`icon-*.svg`) and the logo mark are the SVGs as exported (strokes `#173D2B` on camera / image / mic / chevron, white on check / arrow, fill `#111827` on the logo). On iOS they are template images, so views tint them with tokens. The `icon-` prefix keeps the asset-catalog names (`ImageResource.iconCamera` …) clear of SF Symbol names.
- Inter: v4.1 from the rsms/inter GitHub release, `InterVariable.ttf` saved as `ios/App/Resources/Fonts/Inter-Variable.ttf` with `OFL-Inter.txt`; it registers as "Inter Variable" (`font.*.ios` in tokens.json). The web loads Inter through one `next/font/google` loader. Bagel Fat One and Rubik are removed from iOS and the web.

## Open questions for the designer
- **Off-token colours on the boards.** `#E4F3C8` (method icon circle, `45:751`), `#5FAE57` (selected radio border, `45:719`), `#19583C` (voice badge text, `45:770`), `#374151` (13 px message on Tap to select and Adjust, `45:690`, `45:693`), `#C6C6C6` (tote shadow colour, `45:746`; tokenised as `rgba(0,0,0,0.18)`). Tokens or one-offs? Until answered: icon circle → T102 decides (proposal `color.accentSoft`), radio border → `accentBorder`, badge text → `greenDeep`, message text → `textMuted`.
- **Figtree on Choose how to make it.** The method names and descriptions (`45:755`, `45:756` …) and the voice badge use Figtree (Bold 18, Regular 14, ExtraBold 10). Every other board uses Inter. Tokens use Inter everywhere; confirm.
- **Eyebrow size.** The board's badge is 10 px; tokens use 11 px caps with 0.08em tracking (ruling). It is the only text under 13 px: `caption` is 13 (ruling, the accessibility floor in `docs/accessibility.md`; the brief said 12).
- **Method card radius** is 18 (`45:749`), product cards 28. Tokens: `radius.m` 18, `radius.card` 28.
- **"Put it up for sale now?"** is Inter Medium 21 / −0.63 tracking (`21:4541`); tokenised as `type.displayM`.
- **Low-resolution sources:** a separate waving mascot PNG and a 2x Welcome background; larger sources for the Finding animation (320 px) and the Live mascot (204 px). See the intake record.
- **Card borders** `#D1D5DB` on white are 1.47:1; unselected cards rely on the radio and the white fill to read as cards. Is a darker border acceptable?
- **Wordmark.** The brief names the wordmark "eye mark + The 3rd Eye in Inter Semi Bold". No board shows it; `brand.wordmark` stays "THE 3RD EYE" until T102/T103 (an iOS test pins the string).

## Interface exposed to others
`design/tokens.json` is the only source of design values; `design/assets/` the only source of images. Web reads `web/app/tokens.css`, `web/lib/assets.ts` (`ASSETS.<name>` → `/assets/<file>`); iOS reads `Tokens.*`, `Image(Tokens.Asset.<name>)` and, for the animation, `Bundle.main.url(forResource: Tokens.Asset.mascotMagnifier, withExtension: "mp4")`. After an intake, the node table in `docs/design/screens.md` is what Web and iOS build from.

## Last updated
2026-10-30 (T100)
