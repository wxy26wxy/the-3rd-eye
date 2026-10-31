# Screens · web

Since T100 (2026-10-30) the design source is **the Figma file (key `vIOMPzc2kjP18BbgduLmc8`)**, read from the user's copy (key `dAdjR5HFtOutFlUZi957Do`, same node ids), page `0:1` "Exploration 5 · Sky" (direction "Sky · Inter on white"). Where each token value comes from: `docs/design/tokens.md`. The node table below maps every Figma board to its screen. The tables after it still name the old canvas boards ("Direction A"): they describe the components as built today, until T102 (web) and T103 (iOS) re-skin them to Sky. Every screen uses tokens from `web/app/tokens.css` through the primitives in `web/components/ui/*`; images come from `web/lib/assets.ts`; copy is in `web/messages/en.json`.

## Figma node table (Sky)

Status: **designed** = a board exists in the Figma file; **generated** = drawn by the design agent in the duplicated file (T101), waiting for the user's review; **pending** = no board yet. iOS views are in `ios/App/Screens/`.

| Figma node | Board | Screen | Web route | iOS view | Status |
|---|---|---|---|---|---|
| `21:4229` | Welcome · Cloud studio | Welcome (full-bleed sky photo, white text, white pill CTA, "I already have an account") | `/create` | `Onboarding/WelcomeView` | designed |
| `45:700` | Pick sticker or tote · Cloud studio | Choose product (two cards, radio, "Next") | `/create/product` | `Create/PickProductView` | designed |
| `21:4340` | Choose how to make it · Cloud studio | Choose method (photo / upload / say it, "NO DRAWING SKILL NEEDED") | `/create/method` | `Create/ChooseMethodView` | designed |
| `21:4390` | Finding drawings · Cloud studio | Finding your drawings (dreamscape, "This takes a few seconds...") | `/create/select` (loading) | `Create/FindingDrawingsView` | designed |
| `21:4450` | Tap to select · Cloud studio | Tap the one you want ("Retake" / "Use this") | `/create/select` | `Create/AdjustCutoutView` (pick step) | designed |
| `40:488` | Tap to select · Cloud studio (second frame, title "You can adjust the cut out") | Adjust cutout | `/create/select` (adjust) | `Create/AdjustCutoutView` | designed (adjust tools not drawn) |
| `21:4509` | Sticker ready · Cloud studio | Your sticker is ready! + "Put it up for sale now?" | `/create/ready` | `Create/DesignReadyView` | designed |
| `21:4554` | You're live · Cloud studio | You're live! ("Make another", "See what buyers see") | `/create/live` | `Listing/YoureLiveView` | designed |
| — | — | Sign in with code | `/create/code` | `Onboarding/CodeEntryView` | pending |
| — | — | Speak / Type instead / clarifying question | `/create/speak` | `Create/SpeakView` | pending |
| — | — | Drawing your idea | `/create/drawing` | `Create/DrawingYourIdeaView` | pending |
| — | — | Voice result (variants, Change it / Use this) | `/create/result` | `Create/VoiceResultView` | pending |
| — | — | Take / upload a photo | `/create/photo` | `Create/CameraView` | pending |
| — | — | Listing details (Improve with AI, trace) | `/create/listing` | `Listing/ListingDetailsView` | pending |
| — | — | Story video, Video saved | `/create/story-video` | `Listing/StoryVideoView`, `VideoSavedView` | pending |
| — | — | Home, My designs (status badges), Design detail, Messages, Orders | — | `Home/*`, `Orders/*` | pending |
| — | — | Admin · Creators panel with one-time code card | `/admin` | — | pending |
| — | — | Public site (shop, product, artists, story tag, static pages) | `/`, `/p/[id]`, `/artists`, `/c/[slug]`, `/t/[token]`, … | — | pending (T101 generates Sky web boards) |

Frame 1 on Welcome (`36:422`) is the white logo mark; on every other board the mark is "Union" (`45:712`, `36:469`, `36:471`, `36:473`, `40:500`, `36:475`, `36:477`), 40×35 at the top left, exported as `design/assets/logo-mark.svg`.

## Public site

| Board | Route | Component |
|---|---|---|
| Web-Green · Shop (hero, collection, how, meet the artist) | `/` | `components/shop/{Hero,Collection,HowSteps,MeetArtist}` |
| Web-Green · Product | `/p/[id]` | `components/product/ProductView`, `BuyForm` (action `app/(site)/p/[id]/actions.ts#placeOrder`) |
| Order confirmation | `/buy/success?order=…` | `components/product/OrderSuccess` |
| Artists | `/artists` | `components/site/CreatorCard` |
| Artist profile | `/c/[slug]` | `components/pages/CreatorProfile` |
| Story tag (mobile) | `/t/[token]` | `components/storytag/StoryTagView` (actions `tap`, `sendReply`) |
| How it works | `/how-it-works` | `components/pages/StaticPage` + `HowSteps` |
| For studios | `/for-studios` | `components/pages/StaticPage` |
| Accessibility | `/accessibility` | `components/pages/StaticPage` |
| Admin · orders | `/admin` (basic auth) | `components/admin/OrdersTable` (action `app/admin/actions.ts#setOrderStatus`) |
| Admin · AI trace | `/admin/trace/[artworkId]` | `components/admin/TraceView` |

