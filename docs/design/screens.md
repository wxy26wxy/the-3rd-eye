# Screens · web

Since T110 (2026-11-01) the design source is the designer's v3 file; its key is recorded only in the "Figma intake log" at the end of this page (see "Reading the next version"). Node ids are the same as in the earlier keys (`vIOMPzc2kjP18BbgduLmc8`, the user's copy `dAdjR5HFtOutFlUZi957Do`), page `0:1` "Exploration 5 · Sky" (direction "Sky v3 · Outfit on white"). Where each token value comes from: `docs/design/tokens.md`. The node table below maps every Figma board to its screen. The tables after it still name the old canvas boards ("Direction A"): they describe the components as built today, until T102 (web) and T103 (iOS) re-skin them to Sky. Every screen uses tokens from `web/app/tokens.css` through the primitives in `web/components/ui/*`; images come from `web/lib/assets.ts`; copy is in `web/messages/en.json`.

## Figma node table (Sky)

Web creator boards (batch B4, section `2026:2864`) were implemented by T105; their rows follow the eight designed frames. The public site (B3) and admin (B5) boards are implemented by T106; their rows close the table. Board screenshots and the 390 px comparison shots live outside the repo.

Status: **pending (v3, T110)** = the board changed or is new in v3 and the screen does not follow it yet (status reset at the T110 intake; the implementing task sets it back to implemented); **designed** = a board exists in the Figma file; **generated** = drawn by the design agent in the duplicated file (T101), waiting for the user's review; **pending** = no board yet; **implemented (T1xx)** = the screen follows the board in code. iOS views are in `ios/App/Screens/`.

