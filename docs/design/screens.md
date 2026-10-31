# Screens · web

Since T100 (2026-10-30) the design source is **the Figma file (key `vIOMPzc2kjP18BbgduLmc8`)**, read from the user's copy (key `dAdjR5HFtOutFlUZi957Do`, same node ids), page `0:1` "Exploration 5 · Sky" (direction "Sky · Inter on white"). Where each token value comes from: `docs/design/tokens.md`. The node table below maps every Figma board to its screen. The tables after it still name the old canvas boards ("Direction A"): they describe the components as built today, until T102 (web) and T103 (iOS) re-skin them to Sky. Every screen uses tokens from `web/app/tokens.css` through the primitives in `web/components/ui/*`; images come from `web/lib/assets.ts`; copy is in `web/messages/en.json`.

## Figma node table (Sky)

Web creator boards (batch B4, section `2026:2864` in the Figma copy, key `dAdjR5HFtOutFlUZi957Do`) are implemented by T105; their rows follow the eight designed frames. The public site (B3) and admin (B5) boards are implemented by T106; their rows close the table. Board screenshots and the 390 px comparison shots live outside the repo.

Status: **designed** = a board exists in the Figma file; **generated** = drawn by the design agent in the duplicated file (T101), waiting for the user's review; **pending** = no board yet; **implemented (T1xx)** = the screen follows the board in code. iOS views are in `ios/App/Screens/`.

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
| `2026:2865` | Welcome · Web · Sky | Welcome (sky photo, scrim panels, numbered promises, white pill, Sign out / I already have an account) | `/create` · `Welcome`, `SignOut#WelcomeAccount` | — (web board) | implemented (T105) |
| `2026:2883` | Sign in with code · Web · Sky | Sign in with code | `/create/code` · `CodeSignIn`, `CodeField` | — (web board) | implemented (T105) |
| `2026:2905` | Sign in with code · Prefilled · Web · Sky | Sign in, prefilled (hint under the field) | `/create/code?c=` · `CodeField` | — (web board) | implemented (T105) |
| `2026:2930` | Sign in with code · Error · Web · Sky | Sign in, wrong code (error card) | `/create/code?error=1` · `CodeField` | — (web board) | implemented (T105) |
| `2026:2959` | Choose product · Web · Sky | Choose product | `/create/product` · `ChooseProduct` | — (web board) | implemented (T105) |
| `2026:2998` | Choose method · Web · Sky | Choose method | `/create/method` · `ChooseMethod` | — (web board) | implemented (T105) |
| `2026:3067` | Speak · Listening · Web · Sky | Speak, listening (seconds, Stop) | `/create/speak` · `Speak` | — (web board) | implemented (T105) |
| `2026:3098` | Speak · Question · Web · Sky | Speak, clarifying question (Hear the question again) | `/create/speak` · `Speak` | — (web board) | implemented (T105) |
| `2026:3135` | Speak · Microphone off · Web · Sky | Speak, microphone off (typed idea, Next) | `/create/speak` · `Speak` | — (web board) | implemented (T105) |
| `2027:3042` | Drawing your idea · Web · Sky | Drawing (searching MP4 on the sky card) | `/create/drawing` · `Drawing`, `ui/Loading` sky | — (web board) | implemented (T105) |
| `2027:3062` | Drawing your idea · Error · Web · Sky | Drawing, error (Try again, Say it again) | `/create/drawing` · `Drawing` | — (web board) | implemented (T105) |
| `2027:3091` | Result · Web · Sky | Result (picture row, What the image shows, Hear…) | `/create/result` · `Result`, `VariantPicker` | — (web board) | implemented (T105) |
| `2027:3138` | Result · Change it · Web · Sky | Result, change panel | `/create/result` · `Result` | — (web board) | implemented (T105) |
| `2038:4035` | Result · Changing · Web · Sky | Result, changing / making | `/create/result` · `Result` | — (web board) | implemented (T105) |
| `2038:4060` | Result · Error · Web · Sky | Result, error card with Try again | `/create/result` · `Result`, `errors#ErrorNotice` | — (web board) | implemented (T105) |
| `2027:3184` | Photo · Web · Sky | Take / upload a photo (sky card) | `/create/photo?mode=camera|upload` · `Photo` | — (web board) | implemented (T105) |
| `2027:3207` | Photo · Finding your drawing · Web · Sky | Photo, uploading → finding (MP4 card) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2027:3226` | Photo · Error (no drawing found) · Web · Sky | Photo, no drawing (Retake the photo, Draw a box) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2038:4419` | Photo · Error (other) · Web · Sky | Photo, time-out / other (Try again) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2027:3254` | Select (Adjust cutout) · Web · Sky | Pick your art (green photo card, strip, per-piece buttons, tools) | `/create/select` · `Select`, `SelectView`, `CutoutPhoto` | — (web board) | implemented (T105) |
| `2038:4092` | Select · Marks · Web · Sky | Select, marks list, 10-mark note, needPiece | `/create/select` · `SelectView` | — (web board) | implemented (T105) |
| `2038:4233` | Select · Applied · Web · Sky | Select, saved cutout (Back to photo, product notice) | `/create/select` · `SelectView` | — (web board) | implemented (T105) |
| `2038:4369` | Select · Saving · Web · Sky | Select, saving / making | `/create/select` · `SelectView` | — (web board) | implemented (T105) |
| `2030:3726` | Ready · Web · Sky | Your sticker is ready! | `/create/ready` · `Ready` | — (web board) | implemented (T105) |
| `2038:4443` | Ready · Notice · Web · Sky | Ready with the cutout notice | `/create/ready` · `Ready` | — (web board) | implemented (T105) |
| `2030:3752` | Listing · Web · Sky | Get it ready for the shop (board order) | `/create/listing` · `Listing`, `ListingView` | — (web board) | implemented (T105) |
| `2030:3804` | Listing · Drafting · Web · Sky | Listing, drafting | `/create/listing` · `ListingView` | — (web board) | implemented (T105) |
| `2030:3832` | Listing · Error · Web · Sky | Listing, 409 print check / moderation | `/create/listing` · `ListingView` | — (web board) | implemented (T105) |
| `2030:3884` | Story video · Web · Sky | Make your story video! | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2038:4469` | Story video · Video selected · Web · Sky | Story video, file chosen | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2030:3931` | Story video · Draft · Web · Sky | Story draft | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2038:4510` | Story video · Draft editing · Web · Sky | Story draft, editing | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2030:3958` | Live · Web · Sky | You're live! | `/create/live` · `Live` | — (web board) | implemented (T105) |
| — | — | Home, My designs (status badges), Design detail, Messages, Orders | — | `Home/*`, `Orders/*` | pending |
| `2018:1789` | Shop · Sky (1440) | Shop: sky hero on the ink-55 % scrim panel, collection, how a story tag works (grey band, green third card), meet the artist | `/` · `shop/{Hero,Collection,HowSteps,MeetArtist}`, `site/{ProductCard,FilterTabs}` | — (web board) | implemented (T106) |
| `2018:1970` | Shop · Mobile · Sky (390) | Shop at 390: scrolling filter row, two Small product cards per row | `/` | — (web board) | implemented (T106) |
| `2025:2929` | Shop · Empty collection · Sky | Grey empty card; Meet the artist empty line | `shop/Collection`, `shop/MeetArtist` | — (web board) | implemented (T106) |
| `2033:3991` | Shop · Mobile · Menu open · Sky | Nav drawer (component `2032:4004`): modal `<dialog>`, 60 px rows, Close, Esc, Tab wraps, page inert under the scrim | `site/{SiteNav,NavMenu}` | — (web board) | implemented (T106) |
| `2033:4035` | Shop · Skip link focused · Sky | Skip link (component `2032:4002`), 48 px ink pill with the ring | `app/layout.tsx` (`.skip-link` in `globals.css`) | — (web board) | implemented (T106) |
| `2019:2004` | Product page · Sky (1440) | Product: Back to the shop, mockup + die-cut card / chips, h1, artist link, price, share pill, description, buy card; story card | `/p/[id]` · `product/{ProductView,BuyForm}`, `site/DieCut` | — (web board) | implemented (T106) |
| `2019:2098` | Product page · Mobile · Sky (390) | Product, one column in DOM order | `/p/[id]` | — (web board) | implemented (T106) |
| `2019:2189` | Order success · Sky | Success card: sky picture, Thank you!, notified, link row with Copy, Open the story tag, Keep shopping; missing order = h1 + Keep shopping | `/buy/success` · `product/OrderSuccess` | — (web board) | implemented (T106) |
| `2024:2428` | Story tag · Sky (390) | Story tag: site nav and footer, video, Read aloud (secondary), Follow / Share, grey sheet (thank-you Info card, notes with sender lines, Send a note, About me, More from); 640 px column on desktop | `/t/[token]` · `storytag/*`, `site/StoryVideo` | — (web board) | implemented (T106) |
| `2024:2556` | Story tag · Not active · Sky | Sky card, STORY TAG, not active, Go to the shop | `app/t/[token]/not-found.tsx` | — (web board) | implemented (T106) |
| `2024:2597` | Artists · Sky | 72 px title, creator cards (80 px initials, Meet link) | `/artists` · `site/CreatorCard` | — (web board) | implemented (T106) |
| `2024:2652` | Artists · Empty · Sky | Grey empty card | `/artists` · `pages/EmptyNote` | — (web board) | implemented (T106) |
| `2024:2688` | Artist profile · Sky | Header with 120 px avatar, In their own words + Read aloud beside the video, Work by grid | `/c/[slug]` · `pages/CreatorProfile` | — (web board) | implemented (T106) |
| `2025:2682` | How it works · Sky | Intro + sky picture, checked point cards; `#story-tags` on the Tap point | `/how-it-works` · `pages/StaticPage` | — (web board) | implemented (T106) |
| `2025:2747` | For studios · Sky | Same layout, closing note card | `/for-studios` · `pages/StaticPage` | — (web board) | implemented (T106) |
| `2025:2809` | Accessibility · Sky | Same layout; targets line says 56 points | `/accessibility` · `pages/StaticPage` | — (web board) | implemented (T106) |
| `2025:2886` | 404 · Sky | Site nav, sky picture, title, Go to the shop | `app/not-found.tsx` | — (web board) | implemented (T106) |
| `2031:3895` | Admin · Orders · Sky (1440) | Admin: {brand} · Admin header, orders table (Mark {status} pills, story tag cell), green code card above the Creators table, Add creator card | `/admin` · `admin/{AdminShell,OrdersTable,StatusButtons,CreatorsPanel,CodeCard}` | — (web board) | implemented (T106) |
| `2031:4384` | Admin · Orders · Empty · Sky | Grey empty cards | `/admin` | — (web board) | implemented (T106) |
| `2034:3995` | Admin · AI trace · Sky | Step cards, thumbnails with labels and Chosen, inline Request / Response, Original photo + Mask + Open mask | `/admin/trace/[artworkId]` · `admin/TraceView` | — (web board) | implemented (T106) |
| `2034:4158` | Admin · AI trace · Missing · Sky | Grey empty card + Back to orders | `admin/TraceView` | — (web board) | implemented (T106) |

Frame 1 on Welcome (`36:422`) is the white logo mark; on every other board the mark is "Union" (`45:712`, `36:469`, `36:471`, `36:473`, `40:500`, `36:475`, `36:477`), 40×35 at the top left, exported as `design/assets/logo-mark.svg`.

## Public site

Since T106 these screens follow the B3 / B5 Sky boards (node ids in the table above); the board names below are the old canvas names, kept for history.

| Board | Route | Component |
|---|---|---|
| Web-Green · Shop (hero, collection, how, meet the artist) | `/` | `components/shop/{Hero,Collection,HowSteps,MeetArtist}` |
| Web-Green · Product | `/p/[id]` | `components/product/ProductView`, `BuyForm` (action `app/(site)/p/[id]/actions.ts#placeOrder`) |
| Order confirmation | `/buy/success?order=…` | `components/product/OrderSuccess` |
| Artists | `/artists` | `components/site/CreatorCard` |
| Artist profile | `/c/[slug]` | `components/pages/CreatorProfile` |
| Story tag (mobile) | `/t/[token]` | `components/storytag/StoryTagView` (actions `tap`, `sendReply`) |
| How it works | `/how-it-works` | `components/pages/StaticPage` (the steps are on the shop only since T106) |
| For studios | `/for-studios` | `components/pages/StaticPage` |
| Accessibility | `/accessibility` | `components/pages/StaticPage` |
| Admin · orders | `/admin` (basic auth) | `components/admin/OrdersTable` (action `app/admin/actions.ts#setOrderStatus`) |
| Admin · AI trace | `/admin/trace/[artworkId]` | `components/admin/TraceView` |

## Creator flow (mobile web)

Since T105 the screens follow the B4 web boards (node ids in the table above); the board names below are the old canvas names, kept for history.

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
