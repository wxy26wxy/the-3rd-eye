# Token provenance (Sky v3)

Where every value in `design/tokens.json` comes from.

**v3 (T110, 2026-11-01):** the designer's file (key in the newest row of the intake log, `docs/design/screens.md`) has Figma variables and text styles. Values marked **var** were read with `get_variable_defs` on `2018:1789` (Shop) and `2012:387` (Change it); they win over node-style readings. Changed in v3: `inkSoft`, new `accentSoft` and `scrimStrong`, the font (Outfit), `eyebrow` (600, 1 px, line height 1.3), `titleL` line height 1.3, new `cta`. Read this before an intake changes a value: a value with a node id can be overwritten by a newer board, but a ruling, an accessibility floor or a carry-over needs a decision first.

The Figma node ids are the same in the original file (key `vIOMPzc2kjP18BbgduLmc8`) and the user's copy (key `dAdjR5HFtOutFlUZi957Do`), page `0:1`. All 8 boards were read with `get_design_context`: four in the original (T100) and four in the copy (T100 fix round 1: `21:4390`, `21:4450`, `40:488`, `21:4554`).

Source kinds:
- **node**: read from that Figma node's style.
- **brief**: value fixed in the T100 brief (the user's decision record of 2026-10-30), with the nearest node if there is one.
- **ruling**: a controller decision during T100 review.
- **a11y**: an accessibility floor from `docs/accessibility.md`.
- **derived**: computed from other tokens (says from what).
- **carry-over**: kept from Direction A because current code reads it and no Sky board shows a value. A board that shows one replaces it.
- **retired**: the Sky boards do not have the effect; the value is zero so the generator and `ThemeEffects` turn it off. T102/T103 delete the components.

## meta, brand
| Key | Value | Source |
|---|---|---|
| `meta.*` | Sky v3 · Outfit on white, version 3, source = the v3 file key | T110 (was Sky · Inter on white, T100) |
| `brand.name`, `brand.scheme` | The 3rd Eye, the3rdeye | carry-over (T085 rename) |
| `brand.wordmark` | THE 3RD EYE | ruling (stays until T102/T103; pinned by `ios/Tests/DeepLinkTests.swift`). No board draws the wordmark |

## color
| Key | Value | Source |
|---|---|---|
| `page` | `#FCFCFC` | node: frame fill of `45:700`, `21:4340`, `21:4390`, `21:4450`, `40:488`, `21:4509`, `21:4554` |
| `ink` | `#111827` | node: title `45:714`, primary CTA fill `45:738`, home indicator `45:740`, selected piece border `21:4470`, selected check `21:4468` |
| `inkSoft` | `#374151` | var: `color.inkSoft` (v3; was `#263A35` from `21:4232`). The v2 open question "`#374151` message text" is answered by this variable |
| `textMuted` | `#6B7280` | node: descriptions `45:715`, `49:386`, `40:486`, `21:4542`, `21:4594` |
| `border` | `#D1D5DB` | node: unselected card `45:728`, method cards `45:759`, secondary pills `21:4549`, `21:4499`, `21:4601` |
| `surfaceAlt` | `#F3F4F6` | node: unselected radio `45:730`, selected piece fill `21:4470` |
| `accent` | `#65C361` | node: selected card `45:717`, selected method `45:749`, photo well `21:4466` / `40:502` |
| `accentBorder` | `#2FA647` | node: selected card border `45:717`; var `color.accentBorder` (v3) |
| `accentSoft` | `#E4F3C8` | var: `color/accentSoft` (v3, entry 2: shop and product chips; also the v2 method icon circle `45:751`). Ink on it 15.2:1, greenDeep 10.3:1, textMuted 4.1:1 (not for text) |
| `greenDeep` | `#173D2B` | node: card caption `45:727`, selected radio `45:719`, method copy `45:754`, icon strokes `45:752` |
| `white` | `#FFFFFF` | node: card `45:728`, Welcome CTA `36:428`, Welcome text `21:4257`, sticker card `21:4571` |
| `danger` | `#B3261E` | carry-over: error text and destructive actions; no Sky board shows an error |
| `focus` | `#1E3A24` | carry-over (brief: keep, re-check on white): boards have no focus state; 12.5:1 on white, 5.7:1 on accent |
| `scrim` | `rgba(17,24,39,0.55)` (ink at 55 %) | node: the boards' `color.scrim` variable (hero panel `2018:1806`, drawer scrim `2033:3993`, Welcome panels `2026:2865`); T106 fix round 1, was `rgba(0,0,0,0.35)` (a11y + brief). Worst pixel under the shop hero panel 5.08:1 at 390 |
| `scrimStrong` | `rgba(17,24,39,0.72)` (ink at 72 %) | var: `color/scrimStrong` (v3 entry 1; white text ≥ 7:1 over any photo). The v3 shop hero no longer puts text on the photo; kept for text on photos (e.g. a future web Welcome fix, story cards) |

## semantic
All **derived** from `color` by the brief's mapping: `bg`←page, `surface`←white, `surfaceAlt`←surfaceAlt, `text`←ink, `textOnDark`←white, `textMuted`←textMuted, `accent`←accent, `accentBorder`←accentBorder, `accentInk`←greenDeep, `primary`←ink, `primaryText`←white, `primaryShadow`←ink (carry-over key, read by hard shadows that are now zero), `border`←border, `selected`←accent, `danger`←danger, `focusRing`←focus, `scrim`←scrim.

## highContrast
All **derived** from the brief rule "ink on white, borders `#111827`": `bg`, `surface` white; `text`, `textMuted`, `primary`, `border`, `accentInk` = ink `#111827`; `primaryText` white; `accent` stays `#65C361` because ink on it is 8.0:1 (the selected card stays green, its text turns ink).

## font
| Key | Value | Source |
|---|---|---|
| `display.family`, `body.family` | Outfit | var: all 10 text styles are Outfit (v3 entry 9; was Inter) |
| `display.weight` | 500 | var: `displayXL`, `displayL`, `webDisplay` (Outfit Medium) |
| `display.weightOnPhoto` | 700 | node: iOS Welcome title `21:4258` (unchanged board) |
| `display.lineHeight`, `display.letterSpacing` | 1.13, −0.04em | node: `45:714` (48 px, tracking −1.92 px = −0.04em) |
| `display.transform`, `display.tilt` | none, 0deg | retired (no uppercase, no tilt on any board) |
| `*.ios` | Outfit | derived: `Outfit-Variable.ttf` (Outfit 1.1, Outfitio/Outfit-Fonts release tag `1.1`, `fonts/variable/Outfit[wght].ttf`, git blob `4acdc3fa…`) registers the typographic family "Outfit" (name ID 16; ID 1 is "Outfit Thin", PostScript `Outfit-Thin`). Its default instance is wght 100 (Thin), so every view sets a weight (`ThemeFont` does). `UIFont(name: "Outfit")` resolves on the iOS 26 simulator (`ThemeEffectsTests.testOutfitIsRegistered`) |
| `*.fallback` | system-ui, sans-serif | carry-over |
| `body.weights`, `googleFontsUrl` | 400–700, Outfit | derived: the styles use Regular, Medium, SemiBold; Bold on the iOS Welcome photo. Nothing uses 800 any more |

## type
| Key | Value | Source |
|---|---|---|
| `displayXL` | 48 / 1.13 / 500 / −0.04em | var: `displayXL` (−1.92 px = −0.04em) |
| `displayL` | 40 / 1.13 / 500 / −0.04em | var: `displayL` (−1.6 px = −0.04em) |
| `displayM` | 21 / 1.2 / 500 / −0.03em | node: `21:4541`, `21:4593` (21 px Medium, tracking −0.63 px) |
| `titleL` | 18 / 1.3 / 600 | var: `titleL` (line height 1.3 new in v3) |
| `titleM` | 16 / 600 | node: CTA labels `I45:738;7:8` (v2). Same size and weight as `cta`; kept because current code reads it |
| `cta` | 16 / 1.2 / 600 | var: `cta` (v3 text style for primary and record-button labels, e.g. `2006:123`). New key; `TextRole` has no case for it yet (T114 may map `.titleM` labels to it) |
| `bodyL` | 16 / 400 / 1.5 | var: `bodyL` |
| `body` | 15 / 400 / 1.5 | var: `body` |
| `bodyS` | 13 / 400 / 1.4 | var: `bodyS` |
| `caption` | 13 / 500 / 1.4 | var: `caption` (and the 13 px a11y floor) |
| `webDisplay` | 72 / 1.05 / 500 / −0.04em | var: `webDisplay` (−2.88 px = −0.04em); on phones the same headings use `displayXL` |
| `cardTitle` | 22 / 600 / 1.3 | node: Note form title `2010:572` — T106 |
| `eyebrow` | 13 / 1.3 / 600 / 1 px caps | var: `eyebrow` (Outfit SemiBold 13, tracking 1, line height 1.3; v2 was 800 / 0.08em). `letterSpacing` is `"1px"`: CSS uses it as is; iOS `TextRole.tracking` returns 1 (mirrored by hand) |

## space
| Key | Value | Source |
|---|---|---|
| `xs` | 6 | node: gap in card details `45:725` |
| `s` | 10 | node: gap in `21:4540`, `21:4543`, `21:4592`, `21:4595` |
| `m` | 14 | node: gap in method details `45:750`, Welcome intro `21:4257` |
| `l` | 16 | node: top padding of content `45:711`, `21:4348` |
| `xl` | 20 | node: gap in `21:4517`, `21:4562`; Welcome text block padding `36:423` |
| `xxl` | 24 | node: gap in `21:4348`, `21:4398`, `21:4458`; actions top padding `45:736` |
| `page` | 24 | node: horizontal padding `45:711`, `45:737`, `21:4540` |
| `section` | 36 | carry-over (web section spacing); also the shop hero panel's vertical padding `2018:1806` |
| `sm` | 12 | node: gaps in the hero CTAs `2018:1810`, Meet the artist copy `2018:1941`, admin cells `2039:4287`, story tag rows `2024:2453` — T106 |
| `cardPad` | 28 | node: step cards `2018:1925`, creator cards `2024:2616`, code card `2031:3895`, section gaps `2018:1821` — T106 |
| `block` | 32 | node: story card `2033:3936`, story tag top / sheet `2024:2440`, `2024:2466`, footer gap `2010:486` — T106 |
| `blockL` | 40 | node: Meet the artist card `2018:1939`, product columns `2019:2019`, profile `2024:2703` — T106 |
| `band` | 56 | node: band padding at 390 `2018:2000`, footer `2010:468`, product column gap `2019:2024` — T106 |
| `gutterWide` | 80 | node: page side padding at 1440 (`2010:442`, `2018:1821`); `--layout-gutter` from 64rem — T106 |
| `bandL` | 96 | node: band padding at 1440 `2018:1821`, page bottom padding `2019:2019` — T106 |
| `hero` | 120 | node: hero padding at 1440 `2018:1805`, page bottom padding `2024:2612` — T106 |

Derived steps used in CSS (no token of their own): 48 = `space.xxl` × 2 (admin side padding `2031:3900`, success card `2019:2205`, page top at 390), 64 = `space.block` × 2 (hero padding at 390 `2018:1986`, admin bottom), 26 = `space.m` + `space.sm` (card grid column gap `2018:1835`), 22 = `space.s` + `space.sm` (point cards `2025:2704`), radius 12 = `radius.s` × 2 (admin notes and call blocks), radius 40 = `radius.card` + `space.sm` (footer top corners at 1440 `2010:468`).

## radius
| Key | Value | Source |
|---|---|---|
| `s` | 6 | carry-over (admin and trace lists). Nearest node: drawing paper `21:4467`, 8 |
| `m` | 18 | node: method cards `45:749`, `45:759`, `45:769` |
| `card` | 28 | node: product cards `45:717`, `45:728`; dreamscapes `21:4406`, `21:4566`; photo well `21:4466`; sticker card `21:4571` |
| `cardL`, `tile` | 30, 36 | carry-over (web cards and tiles; no Sky board) |
| `pill` | 999 | node: home indicator `45:740`; pills are fully rounded (`45:738` radius 28 at 56 px height, `21:4549` 25 at 50) |

## border
| Key | Value | Source |
|---|---|---|
| `card` | 1.5 | node: selected card `45:717` |
| `thin` | 1 | node: unselected card `45:728`, method cards `45:749`, secondary pills `21:4549`, radio `45:719` |
| `icon` | 1.8 | node: strokes of `45:752`, `45:762`, `45:773`, `45:757` (check `45:720` is 1.7, arrow `I45:738;7:10` 1.65; drawn into the SVGs) |

## shadow
| Key | Value | Source |
|---|---|---|
| `soft` | 0 8 12 `rgba(0,0,0,0.18)` | brief, from node `45:746` (tote: `0 8.7 11.6 #C6C6C6`) |
| `hard`, `hardL`, `primary`, `icon` | all 0 | retired (no hard shadows on the boards) |

## size
| Key | Value | Source |
|---|---|---|
| `cta` | 56 | node: primary actions `45:738`, `21:4544`, `21:4596`, `21:4501` |
| `ctaSecondary` | 50 | node: secondary actions `21:4549`, `21:4601`, `21:4499` |
| `ctaArrow` | 48 | node: arrow circle `I45:738;7:9` |
| `iconButton` | 48 | carry-over (back and icon buttons; matches `ctaArrow`) |
| `methodIcon` | 44 | node: `45:751` |
| `radio` | 24 | node: `45:719`, `45:730` |
| `logoMark` | 40 × 35 | node: "Union" `45:712` (same on every board) |
| `minTarget` | 44 | a11y |
| `record` | 84 | carry-over (voice record button; no Sky board for Speak) |
| `stepDot` | 8 | carry-over (badge sizes derive from it in `ThemeEffects`; the step indicator itself is retired) |
| `avatar` | 40 | carry-over (web artist avatars; no Sky board) |
| `photoMaxHeight` | 65vh | carry-over (T090, web Select) |

## opacity, effects, motion
| Key | Value | Source |
|---|---|---|
| `opacity.disabled` | 0.6 | carry-over (T090; no disabled state on the boards) |
| `effects.displayStroke.width`, `.shadowY` | 0, 0 | retired |
| `effects.displayStroke.color` | ink | inert while width is 0 |
| `effects.grain.opacity` | 0 | retired |
| `effects.grain.baseFrequency`, `.octaves` | 0.9, 2 | inert while opacity is 0 |
| `effects.scallop.height` | 0 | retired |
| `effects.scallop.amplitude`, `.period` | 16, 48.75 | inert while height is 0 |
| `motion.*` | 120 / 200 / 320 ms, easing | carry-over (the file has no prototype motion) |

## assets
`stickerLoading` = `sticker-loading.gif` from `asset/sticker-loading` `4036:4404` (Assets page `4036:4403`), 320×320, 121 frames, 5.04 s, 1x (slot 342×342; 2x pending from the designer). `heroSky` is also the v3 hero photo card `4006:4382` and the Welcome · Web fill (same image hash). Node ids are on each entry in `tokens.json`; sizes and how each was made are in `docs/handoffs/design.md` ("T100 intake record").

## Seen on the boards, not tokenised (open questions)
- Answered in v3: `#374151` is now `color.inkSoft`; `#E4F3C8` is `color.accentSoft`.
- `#5FAE57` selected radio border (`45:719`), `#19583C` voice badge text (`45:770`).
- Drawing paper: white, radius 8, rotated 3°, shadow `0 12 22 rgba(0,0,0,0.08)` (`21:4467`). Listed sticker card: rotated 9°, shadow `0 12 22 rgba(73,103,122,0.13)` (`21:4571`). Tote badge drop shadow `0 4.2 2.8 rgba(30,40,70,0.22)` (`21:4584`). Illustration-only until a second use.
- Selected piece: 2 px ink border, radius 24, `surfaceAlt` fill (`21:4470`); selected check: 28 px ink circle with a 16 px white check (`21:4468`). T102/T103 build these from `ink`, `surfaceAlt`, `border.thin` × 2 and `radius.card`−4; a token is added if a second board repeats them.

## Web layout values that stay literal (T106)
Checked by the `rem` grep in `docs/handoffs/design.md` step 6; anything not on this list is a finding.
- **Breakpoints:** 30rem, 40rem, 48rem (47.99rem for max-width), 64rem; container query 12.5rem (Web product card Size=Small under 200 px, `2035:4116`).
- **Layout:** `--layout-max` 80rem (1280 content column), `--layout-narrow` 36rem.
- **One-off widths and heights from single boards:** shop hero 38.75rem / 42.5rem tall, panel 42.5rem wide, CTAs 18.75rem / 15rem (`2018:1805`); Meet the artist video column 26.25rem (`2018:1940`); footer brand 26.25rem; product image column 38.75rem, story video 35rem (`2019:2025`, `2033:3939`); success card 40rem; story tag column 40rem (ruling 6); static intro 32.5rem, 404 picture 35rem; header heights 4rem / 5rem (Web nav), admin header 4.5rem, drawer rows 3.75rem; check circle 2rem (`2025:2705`); avatars 5rem / 7.5rem with initials 1.8rem / 2.7rem (`2024:2617`, `2024:2705`); admin QR 7.5rem (story tag cell) and 9.375rem (code card), trace thumbnails 5.625rem, die-cut well 13.375rem, admin column minimums 13 / 14 / 15rem, confirm and sticker preview max 22rem; message bubble max 18rem; chip vertical padding 0.25rem (`2010:509`).
- **Icon sizes** passed as `size="…rem"` to `ui/Icons` (decorative glyphs inside labelled controls).

## Known differences from the boards (web)
- `Display size="l"` stays 32 px on phones (T102 primitive, 40 px from 48rem); the Sky web boards draw 40 px section titles at 390. Changing it touches every T105 screen too, so it waits for a design decision.