| Figma node | Board | Screen | Web route | iOS view | Status |
|---|---|---|---|---|---|
| `21:4229` | Welcome · Cloud studio | Welcome (full-bleed sky photo, white text, white pill CTA, "I already have an account") | `/create` | `Onboarding/WelcomeView` | designed; iOS implemented (T104) |
| `45:700` | Pick sticker or tote · Cloud studio | Choose product (two cards, radio, "Next") | `/create/product` | `Create/PickProductView` | designed; iOS implemented (T104) |
| `21:4340` | Choose how to make it · Cloud studio | Choose method (photo / upload / say it, "NO DRAWING SKILL NEEDED") | `/create/method` | `Create/ChooseMethodView` | designed; iOS implemented (T104) |
| `21:4390` | Finding drawings · Cloud studio | Finding your drawings (dreamscape, "This takes a few seconds...") | `/create/select` (loading) | `Create/FindingDrawingsView` | designed; iOS implemented (T104) |
| `21:4450` | Tap to select · Cloud studio | Tap the one you want ("Retake" / "Use this") | `/create/select` | `Create/AdjustCutoutView` (pick step) | designed; iOS implemented (T104) |
| `40:488` | Tap to select · Cloud studio (second frame, title "You can adjust the cut out") | Adjust cutout | `/create/select` (adjust) | `Create/AdjustCutoutView` | designed; iOS implemented (T104) |
| `21:4509` | Sticker ready · Cloud studio | Your sticker is ready! + "Put it up for sale now?" | `/create/ready` | `Create/DesignReadyView` | designed; iOS implemented (T104) |
| `21:4554` | You're live · Cloud studio | You're live! ("Make another", "See what buyers see") | `/create/live` | `Listing/YoureLiveView` | designed; iOS implemented (T104) |
| `2026:2865` | Welcome · Web · Sky (v3: restyled) | Welcome: open sky photo, no panels, white title "Your art, / on things / people love.", "Start creating", ink text action "I already have an account"; promises removed (white on bare sky is the accepted exception, R5) | `/create` · `Welcome` | — (web board) | implemented (T113) |
| `2026:2883` | Sign in with code · Web · Sky | Sign in with code | `/create/code` · `CodeSignIn`, `CodeField` | — (web board) | implemented (T105) |
| `2026:2905` | Sign in with code · Prefilled · Web · Sky | Sign in, prefilled (hint under the field) | `/create/code?c=` · `CodeField` | — (web board) | implemented (T105) |
| `2026:2930` | Sign in with code · Error · Web · Sky | Sign in, wrong code (error card) | `/create/code?error=1` · `CodeField` | — (web board) | implemented (T105) |
| `2026:2959` | Choose product · Web · Sky | Choose product | `/create/product` · `ChooseProduct` | — (web board) | implemented (T105) |
| `2026:2998` | Choose method · Web · Sky | Choose method: "How do you want to add your art?", photo and upload only ("Say it out loud" `2026:3046` removed) | `/create/method` · `ChooseMethod` | — (web board) | implemented (T113) |
| `2026:3067` | Change it · Listening · Web · Sky (was Speak · Listening) | Change your art, listening (Art preview "Your art", seconds, Stop, Type instead) | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T113) |
| `2026:3098` | Change it · Question · Web · Sky (was Speak · Question) | Clarifying question about the change | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T113) |
| `2026:3135` | Change it · Microphone off · Web · Sky (was Speak · Microphone off) | Microphone off: type what to change, Make the change | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T113) |
| `2027:3042` | Changing your art · Web · Sky (was Drawing your idea) | Changing your art (Art preview instead of the sky card) | `/create/changing` · `Changing` | — (web board) | implemented (T113) |
| `2027:3062` | Changing your art · Error · Web · Sky | The change did not work this time; Try again, Back to my art | `/create/changing` · `Changing` | — (web board) | implemented (T113) |
| `2027:3091` | Change it · Before and after · Web · Sky (was Result) | Here's the change: You asked, Before / After row, What the image shows, Hear, Use this, Change it again, Back to my original | `/create/compare` · `BeforeAfter`, `BeforeAfterView` | — (web board) | implemented (T113) |
| `2027:3138` | Change it · Web · Sky (entry; was Result · Change it) | Change your art?: Your art, What the image shows, What should change?, Start talking, Make the change, Looks good as is | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T113) |
| `2038:4035` | Change it · Changing · Web · Sky | Changing it… / This can take a minute. | `/create/changing` · `Changing` | — (web board) | implemented (T113) |
| `2038:4060` | Change it · Error · Web · Sky | Error card: Try again, Looks good as is, Try a different change | `/create/changing`, `/create/change` · `Changing`, `ChangeItView`, `errors#ErrorNotice` | — (web board) | implemented (T113) |
| `2027:3184` | Photo · Web · Sky | Take / upload a photo (sky card) | `/create/photo?mode=camera|upload` · `Photo` | — (web board) | implemented (T105) |
| `2027:3207` | Photo · Finding your drawing · Web · Sky | Photo, uploading → finding (MP4 card) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2027:3226` | Photo · Error (no drawing found) · Web · Sky | Photo, no drawing (Retake the photo, Draw a box) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2038:4419` | Photo · Error (other) · Web · Sky | Photo, time-out / other (Try again) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2027:3254` | Choose a pattern · Web · Sky (was Select (Adjust cutout)) | Tap the one you want.: photo, pieces, single pick, Use this / Retake; no cutout tools | `/create/pattern` · `ChoosePattern`, `ChoosePatternView` | — (web board) | implemented (T113) |
| `2038:4092` | Your cutout · Adjust · Web · Sky (was Select · Marks) | Edge tools (Add area / Remove area / Draw a box, marks, Clear marks, Apply cutout), Start over | `/create/cutout` (adjust) · `Cutout` (`YourCutout`), `SelectView` | — (web board) | implemented (T113) |
| `2038:4233` | Your cutout · Web · Sky (was Select · Applied) | Your cutout is ready, Fix the edges, Use this, Start over | `/create/cutout` · `Cutout` (`YourCutout`), `SelectView` | — (web board) | implemented (T113) |
| `2038:4369` | Making your cutout · Web · Sky (was Select · Saving) | Cutting out your changed art | `/create/cutout` (making) · `MakingCutoutView` | — (web board) | implemented (T113) |
| `4031:4378` | Making your sticker · Web · Sky (new) | Making your sticker: loading animation `4037:4390` (342×342, radius 24, `stickerLoading`), Adding the white border… | `/create/making` · `MakingProduct`, `MakingProductView` | — (web board) | implemented (T113) |
| `4038:4573` | Choose product · Tote bag selected · Web · Sky (new) | Choose product with Tote bag selected | `/create/product` · `ChooseProduct` | — (web board) | implemented (T113) |
| `4038:4628` | Making your tote bag · Web · Sky (new) | Making your tote bag (tote wording) | `/create/making` (tote) · `MakingProduct` | — (web board) | implemented (T113) |
| `4038:4644` | Ready · Tote bag · Web · Sky (new) | Your tote bag is ready! | `/create/ready` · `Ready` | — (web board) | implemented (T113) |
| `4038:4662` | Listing · Tote bag · Web · Sky (new) | Listing for a tote (sample $24.00, earn $12.00) | `/create/listing` · `Listing` | — (web board) | implemented (T113) |
| `4038:4713` | Live · Tote bag · Web · Sky (new) | You're live! with the tote on the sky photo | `/create/live` · `Live` | — (web board) | implemented (T113) |
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
| `2018:1789` | Shop · Sky (1440, v3: redesigned) | Shop: hero copy left + rounded photo card right (`4006:4382`, `heroSky`); filter chips + New this week + View all + 2×4 tiles (card Size=Tile `4006:4357`); green story-tag band (3 steps, phone preview, See a story tag in action); Meet the makers (3 cards, All makers) | `/` · `shop/{Hero,Collection,HowSteps,MeetArtist}`, `site/{ProductCard,FilterTabs}` | — (web board) | implemented (T112) |
| `2018:1970` | Shop · Mobile · Sky (390) | Not rebuilt in v3; voice wording removed (entry 3). The 390 layout follows `2018:1789` reflowed | `/` | — (web board) | implemented (T112) |
| `2025:2929` | Shop · Empty collection · Sky | Grey empty card; Filter tabs swapped to Selected=All (entry 3); headings follow `2018:1789` | `shop/Collection`, `shop/MeetArtist` | — (web board) | implemented (T112) |
| `2033:3991` | Shop · Mobile · Menu open · Sky | Nav drawer (component `2032:4004`): modal `<dialog>`, 60 px rows, Close, Esc, Tab wraps, page inert under the scrim | `site/{SiteNav,NavMenu}` | — (web board) | implemented (T106) |
| `2033:4035` | Shop · Skip link focused · Sky | Skip link (component `2032:4002`), 48 px ink pill with the ring | `app/layout.tsx` (`.skip-link` in `globals.css`) | — (web board) | implemented (T106) |
| `2019:2004` | Product page · Sky (1440, v3: redesigned) | Product: breadcrumb, gallery + 4 thumbnails, eyebrow, artist row, price, Size (3 in / 4 in / Sticker sheet), quantity stepper + Add to bag (opens the order sheet, R1), pays-the-artist note, Meet the maker card, 3 disclosures, More from + Visit studio; die-cut preview, buy form and story section removed | `/p/[id]` · `product/{ProductView,BuyForm}` | — (web board) | implemented (T112) |
| `2019:2098` | Product page · Mobile · Sky (390) | Not rebuilt in v3 (voice chip and wording removed only). The 390 layout follows `2019:2004` in one column | `/p/[id]` | — (web board) | implemented (T112) |
| `2019:2189` | Order success · Sky | Success card: sky picture, Thank you!, notified, link row with Copy, Open the story tag, Keep shopping; missing order = h1 + Keep shopping | `/buy/success` · `product/OrderSuccess` | — (web board) | implemented (T106) |
| `2024:2428` | Story tag · Sky (390) | Story tag: site nav and footer, video, Read aloud (secondary), Follow / Share, grey sheet (thank-you Info card, notes with sender lines, Send a note, About me, More from); 640 px column on desktop | `/t/[token]` · `storytag/*`, `site/StoryVideo` | — (web board) | implemented (T106) |
| `2024:2556` | Story tag · Not active · Sky | Sky card, STORY TAG, not active, Go to the shop | `app/t/[token]/not-found.tsx` | — (web board) | implemented (T106) |
| `2024:2597` | Artists · Sky | 72 px title, creator cards (80 px initials, Meet link) | `/artists` · `site/CreatorCard` | — (web board) | implemented (T106) |
| `2024:2652` | Artists · Empty · Sky | Grey empty card | `/artists` · `pages/EmptyNote` | — (web board) | implemented (T106) |
| `2024:2688` | Artist profile · Sky | Header with 120 px avatar, In their own words + Read aloud beside the video, Work by grid | `/c/[slug]` · `pages/CreatorProfile` | — (web board) | implemented (T106) |
| `2025:2682` | How it works · Sky | Same layout; the voice point is rewritten (entry 3) | `/how-it-works` · `pages/StaticPage` | — (web board) | implemented (T112) |
| `2025:2747` | For studios · Sky | Same layout; point 2 shortened, point 4 removed (entry 3) | `/for-studios` · `pages/StaticPage` | — (web board) | implemented (T112) |
| `2025:2809` | Accessibility · Sky | Same layout; "Typing works everywhere" and "Image descriptions" points (entry 3) | `/accessibility` · `pages/StaticPage` | — (web board) | implemented (T112) |
| `2025:2886` | 404 · Sky | Site nav, sky picture, title, Go to the shop | `app/not-found.tsx` | — (web board) | implemented (T106) |
| `2031:3895` | Admin · Orders · Sky (1440) | Admin: {brand} · Admin header, orders table (Mark {status} pills, story tag cell), green code card above the Creators table, Add creator card | `/admin` · `admin/{AdminShell,OrdersTable,StatusButtons,CreatorsPanel,CodeCard}` | — (web board) | implemented (T106) |
| `2031:4384` | Admin · Orders · Empty · Sky | Grey empty cards | `/admin` | — (web board) | implemented (T106) |
| `2034:3995` | Admin · AI trace · Sky (v3: steps relabelled) | Photo and mask → Change request → Edit instruction → Before and after → Description → Decision → Sticker; Other model calls | `/admin/trace/[artworkId]` · `admin/TraceView` | — (web board) | implemented (T112) |
| `2034:4158` | Admin · AI trace · Missing · Sky | Grey empty card + Back to orders | `admin/TraceView` | — (web board) | implemented (T106) |

### iOS creation boards (v3, T110)

The B1 / B2 boards that changed in v3 (renamed in place, node ids kept, Changelog entries 4, 7, 8, 11). Every row is implemented by T114 (`implemented (T114)`); the "iOS view" column names the v3 views. Copy: `docs/design/copy-v3-ios.md`.

| Figma node | Board (v3 name) | Was | iOS view | Status |
|---|---|---|---|---|
| `2013:408` | Choose a pattern · Sky | Adjust cutout (`AdjustCutoutView`, pick step) | `Create/ChoosePatternView` | implemented (T114) |
| `2012:387` | Change it · Sky (entry, after Choose a pattern › Use this) | Voice result · Change it | `Create/ChangeItView` | implemented (T114) |
| `2011:208` | Change it · Listening · Sky | Speak · Listening | `Create/ChangeItView` | implemented (T114) |
| `2011:246` | Change it · Typing · Sky | Speak · Type instead | `Create/ChangeItView` | implemented (T114) |
| `2011:293` | Change it · Clarifying question · Sky | Speak · Clarifying question | `Create/ChangeItView` (no question on iOS) | implemented (T114) |
| `2011:334` | Change it · Microphone off · Sky | Speak · Microphone off | `Create/ChangeItView` | implemented (T114) |
| `2021:2169` | Change it · Transcribing · Sky | Speak · Transcribing | `Create/ChangeItView` | implemented (T114) |
| `2021:2216` | Change it · Error · Sky | Speak · Error | `Create/ChangeItView` | implemented (T114) |
| `2012:276` | Changing your art · Sky | Drawing your idea | `Create/ChangingView` | implemented (T114) |
| `2012:307` | Changing your art · Error · Sky | Drawing your idea · Error | `Create/ChangingView` | implemented (T114) |
| `2012:344` | Change it · Before and after · Sky | Voice result | `Create/BeforeAfterView` | implemented (T114) |
| `4030:4482` | Making your cutout · Sky (new) | — (clone of Changing your art) | `Create/MakingCutoutView` | implemented (T114) |
| `2013:618` | Your cutout · Sky (edge tools kept) | Adjust cutout · Preview | `Create/YourCutoutView` | implemented (T114) |
| `2014:733` | Making your sticker · Sky (logo mark, no Back; animation `4037:4389`) | Listing details · Making your sticker | `Create/MakingProductView` | implemented (T114) |
| `4038:4494` | Making your tote bag · Sky (new) | — | `Create/MakingProductView` | implemented (T114) |
| `4038:4517` | Listing details · Tote bag · Sky (new) | — | `Listing/ListingDetailsView` | implemented (T114) |
| `4038:4389` | Home · Create tab · Tote bag selected · Sky (new, B2) | — | `Create/PickProductView` | implemented (T114) |
| `2014:678` | Listing details · Sky | unchanged; now reached after Making your sticker | `Listing/ListingDetailsView` | implemented (T104) |

Removed from the flow in v3: "Say it out loud" (Choose method), the voice idea path, Drawing your idea as an idea generator, the 3-picture chooser and page dots. The Cloud studio frames outside the sections (`21:4229` … `21:4554`) did not change; `21:4229` (iOS Welcome) keeps its scrim (R5).

iOS (T104): the eight designed boards and the B1 iOS boards (Sign in with code, Speak, Drawing your idea, Voice result, Camera, Adjust cutout `2013:408`/`2013:618`, Listing details, Story video, Video saved) are implemented; details in `docs/handoffs/ios.md` ("Screens to the boards (T104)"). Copy from the designed boards replaced the app's wording: Welcome "Your art, on things people love." / "Draw it or say it. We make the sticker or tote." / "I already have an account"; Pick "What do you want to make?" / "You can make the other one later." / "Die-cut, waterproof" / "Natural canvas"; Choose "Choose how you want to bring your drawing into the studio." / "Snap your drawing" / "Pick one you already have" / "Describe it, we draw it for you" / "NO DRAWING SKILL NEEDED"; Finding "Finding your drawings…" / "This takes a few seconds…"; Adjust cutout message line (the board's "Got the fern! Tap the flower to switch." names sample art and describes swapping; a second piece is combined): "Tap a piece below to pick it." / "Got piece %lld! Tap another piece to add it too." / "Got %lld pieces. They are cut out together."; Ready "Your sticker is ready!" (tote: "Your tote bag is ready!") / "People can buy it on The 3rd Eye. It's also saved in My designs, so you can list it later too." (deliberate edit of the board's "…on The 3rd Eye platform. It's Also saved…": "platform" dropped, "Also" lower-cased; the brand comes from `Tokens.Brand`); Live "<title> is in the shop." / "We'll tell you when someone buys it. Every sticker ships with your story tag." UI-test labels follow (`Sticker, Die-cut, waterproof`, `Upload a picture, Pick one you already have`, `Say it out loud, Describe it, we draw it for you`).

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

Accessibility settings sheet, helper-mode button, "Hear what the image shows" play bar, per-field mic icons. Voice remains only on "Say it out loud" and "Say what to change" (v3, T110: only "Say what to change" on Change it remains; "Say it out loud" is removed). The canvas still draws the helper-mode button (E4 Welcome) and a "Your helper can hold the phone" line (E4 Method); web keeps the "Hear the question again" button on the clarifying question.

## Figma intake log

| Date | Source | Page | Frames | Result |
|---|---|---|---|---|
| 2026-10-30 | Figma file key `vIOMPzc2kjP18BbgduLmc8` (T100) | `0:1` "Exploration 5 · Sky" | `21:4229`, `45:700`, `21:4340`, `21:4390`, `21:4450`, `40:488`, `21:4509`, `21:4554` (390×844; Sticker ready is 390×867) | First Figma intake; replaces the canvas. No Figma variables: tokens v2 read from node styles of `21:4229`, `45:700`, `21:4340`, `21:4509` (the seat's MCP allowance ran out before the other four, which were read from screenshots). 11 assets exported to `design/assets/`, 4 pending at the time (resolved in the next row). Off-token: `#E4F3C8`, `#5FAE57`, `#19583C`, `#C6C6C6`; Figtree on `21:4340`. Procedure and open questions: `docs/handoffs/design.md`. |
| 2026-10-30 | the user's copy, key `dAdjR5HFtOutFlUZi957Do` (T100 fix round 1) | `0:1` | `21:4390`, `21:4450`, `40:488`, `21:4554` read in full | Same node ids as the original. Confirms the tokens; adds `#374151` message text and three illustration shadows (open questions in `docs/design/tokens.md`). Assets: `mascot-magnifier.gif` (the Finding fill is an animated GIF, so there is no separate `sky-1`), `sky.png`, `mascot-front.png`; icons renamed `icon-*`. Only `mascot-wave` stays pending. |
| 2026-11-01 | Figma file key `WVJuvNJnfcNaAqOW6jWeWi` (designer's v3; T110) | `0:1`, Components `2004:96`, Assets `4036:4403` | Changelog `2043:4304` (12 entries), Proposal `4017:4437`; all B1–B5 boards listed above; `asset/sticker-loading` `4036:4404` | Product pivot plus visual pass. Changelog: (1) shop hero scrim card, superseded by (2) Shop `2018:1789` and Product `2019:2004` redesigned, new variables `color/accentSoft`, `color/scrimStrong`, Secondary action Style=On photo `4002:4357`, Web product card Size=Tile `4006:4357`; (3) voice creation removed from the public site and from Filter tabs `2010:570` and Web product card `2035:4130`; (4) new creation flow, 10 iOS and 9 web boards renamed to Change it / Changing your art, Art preview component `4021:4470`, admin trace steps relabelled; (5) Welcome · Web restyled to the open sky, promises removed; (6) its top gradient removed, white text on bare sky (~2.5:1, accepted exception); (7) flow order photo → Choose a pattern → Change it → Making your cutout → Your cutout, `2013:408`, `2013:618`, `2027:3254`, `2038:4092/4233/4369` renamed, new `4030:4482`; (8) Making your sticker iOS `2014:733` and new web `4031:4378`; (9) Outfit replaces Inter in all 10 text styles (I/l look alike); (10) loading GIF placed (320×320, 121 frames, 1x); (11) tote clones `4038:4389/4494/4517/4573/4628/4644/4662/4713`; (12) sections restacked, positions only, Note · Hero motion frame `2035:4133` moved (its text `2035:4134` was updated in entry 2: hero text on `color/page`). New boards in v3: **10** (iOS 4: `4030:4482`, `4038:4494`, `4038:4517`, `4038:4389`; web 6: `4031:4378`, `4038:4573`, `4038:4628`, `4038:4644`, `4038:4662`, `4038:4713`); also new: component Art preview `4021:4470`, card variant Size=Tile `4006:4357`, Secondary action Style=On photo `4002:4357`, Assets page frame `4036:4404`. Variables read with `get_variable_defs` on `2018:1789` and `2012:387` (tokens v3); board text read on 2026-11-01. Assets: `sticker-loading.gif` (1x; 2x pending from the designer); the hero photo card reuses `hero-sky.png` (same image hash). Copy: `docs/design/copy-v3-web.md`, `docs/design/copy-v3-ios.md`. |

### Reading the next version
- The next version may arrive under a **new file key** (the designer works in copies). The authoritative record of the current key is this intake log (the newest row). `design/tokens.json` `meta.source`, `docs/design/figma-rules.md` and `docs/handoffs/design.md` name it for provenance and are updated in the same intake; no code, test or script embeds a key, so a new key never needs a code change.
- Compare by **node id**, not by board name or file: ids survive renames and copies (the v3 copy kept every v2 id). A board whose id is missing is removed; a new id is a new board; a name change is a rename.
- Never write the file's title anywhere in the repo.

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