## Creator flow (mobile web)

| Board | Route | Component (`components/create/screens/*`) |
|---|---|---|
| E4 · Welcome | `/create` | `Welcome` |
| Sign in with code | `/create/code` → POST `/create/code/session` | `CodeSignIn` |
| E4 · Choose product (STEP 1 OF 3) | `/create/product` | `ChooseProduct` |
| E4 · Choose method (STEP 2 OF 3, NO PEN NEEDED!) | `/create/method` | `ChooseMethod` |
| E4 · Listening / Type instead / clarifying question | `/create/speak` | `Speak` |
| E4 · Drawing your idea | `/create/drawing` | `Drawing` |
| E4 · Result (YOU SAID, variants, hear, Change it / Use this) | `/create/result` | `Result`, `VariantPicker` |
| E4 · Take / upload a photo | `/create/photo?mode=camera|upload` | `Photo` |
| E4 · TAP THE ONE YOU WANT! | `/create/select` | `Select` |
| E4 · YOUR STICKER IS READY! | `/create/ready` | `Ready` |
| E4 · Listing (Improve with AI, trace toggle) | `/create/listing` | `Listing` |
| E4 · MAKE YOUR STORY VIDEO! | `/create/story-video` | `StoryVideo` |
| E4 · YOU'RE LIVE! | `/create/live` | `Live` |

Shared frame: `components/create/CreateScreen` (back button, step pill, display headline, scalloped cream bottom sheet with the actions). Mascot: `components/Tag.tsx` (`listening`, `cheering`, `waving`).

## Screens with no board yet

Replaced by the "pending" rows of the Figma node table above (T100). Adjust cutout now has a board (`40:488`); Design detail, My designs badges, the admin Creators panel and the code prefill hint are still pending.

## Removed elements (iOS, T081)

Accessibility settings sheet, helper-mode button, "Hear what the image shows" play bar, per-field mic icons. Voice remains only on "Say it out loud" and "Say what to change". The canvas still draws the helper-mode button (E4 Welcome) and a "Your helper can hold the phone" line (E4 Method); web keeps the "Hear the question again" button on the clarifying question.

## Figma intake log

| Date | Source | Page | Frames | Result |
|---|---|---|---|---|
| 2026-10-30 | Figma file key `vIOMPzc2kjP18BbgduLmc8` (T100) | `0:1` "Exploration 5 · Sky" | `21:4229`, `45:700`, `21:4340`, `21:4390`, `21:4450`, `40:488`, `21:4509`, `21:4554` (390×844; Sticker ready is 390×867) | First Figma intake; replaces the canvas. No Figma variables: tokens v2 read from node styles of `21:4229`, `45:700`, `21:4340`, `21:4509` (the seat's MCP allowance ran out before the other four, which were read from screenshots). 11 assets exported to `design/assets/`, 4 pending at the time (resolved in the next row). Off-token: `#E4F3C8`, `#5FAE57`, `#19583C`, `#C6C6C6`; Figtree on `21:4340`. Procedure and open questions: `docs/handoffs/design.md`. |
| 2026-10-30 | the user's copy, key `dAdjR5HFtOutFlUZi957Do` (T100 fix round 1) | `0:1` | `21:4390`, `21:4450`, `40:488`, `21:4554` read in full | Same node ids as the original. Confirms the tokens; adds `#374151` message text and three illustration shadows (open questions in `docs/design/tokens.md`). Assets: `mascot-magnifier.gif` (the Finding fill is an animated GIF, so there is no separate `sky-1`), `sky.png`, `mascot-front.png`; icons renamed `icon-*`. Only `mascot-wave` stays pending. |

Canvas history (retired): version `1793328546-ac11` (2026-10-29), 27 board files, baseline dry run.

## Accessibility deviations from the design

These describe the Direction A components still on screen until T102/T103. The Sky flags for the designer are in `docs/accessibility.md` ("Designer flags (Sky)").


- **Display headlines on green**: cream fill on `ground` is about 1.9:1. The 2 px ink stroke and 5 px ink shadow carry the letterforms, and every display headline is also real text. On cream surfaces display text uses ink fill instead of cream (`tone="onCream"`).
- **Nav links on phones** are cream pills on green instead of bare text, so each is a 44 px target with readable contrast; the desktop nav keeps the bare-text style.
- **Selected state** is shown by the lime background *and* a filled check circle, so it does not rely on colour alone. Every choice is a native radio.
- **Starburst badge** text is part of the choice's accessible name ("Say it out loud … No pen needed!").
- **Focus**: a 3 px ink outline with a 3 px offset everywhere (the design has no focus state).
- **Motion**: Tag's waving and hopping, the listening bars and the loading dots stop under `prefers-reduced-motion`.
- **High contrast**: the generated tokens switch under `prefers-contrast: more`; the grain overlay turns off.
- **Mic screens** always offer "Type instead"; the clarifying question is spoken *and* shown, with a "Hear the question again" button.
- **File pickers** are native inputs (visually hidden over a pill face), so they work with VoiceOver and the keyboard.
