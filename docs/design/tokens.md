# Token provenance (Sky)

Where every value in `design/tokens.json` comes from. Read this before an intake changes a value: a value with a node id can be overwritten by a newer board, but a ruling, an accessibility floor or a carry-over needs a decision first.

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
| `meta.*` | Sky · Inter on white | T100 |
| `brand.name`, `brand.scheme` | The 3rd Eye, the3rdeye | carry-over (T085 rename) |
| `brand.wordmark` | THE 3RD EYE | ruling (stays until T102/T103; pinned by `ios/Tests/DeepLinkTests.swift`). No board draws the wordmark |

## color
| Key | Value | Source |
|---|---|---|
| `page` | `#FCFCFC` | node: frame fill of `45:700`, `21:4340`, `21:4390`, `21:4450`, `40:488`, `21:4509`, `21:4554` |
| `ink` | `#111827` | node: title `45:714`, primary CTA fill `45:738`, home indicator `45:740`, selected piece border `21:4470`, selected check `21:4468` |
| `inkSoft` | `#263A35` | node: Welcome status text `21:4232` and home indicator `36:431` |
| `textMuted` | `#6B7280` | node: descriptions `45:715`, `49:386`, `40:486`, `21:4542`, `21:4594` |
| `border` | `#D1D5DB` | node: unselected card `45:728`, method cards `45:759`, secondary pills `21:4549`, `21:4499`, `21:4601` |
| `surfaceAlt` | `#F3F4F6` | node: unselected radio `45:730`, selected piece fill `21:4470` |
| `accent` | `#65C361` | node: selected card `45:717`, selected method `45:749`, photo well `21:4466` / `40:502` |
| `accentBorder` | `#2FA647` | node: selected card border `45:717` |
| `greenDeep` | `#173D2B` | node: card caption `45:727`, selected radio `45:719`, method copy `45:754`, icon strokes `45:752` |
| `white` | `#FFFFFF` | node: card `45:728`, Welcome CTA `36:428`, Welcome text `21:4257`, sticker card `21:4571` |
| `danger` | `#B3261E` | carry-over: error text and destructive actions; no Sky board shows an error |
| `focus` | `#1E3A24` | carry-over (brief: keep, re-check on white): boards have no focus state; 12.5:1 on white, 5.7:1 on accent |
| `scrim` | `rgba(0,0,0,0.35)` | a11y + brief: white text on the Welcome photo (`21:4229`) is 2.4–2.7:1 without it |

## semantic
All **derived** from `color` by the brief's mapping: `bg`←page, `surface`←white, `surfaceAlt`←surfaceAlt, `text`←ink, `textOnDark`←white, `textMuted`←textMuted, `accent`←accent, `accentBorder`←accentBorder, `accentInk`←greenDeep, `primary`←ink, `primaryText`←white, `primaryShadow`←ink (carry-over key, read by hard shadows that are now zero), `border`←border, `selected`←accent, `danger`←danger, `focusRing`←focus, `scrim`←scrim.

## highContrast
All **derived** from the brief rule "ink on white, borders `#111827`": `bg`, `surface` white; `text`, `textMuted`, `primary`, `border`, `accentInk` = ink `#111827`; `primaryText` white; `accent` stays `#65C361` because ink on it is 8.0:1 (the selected card stays green, its text turns ink).

## font
| Key | Value | Source |
|---|---|---|
| `display.family`, `body.family` | Inter | node: every text node except `21:4340`'s method copy (Figtree; flagged, ruling: Inter everywhere) |
| `display.weight` | 500 | node: titles `45:714`, `49:385`, `21:4405`, `21:4465`, `40:501`, `21:4520`, `21:4565` (Inter Medium) |
| `display.weightOnPhoto` | 700 | node: Welcome title `21:4258` (Inter Bold) |
| `display.lineHeight`, `display.letterSpacing` | 1.13, −0.04em | node: `45:714` (48 px, tracking −1.92 px = −0.04em) |
| `display.transform`, `display.tilt` | none, 0deg | retired (no uppercase, no tilt on any board) |
| `*.ios` | Inter Variable | derived: registered family name of `Inter-Variable.ttf` (Inter 4.1) |
| `*.fallback` | system-ui, sans-serif | carry-over |
| `body.weights`, `googleFontsUrl` | 400–700 | derived: weights used on the boards (Regular, Medium, Semi Bold, Bold); 800 only for the eyebrow, synthesised from the variable axis |

## type
| Key | Value | Source |
|---|---|---|
| `displayXL` | 48 / 1.13 / 500 / −0.04em | node: `45:714` and the other titles above |
| `displayL` | 40 / 1.13 / 500 / −0.04em | brief (no 40 px node; a step below 48 for long titles and the web) |
| `displayM` | 21 / 1.2 / 500 / −0.03em | node: `21:4541`, `21:4593` (21 px Medium, tracking −0.63 px) |
| `titleL` | 18 / 600 | node: product names `45:726`, `45:732` |
| `titleM` | 16 / 600 | node: CTA labels `I45:738;7:8`, `I21:4544;7:8`, `I21:4596;7:8` |
| `bodyL` | 16 / 400 / 1.5 | brief (no 16 px Regular node; body text one step up for the web) |
| `body` | 15 / 400 / 1.5 | node: `45:715`, `40:486`, `21:4542`; secondary pill labels `I21:4549;7:15` |
| `bodyS` | 13 / 400 / 1.4 | node: card captions `45:727`, `45:733`; messages `45:690`, `45:693` (13 px, line height 1.5) |
| `caption` | 13 / 500 / 1.4 | ruling + a11y: 13 px floor (brief said 12). Nearest node: "I already have an account" `36:429` (14 px Medium) |
| `eyebrow` | 13 / 800 / 0.08em caps | PM ruling 2026-10-30 (accessibility floor for captions; matches the Figma `eyebrow` text style; the brief said 11). Board: voice badge `45:770` is Figtree ExtraBold 10 px, tracking 1 px |

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
| `section` | 36 | carry-over (web section spacing; no Sky web board yet) |

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
Node ids are on each entry in `tokens.json`; sizes and how each was made are in `docs/handoffs/design.md` ("T100 intake record").

## Seen on the boards, not tokenised (open questions)
- `#374151` message text, 13 px (`45:690`, `45:693`): darker than `textMuted`. Proposal: `textMuted` (4.7:1 is enough) or a new `textSoft`.
- `#E4F3C8` method icon circle (`45:751`), `#5FAE57` selected radio border (`45:719`), `#19583C` voice badge text (`45:770`).
- Drawing paper: white, radius 8, rotated 3°, shadow `0 12 22 rgba(0,0,0,0.08)` (`21:4467`). Listed sticker card: rotated 9°, shadow `0 12 22 rgba(73,103,122,0.13)` (`21:4571`). Tote badge drop shadow `0 4.2 2.8 rgba(30,40,70,0.22)` (`21:4584`). Illustration-only until a second use.
- Selected piece: 2 px ink border, radius 24, `surfaceAlt` fill (`21:4470`); selected check: 28 px ink circle with a 16 px white check (`21:4468`). T102/T103 build these from `ink`, `surfaceAlt`, `border.thin` × 2 and `radius.card`−4; a token is added if a second board repeats them.
