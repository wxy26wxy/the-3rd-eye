# Working in the Figma file (rules for designers and their agents)

The Figma copy (key `dAdjR5HFtOutFlUZi957Do`, page `0:1`) is the single design source. Code is generated from it in two steps: tokens (`design/tokens.json` → `pnpm tokens`) and per-board implementation (board → screen file or route, mapped in `docs/design/screens.md` and the board table). These rules keep that mapping intact so a design pass lands in code within the hour.

## 1. Edit in place, keep node ids
- Change existing boards instead of deleting and recreating them. The node id is the link between the board and its screen; a new id means re-mapping.
- Keep board names (`<Screen> · <State> · Sky`) and keep boards inside their batch section (B1 iOS demo path … B5 admin). A new screen gets a new board in the right section, named the same way.
- Do not rename or delete the Components page or its components.

## 2. Change values through variables and styles
- Colours: edit the `Sky` variable collection (`color/page`, `color/ink`, `color/accent`, `color/danger`, …). A new colour is a new variable named `color/<name>`; never a raw hex on a layer.
- Type: edit the text styles (`displayXL`, `body`, `caption`, …). Inter only.
- Spacing, radius, shadows: edit the component, not its instances. Shared changes go into the component (Primary action, Secondary action, Product option, Creation option, Photo card, Tab bar, Nav drawer…).
- Anything that cannot be expressed as a variable or a component change (a new layout) is fine; it just costs implementer time, so say so in the changelog.

## 3. Accessibility floor (checked in every review)
Inter only · 24 px side padding · primary action 56 px, secondary 50 px, every target ≥ 44 px · text ≥ 15 px, captions 13 px minimum · contrast ≥ 4.5:1 for text (ink on white; muted `#6B7280` on white; `#173D2B` on the green card), white text on photos only over the scrim · Back chevron (44 px) top-left on screens with a back action, logo mark on first screens · no meaning by colour alone (status badges carry text; destructive actions use `color/danger` and the word) · visible focus ring (`focus/ring`) on interactive components · VoiceOver/landmark order = visual order (keep the order annotations).

## 4. Copy changes are explicit
Strings live in `web/messages/en.json` and `ios/App/Resources/Localizable.xcstrings`, and the iOS UI tests find controls by label. When a board changes wording, add a line to the changelog (`board · old → new`). Sample data (names, prices, transcripts) is not copy.

## 5. Images and animations
Put the source file of any new image or animation on the `Assets` page as a frame named `asset/<name>` at 2x (PNG with alpha, or GIF/MP4), and use it as a fill on the board. The intake exports from that page into `design/assets/`. Prefer ≥ 2x sources (the current Welcome background and front mascot are ~1.2x and flagged).

## 6. Log and signal
- Keep a `Changelog` text frame on page `0:1` (or a `Changes` page): date, board name, node id, what changed, copy changes. One entry per session.
- Save a named version in Figma after each session (File → Save to version history), e.g. `Designer pass 2`.
- Tell the team "new design version" with the link. The intake (`docs/handoffs/design.md`) runs within the hour: variables → tokens diff, boards → screen map, copy → catalogue diff, accessibility flags back to you.

## 7. Never
- Never write the file's title anywhere in the repo; refer to it by key.
- Never edit `design/tokens.json`, `web/app/tokens.css` or `ios/App/Theme/Tokens.swift` by hand; the token diff comes through the intake.
- Never move boards between sections, and never put real personal data on boards.
