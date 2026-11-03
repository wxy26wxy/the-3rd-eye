# Screens · web

Since T110 (2026-11-01) the design source is the designer's v3 file; its key is recorded only in the "Figma intake log" at the end of this page (see "Reading the next version"). Node ids are the same as in the earlier keys (`vIOMPzc2kjP18BbgduLmc8`, the user's copy `dAdjR5HFtOutFlUZi957Do`), page `0:1` "Exploration 5 · Sky" (direction "Sky v3 · Outfit on white"). Where each token value comes from: `docs/design/tokens.md`. The node table below maps every Figma board to its screen. The tables after it still name the old canvas boards ("Direction A"): they describe the components as built today, until T102 (web) and T103 (iOS) re-skin them to Sky. Every screen uses tokens from `web/app/tokens.css` through the primitives in `web/components/ui/*`; images come from `web/lib/assets.ts`; copy is in `web/messages/en.json`.

## Figma node table (Sky)

Web creator boards (batch B4, section `2026:2864`) were implemented by T105; their rows follow the eight designed frames. The public site (B3) and admin (B5) boards are implemented by T106; their rows close the table. Board screenshots and the 390 px comparison shots live outside the repo.

Status: **retired (round 3)** = the screen is removed from both apps in feedback round 3 (2026-11-03); the board stays on the canvas with an ink "Retired" note (Changelog entry 14). **implemented (T135)** / **implemented (T136)** = changed in feedback round 3 (edits in "Feedback round 3" below, Changelog entry 14) and built on the web (T135) / in the iOS app (T136), both merged 2026-11-03; between the Figma edit and the iOS merge these rows read **pending (v5, T137)**. What the boards still do not show is in "Round 3 — to mirror in Figma". **implemented (T122)** / **implemented (T123)** = changed or new in feedback round 2 (2026-11-03; edits listed in "Feedback round 2" below) and now in the iOS app (T122) or on the web (T123); the product page and shop card previews also carry T127 fixes; before those merged the rows read **pending (v4, T120)**; **pending (v3, T110)** = the board changed or is new in v3 and the screen does not follow it yet (status reset at the T110 intake; the implementing task sets it back to implemented); **designed** = a board exists in the Figma file; **generated** = drawn by the design agent in the duplicated file (T101), waiting for the user's review; **pending** = no board yet; **implemented (T1xx)** = the screen follows the board in code. iOS views are in `ios/App/Screens/`.

| Figma node | Board | Screen | Web route | iOS view | Status |
|---|---|---|---|---|---|
| `21:4229` | Welcome · Cloud studio | Welcome (full-bleed sky photo, white text, white pill CTA, "I already have an account") (v4: subtitle removed, item 1) | `/create` | `Onboarding/WelcomeView` | designed; iOS implemented (T122) |
| `45:700` | Pick sticker or tote · Cloud studio | Choose product (two cards, radio, "Next") | `/create/product` | `Create/PickProductView` | designed; iOS implemented (T104) |
| `21:4340` | Choose how to make it · Cloud studio | Choose method (photo / upload / say it, "NO DRAWING SKILL NEEDED") | `/create/method` | `Create/ChooseMethodView` | designed; iOS implemented (T104) |
| `21:4390` | Finding drawings · Cloud studio | Finding your drawings (dreamscape, "This takes a few seconds...") | `/create/select` (loading) | `Create/FindingDrawingsView` | designed; iOS implemented (T104); **retired** (round 4: no Finding screen; note `6007:4706`) |
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
| `2026:3098` | Change it · Question · Web · Sky (was Speak · Question) | Clarifying question about the change | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | not built (API returns no question) |
| `2026:3135` | Change it · Microphone off · Web · Sky (was Speak · Microphone off) | Microphone off: type what to change, Make the change | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T113) |
| `2027:3042` | Changing your art · Web · Sky (was Drawing your idea) | Changing your art (Art preview instead of the sky card) | `/create/changing` · `Changing` | — (web board) | implemented (T113); round 4: the product photo, three status lines (T140) |
| `2027:3062` | Changing your art · Error · Web · Sky | The change did not work this time; Try again, Back to my art | `/create/changing` · `Changing` | — (web board) | implemented (T113) |
| `2027:3091` | Change it · Before and after · Web · Sky (was Result) | Here's the change: You asked, Before / After row, What the image shows, Hear, Use this, Change it again, Back to my original | `/create/compare` · `BeforeAfter`, `BeforeAfterView` | — (web board) | implemented (T113); round 4: two product photos, subtitle, Fix the cutout (T140) |
| `2027:3138` | Change it · Web · Sky (entry; was Result · Change it) | Change your art?: Your art, What the image shows, What should change?, Start talking, Make the change, Looks good as is (v4: Make the change and Looks good as is in one row in the card, no pinned bar, R4) | `/create/change` · `ChangeIt`, `ChangeItView` | — (web board) | implemented (T123); round 4: the product photo; making state = new board `6007:4777`; Fix the cutout (T140) |
| `2038:4035` | Change it · Changing · Web · Sky | Changing it… / This can take a minute. | `/create/changing` · `Changing` | — (web board) | implemented (T113); round 4: the product photo, three status lines (T140) |
| `2038:4060` | Change it · Error · Web · Sky | Error card: Try again, Looks good as is, Try a different change | `/create/changing`, `/create/change` · `Changing`, `ChangeItView`, `errors#ErrorNotice` | — (web board) | implemented (T113) |
| `2027:3184` | Photo · Web · Sky | Take / upload a photo (sky card) (v4: Sky card → `mascotCard` image card, R7) | `/create/photo?mode=camera|upload` · `Photo` | — (web board) | implemented (T123) |
| `2027:3207` | Photo · Finding your drawing · Web · Sky | Photo, uploading → finding (MP4 card) (v4: new Finding animation via Sky card · Scene=Searching `2030:4015`, R7) | `/create/photo` · `Photo` | — (web board) | implemented (T123); **retired** (round 4: no upload step; note `6007:4709`) |
| `2027:3226` | Photo · Error (no drawing found) · Web · Sky | Photo, no drawing (Retake the photo, Draw a box) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2038:4419` | Photo · Error (other) · Web · Sky | Photo, time-out / other (Try again) | `/create/photo` · `Photo` | — (web board) | implemented (T105) |
| `2027:3254` | Choose a pattern · Web · Sky (was Select (Adjust cutout)) | Tap the one you want.: photo, pieces, single pick, Use this / Retake; no cutout tools (v4: Use this → Adjust the area; no-drawing path goes straight to Adjust the area) | `/create/pattern` · `ChoosePattern`, `ChoosePatternView` | — (web board) | retired (round 3) |
| `6004:4689` | Adjust the area · Web · Sky (new, v4) | Adjust the area: photo, resizable frame on the picked piece (bbox + 8 %), 4 corner handles, keyboard hint, Use this area / Reset (v5: opens on the raw photo with the frame at the whole photo; Use this area → detect, round 3) | `/create/adjust` (name owned by the web task) | — (web board) | implemented (T135); round 4: on the local photo, no request (T140) |
| `2038:4092` | Your cutout · Adjust · Web · Sky (was Select · Marks) | Edge tools (Add area / Remove area / Draw a box, marks, Clear marks, Apply cutout), Start over | `/create/cutout` (adjust) · `Cutout` (`YourCutout`), `SelectView` | — (web board) | retired (v4, T120): replaced by Adjust the area `6004:4689` |
| `2038:4233` | Your cutout · Web · Sky (was Select · Applied) | Your cutout is ready, Fix the edges, Use this, Start over (v4: Fix the edges removed; "Here's your cutout.") | `/create/cutout` · `Cutout` (`YourCutout`), `SelectView` | — (web board) | implemented (T135); round 4: the crop, no frame outline (T140) |
| `2038:4369` | Making your cutout · Web · Sky (was Select · Saving) | Cutting out your changed art (v4: cutout making shows `stickerLoading`, R7) | `/create/cutout` (making) · `MakingCutoutView` | — (web board) | implemented (T123); round 4: crop → one upload → `POST /artworks {framed}` (T140) |
| `4031:4378` | Making your sticker · Web · Sky (new) | Making your sticker: loading animation `4037:4390` (342×342, radius 24, `stickerLoading`), Adding the white border… (v4: new `stickerLoading` file, R7) | `/create/making` · `MakingProduct`, `MakingProductView` | — (web board) | implemented (T123); **retired** (round 4: made on Change it; note `6007:4718`) |
| `4038:4573` | Choose product · Tote bag selected · Web · Sky (new) | Choose product with Tote bag selected | `/create/product` · `ChooseProduct` | — (web board) | implemented (T113) |
| `4038:4628` | Making your tote bag · Web · Sky (new) | Making your tote bag (tote wording) | `/create/making` (tote) · `MakingProduct` | — (web board) | implemented (T113); **retired** (round 4: made on Change it; note `6007:4721`) |
| `4038:4644` | Ready · Tote bag · Web · Sky (new) | Your tote bag is ready! | `/create/ready` · `Ready` | — (web board) | implemented (T113) |
| `4038:4662` | Listing · Tote bag · Web · Sky (new) | Listing for a tote (sample $24.00, earn $12.00) | `/create/listing` · `Listing` | — (web board) | implemented (T113) |
| `4038:4713` | Live · Tote bag · Web · Sky (new) | You're live! with the tote on the sky photo (v4: `mascotShop`, R7) | `/create/live` · `Live` | — (web board) | implemented (T123) |
| `2030:3726` | Ready · Web · Sky | Your sticker is ready! | `/create/ready` · `Ready` | — (web board) | implemented (T105) |
| `2038:4443` | Ready · Notice · Web · Sky | Ready with the cutout notice | `/create/ready` · `Ready` | — (web board) | implemented (T105) |
| `2030:3752` | Listing · Web · Sky | Get it ready for the shop (board order) | `/create/listing` · `Listing`, `ListingView` | — (web board) | implemented (T135) |
| `2030:3804` | Listing · Drafting · Web · Sky | Listing, drafting (v4: loader → `stickerLoading` animation, "Writing your listing…" + hint, R5) | `/create/listing` · `ListingView` | — (web board) | implemented (T135) |
| `6006:4657` | Listing · Print warning · Web · Sky (new, round 3) | Listing with the contrast warning line "Print check: the colors may look faint" (alert icon), the 409 card "Some colors in your art are close together…" and the text actions "Use anyway" / "Re-do the cutout"; the AI product photo on top | `/create/listing` · `ListingView`, `errors#ErrorNotice` | — (web board) | implemented (T135) |
| `2030:3832` | Listing · Error · Web · Sky | Listing, 409 print check / moderation | `/create/listing` · `ListingView` | — (web board) | implemented (T105) |
| `2030:3884` | Story video · Web · Sky | Make your story video! (v4: redo mode from My story video, R6) | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T123) |
| `2038:4469` | Story video · Video selected · Web · Sky | Story video, file chosen | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2030:3931` | Story video · Draft · Web · Sky | Story draft | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2038:4510` | Story video · Draft editing · Web · Sky | Story draft, editing | `/create/story-video` · `StoryVideo` | — (web board) | implemented (T105) |
| `2030:3958` | Live · Web · Sky | You're live! (v4: Sky card → `mascotShop`, R7) | `/create/live` · `Live` | — (web board) | implemented (T123) |
| — | — | Home, My designs (status badges), Design detail, Messages, Orders | — | `Home/*`, `Orders/*` | pending |
| `2018:1789` | Shop · Sky (1440, v3: redesigned) | Shop: hero copy left + rounded photo card right (`4006:4382`, `heroSky`); filter chips + New this week + View all + 2×4 tiles (card Size=Tile `4006:4357`); green story-tag band (3 steps, phone preview, See a story tag in action); Meet the makers (3 cards, All makers) (v4: tiles show the bordered sticker preview, contain, card Size=Tile `4006:4357`, R1) | `/` · `shop/{Hero,Collection,HowSteps,MeetArtist}`, `site/{ProductCard,FilterTabs}` | — (web board) | implemented (T135) |
| `2018:1970` | Shop · Mobile · Sky (390) | Not rebuilt in v3; voice wording removed (entry 3). The 390 layout follows `2018:1789` reflowed | `/` | — (web board) | implemented (T112) |
| `2025:2929` | Shop · Empty collection · Sky | Grey empty card; Filter tabs swapped to Selected=All (entry 3); headings follow `2018:1789` | `shop/Collection`, `shop/MeetArtist` | — (web board) | implemented (T112) |
| `2033:3991` | Shop · Mobile · Menu open · Sky | Nav drawer (component `2032:4004`): modal `<dialog>`, 60 px rows, Close, Esc, Tab wraps, page inert under the scrim | `site/{SiteNav,NavMenu}` | — (web board) | implemented (T106) |
| `2033:4035` | Shop · Skip link focused · Sky | Skip link (component `2032:4002`), 48 px ink pill with the ring | `app/layout.tsx` (`.skip-link` in `globals.css`) | — (web board) | implemented (T106) |
| `2019:2004` | Product page · Sky (1440, v3: redesigned) | Product: breadcrumb, gallery + 4 thumbnails, eyebrow, artist row, price, Size (3 in / 4 in / Sticker sheet), quantity stepper + Add to bag (opens the order sheet, R1), pays-the-artist note, Meet the maker card, 3 disclosures, More from + Visit studio; die-cut preview, buy form and story section removed (v4: gallery slide 1 = sticker preview; AI mockup only as a later slide, R1) | `/p/[id]` · `product/{ProductView,BuyForm}` | — (web board) | implemented (T135) |
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
| `2013:408` | Choose a pattern · Sky | Adjust cutout (`AdjustCutoutView`, pick step) | `Create/ChoosePatternView` | retired (round 3) |
| `2012:387` | Change it · Sky (entry, after Choose a pattern › Use this) | Voice result · Change it | `Create/ChangeItView` | implemented (T122); round 4: the product photo; making state = new board `6007:4724`; Fix the cutout (T141, in review) |
| `2011:208` | Change it · Listening · Sky | Speak · Listening | `Create/ChangeItView` | implemented (T114) |
| `2011:246` | Change it · Typing · Sky | Speak · Type instead | `Create/ChangeItView` | implemented (T114) |
| `2011:293` | Change it · Clarifying question · Sky | Speak · Clarifying question | `Create/ChangeItView` (no question on iOS) | implemented (T114) |
| `2011:334` | Change it · Microphone off · Sky | Speak · Microphone off | `Create/ChangeItView` | implemented (T114) |
| `2021:2169` | Change it · Transcribing · Sky | Speak · Transcribing | `Create/ChangeItView` | implemented (T114) |
| `2021:2216` | Change it · Error · Sky | Speak · Error | `Create/ChangeItView` | implemented (T114) |
| `2012:276` | Changing your art · Sky | Drawing your idea | `Create/ChangingView` | implemented (T114); round 4: three status lines (T141, in review) |
| `2012:307` | Changing your art · Error · Sky | Drawing your idea · Error | `Create/ChangingView` | implemented (T114) |
| `2012:344` | Change it · Before and after · Sky | Voice result | `Create/BeforeAfterView` | implemented (T114); round 4: two product photos, subtitle, Fix the cutout (T141, in review) |
| `4030:4482` | Making your cutout · Sky (new) | — (clone of Changing your art) | `Create/MakingCutoutView` | implemented (T122); round 4: crop → one upload → `POST /artworks {framed}` (T141, in review) |
| `2013:618` | Your cutout · Sky (v4: simplified per R3: preview, status line, Use this, Start over; edge tools removed) | Adjust cutout · Preview (v3: edge tools kept) | `Create/YourCutoutView` | implemented (T136); round 4: the stored crop, no frame outline (T141, in review) |
| `2014:733` | Making your sticker · Sky (logo mark, no Back; animation `4037:4389`) | Listing details · Making your sticker | `Create/MakingProductView` | implemented (T122); **retired** (round 4: made on Change it; note `6007:4712`) |
| `4038:4494` | Making your tote bag · Sky (new) | — | `Create/MakingProductView` | implemented (T122); **retired** (round 4: made on Change it; note `6007:4715`) |
| `4038:4517` | Listing details · Tote bag · Sky (new) | — | `Listing/ListingDetailsView` | implemented (T114) |
| `4038:4389` | Home · Create tab · Tote bag selected · Sky (new, B2) | — | `Create/PickProductView` | implemented (T114) |
| `2014:678` | Listing details · Sky | unchanged; now reached after Making your sticker | `Listing/ListingDetailsView` | implemented (T136) |
| `6004:4576` | Adjust the area · Sky (new, v4; v5: frame at the whole photo) | — (v5: right after the photo; also Design detail › Re-do the cutout) | `Create/AdjustAreaView` (new) | implemented (T136); round 4: on the local photo, no request; Take a new photo (T141, in review) |
| `6004:4792` | Listing details · Drafting · Sky (new, v4) | — (drafting state of `2014:678`) | `Listing/ListingDetailsView` | implemented (T136) |
| `2015:783` | Home · Create tab · Sky (v4: My story video row `6004:4853`) | unchanged since T104 | `Create/PickProductView` | implemented (T122) |
| `4038:4389` | Home · Create tab · Tote bag selected · Sky (v4: row `6004:4860`) | — | `Create/PickProductView` | implemented (T122) |
| `6004:4867` | My story video · Sky (new, v4, B2) | — | `Create/StoryVideoLibraryView` (new) | implemented (T122) |

Removed from the flow in v3: "Say it out loud" (Choose method), the voice idea path, Drawing your idea as an idea generator, the 3-picture chooser and page dots. The Cloud studio frames outside the sections (`21:4229` … `21:4554`) did not change; `21:4229` (iOS Welcome) keeps its scrim (R5).

iOS (T104): the eight designed boards and the B1 iOS boards (Sign in with code, Speak, Drawing your idea, Voice result, Camera, Adjust cutout `2013:408`/`2013:618`, Listing details, Story video, Video saved) are implemented; details in `docs/handoffs/ios.md` ("Screens to the boards (T104)"). Copy from the designed boards replaced the app's wording: Welcome "Your art, on things people love." / "Draw it or say it. We make the sticker or tote." / "I already have an account"; Pick "What do you want to make?" / "You can make the other one later." / "Die-cut, waterproof" / "Natural canvas"; Choose "Choose how you want to bring your drawing into the studio." / "Snap your drawing" / "Pick one you already have" / "Describe it, we draw it for you" / "NO DRAWING SKILL NEEDED"; Finding "Finding your drawings…" / "This takes a few seconds…"; Adjust cutout message line (the board's "Got the fern! Tap the flower to switch." names sample art and describes swapping; a second piece is combined): "Tap a piece below to pick it." / "Got piece %lld! Tap another piece to add it too." / "Got %lld pieces. They are cut out together."; Ready "Your sticker is ready!" (tote: "Your tote bag is ready!") / "People can buy it on The 3rd Eye. It's also saved in My designs, so you can list it later too." (deliberate edit of the board's "…on The 3rd Eye platform. It's Also saved…": "platform" dropped, "Also" lower-cased; the brand comes from `Tokens.Brand`); Live "<title> is in the shop." / "We'll tell you when someone buys it. Every sticker ships with your story tag." UI-test labels follow (`Sticker, Die-cut, waterproof`, `Upload a picture, Pick one you already have`, `Say it out loud, Describe it, we draw it for you`).

Frame 1 on Welcome (`36:422`) is the white logo mark; on every other board the mark is "Union" (`45:712`, `36:469`, `36:471`, `36:473`, `40:500`, `36:475`, `36:477`), 40×35 at the top left, exported as `design/assets/logo-mark.svg`.

## Feedback round 2 (2026-11-03, T120): edits in the designer's file

Made in place in the current file (newest key in the intake log), Changelog `2043:4304` entry "2026-11-03 (13) · feedback round 2". Existing node ids are kept; new boards sit in free slots of their sections. Every board below was checked with a screenshot after the edit. Copy: `docs/design/copy-v4.md`. Rulings R1–R8 of feedback round 2.

| Node | Board | Edit | Ruling |
|---|---|---|---|
| `21:4229` | Welcome · Cloud studio (iOS) | No edit needed: the board has no subtitle. The app's sentence "Snap or upload your art. We make the sticker or tote." (a T110 PM default) is removed in code. | item 1 |
| `2012:387` | Change it · Sky | "Make the change" (primary `2012:433`, arrow hidden so the label fits) and "Looks good as is" (secondary `6004:4574`, 56 high) in one row, Action row `6004:4573`, at the bottom of the change card `2012:418`; each half the card width (147 / 149 px). Pinned actions `2012:404` deleted (and with it `2012:439`); `2012:403` keeps only the home indicator. Board 1196 → 1116 high. | R4 |
| `2013:618` | Your cutout · Sky | Segmented control `2013:813`, instruction `2013:827`, Clear marks `2013:830`, Apply cutout `2013:837` deleted; body `2013:634` → "Here's your cutout."; keeps the checkerboard preview, status line `2013:767`, Use this (pinned), Start over. | R3 (superseded by Round 2b item 2) |
| `2038:4233` | Your cutout · Web · Sky | Fix the edges `2038:4356` deleted; body `2038:4242` → "Here's your cutout."; Info card `2038:4358` (rebuild notice) kept. `2038:4092` Your cutout · Adjust · Web is retired (left on the canvas, not implemented). | R3 (superseded by Round 2b item 2) |
| `6004:4576` | **Adjust the area · Sky** (new, B1, clone of `2013:408`) | Photo card with the piece selection cleared; frame `6004:4678` = ink edge `6004:4680` (3 px) + white halo (5 px) on the fern's box grown by 8 %; four corner handles `6004:4681`, `6004:4683`, `6004:4685`, `6004:4687` (44×44 target, 22 px white knob with 3 px ink ring); pieces strip removed; primary "Use this area" `6004:4590`, secondary "Reset" `6004:4591`. | R2 |
| `6004:4689` | **Adjust the area · Web · Sky** (new, B4, clone of `2027:3254`) | Same frame `6004:4780` (edge `6004:4782`, handles `6004:4783`, `6004:4785`, `6004:4787`, `6004:4789`), keyboard hint `6004:4791` under the photo, "Use this area" `6004:4702`, "Reset" `6004:4703`. | R2 |
| `6004:4792` | **Listing details · Drafting · Sky** (new, B1, clone of `2014:678`) | Body line, product picture, Improve with AI, the three fields and the earn card removed; drafting card `6004:4838`: loading animation `6004:4839` (342×342, radius 24, `stickerLoading`), "Writing your listing…" `6004:4840` (titleL), "We'll show the name, price and description when it's ready." `6004:4841` (body, muted); "Approve and list it" `6004:4809` swapped to State=Disabled. | R5 |
| `2015:783`, `4038:4389` | Home · Create tab · Sky (and Tote bag selected) | New row "My story video" under the product cards: `6004:4853` / `6004:4860` (white card, 1 px border, radius 20, 56 px thumbnail, "My story video" titleL, "Recorded Nov 2, 2026" bodyS muted, chevron). Boards 844 → 869 high (the column grows). | R6 |
| `6004:4867` | **My story video · Sky** (new, B2, from Story video `2014:761`) | Title "My story video"; player `6004:4909` (342×300, radius 24) with play button "Watch" `6004:4910` (64 px) and a caption chip `6004:4913`; "Recorded Nov 2, 2026" `6004:4915`; Mention my disability toggle `6004:4888`; pinned primary "Record again" `6004:4891`; Skip for now removed. | R6 |
| `4006:4357` | Web product card · Size=Tile (component) | Art layer `4006:4359` renamed "Art (sticker preview: bordered die-cut PNG, contain, never cropped)", soft drop shadow. The sample art already shows the white die-cut border. | R1 |
| `4036:4404` | Assets · asset/sticker-loading | Fill replaced by the "creating cutout" GIF (image hash = the SHA-1 of `design/assets/sticker-loading.gif`); same file uploaded into the slots `4037:4389` (Making your sticker · Sky), `4037:4390` (Making your sticker · Web), `4038:4502` (Making your tote bag · Sky), `4038:4636` (Making your tote bag · Web) and `6004:4839`. | R7 |
| `6004:4936` | Assets · **asset/mascot-magnifier** (new, 320×320) | The "finding image" GIF; also set on Finding drawings `21:4406` and on component Sky card · Scene=Searching `2030:4015` (so Photo · Finding your drawing · Web `2027:3207` follows). | R7 |
| `6004:4937` | Assets · **asset/mascot-card** (new, 1192×1016) | the original upload (2384×2032); the repo keeps a 1200 px copy (fix round 0). | R7 |
| `6004:4938` | Assets · **asset/mascot-shop** (new, 1024×1024) | the original upload (2048×2048); the repo keeps a 1200 px copy (fix round 0). | R7 |
| `2043:4304` | Changelog | Entry (13) appended to text `2043:4306`: every board id and copy change above. | R8 |

Not mirrored on the boards (the code follows the rulings): the card mascot replacing the Sky card on Camera · Sky `2012:445` and Photo · Web `2027:3184`; the pointing mascot on You're live (`21:4554`, `2030:3958`, `4038:4713`, iOS drops the tilted mockup card); the sticker preview on Listing details `2014:678`, Ready and You're live boards (they draw the sample mascot illustration); the stacked Change it row at accessibility sizes; the "No story video yet" row state.

## Round 2b — to mirror in Figma (2026-11-03, T132)
The apps changed after the round 2 boards were drawn (user rulings, 2026-11-03). Nothing below has been edited in the designer's file; these are the boards the designer needs to update. The code is the reference until then.

1. **Order: Adjust the area → Making your cutout → Your cutout → Change it.** The cutout is made and shown before Change it; "Looks good as is" (on Change it) goes straight to Making your sticker or tote bag; after a change, Before and after › "Use this" → Making your cutout → Your cutout → Making product. Flow arrows and the step hints between these boards need to follow this order (Change it boards `2012:387` iOS, `2027:3138` web, Before and after `2027:3091` web; Making your cutout `4030:4482` iOS, `2038:4369` web).
2. **Your cutout gets Add area / Remove area back** (the "Draw a box" mode stays removed; the frame from Adjust the area is the box). Boards: `2013:618` (iOS), `2038:4233` (web, the cut) and `2038:4092` (web, Fix the edges). Restore from the v3 versions of these boards: the Add area / Remove area picker, the instruction, "Fix the edges", the marks (iOS marks; web Marks list and "Add the area around your art"), Clear marks, "Apply cutout", plus "Use this" and "Start over". The lead is "Here's the cutout of your art. Fix the edges if you need to." (after a change: "...of your changed art..."). A second state for the changed art can reuse the same board.
3. **Tote picture is the AI mockup again** (Muse Image, `mockupUrl`), not a composite. Boards showing a tote product picture: web Ready `4038:4644`, web Listing `4038:4662`, web Live `4038:4713`, iOS Listing details `4038:4517`, and the shop tote tile and first product-page picture on the shop boards (`2018:1789` shop and the product page board). Stickers keep the bordered die-cut preview.
4. Smaller, from the flow check: iOS Story video has no Back after the listing is approved; Start over on Your cutout goes to Choose method (iOS hint "Starts again from the choice of photo").

## Feedback round 3 (2026-11-03, T137): edits in the designer's file

Made in place in the current file (newest key in the intake log), Changelog `2043:4304` entry "2026-11-03 (14) · feedback round 3" (appended to text `2043:4306`). Node ids kept; one new board in a free slot of B4. Every board below was checked with a screenshot after the edit. Copy: `docs/design/copy-v5.md`. Rulings 1–7 of feedback round 3 (ADR in `docs/decisions.md`).

| Node | Board | Edit | Ruling |
|---|---|---|---|
| `2013:408`, `2027:3254` | Choose a pattern · Sky / · Web · Sky | **Retired.** Ink note frames `6005:4658` / `6005:4661` ("RETIRED · FEEDBACK ROUND 3 …", eyebrow + bodyS on `color/ink`, white text) placed absolutely at the top of each board; nothing deleted. | 3 |
| `6004:4576`, `6004:4689` | Adjust the area · Sky / · Web · Sky | The frame starts at the **whole photo**: Area frame `6004:4678` / `6004:4780` resized so the ink edge `6004:4680` / `6004:4782` lies on the Photo card's bounds and the four handles (`6004:4681`…`4687`, `6004:4783`…`4789`) sit on its corners; Photo area `6004:4584` / `6004:4697` no longer clips (the handles overhang 22 px). The photo is the raw photo (no piece selected). Copy unchanged. | 3 |
| `6004:4792` | Listing details · Drafting · Sky | New product picture `6005:4664` (342×220, radius 24, the AI product photo) between the title and the drafting card `6004:4838` (renamed: covers the text fields only); new secondary "Redo" `6005:4665` under the card. Board 844 → 1078 high. | 1, 5 |
| `2030:3804` | Listing · Drafting · Web · Sky | Product picture `2030:3816` filled with the AI product photo (sample sticker `2030:3817` hidden); new secondary "Redo" `6005:4667` under the spinner; status `2030:3821` "Writing a title and price for you…" → "Writing your listing…" (the code's copy since T123). | 1, 5 |
| `4006:4357` | Web product card · Size=Tile (component) | Image `4006:4358` filled with the AI product photo (cover) for stickers too; Art `4006:4359` hidden and renamed "fallback only: bordered sticker preview". Instances with their own art overrides keep them. | 1 |
| `2018:1836` | Shop · Sky › tile "Reading Buddy" | The first sticker tile shows the AI product photo (instance override); the other sample tiles keep their sample art (there is no AI photo of the fern or flower in the file). | 1 |
| `2019:2004` | Product page · Sky › Gallery | Main image `2019:2026` = slide 1, the AI product photo (cover; sample sticker `2019:2027` hidden); Thumbnail 1 `4011:4379` the same; Thumbnail 2 `4011:4384` renamed "slide 2: bordered sticker preview (contain, sticker tone)". | 1 |
| `6006:4657` | **Listing · Print warning · Web · Sky** (new, B4, clone of `2030:3752`, at 4810, 3080 in section `2026:2864`) | AI product photo on top; print line with Icon / alert: "Print check: the colors may look faint"; Error card `6006:4704` with the contrast message; actions row `6006:4711`: "Use anyway" `6006:4712` and "Re-do the cutout" `6006:4714` (Text action). A resolution refusal shows only "Re-do the cutout" and "might print blurry" (annotated in the layer names). | 2 |
| `2043:4304` | Changelog | Entry (14) appended: every id and copy change above, plus the then-parked "Take a new photo" item (the web built it in T138). | 7 |

Sample picture: the AI product photo is stood in for by the mascot photo already in the file (Thumbnail 3 `4011:4390`, image fills reused by hash), so no new asset was uploaded. A named version ("Designer pass 3") could not be saved through the plugin API: the designer or the user saves it from the version history.

## Round 3 — to mirror in Figma (2026-11-03, T137)
What the apps do since round 3 that the boards above still do not show; the code is the reference until the designer draws them.
1. **Your cutout strip (iOS `2013:618`, web `2038:4233`):** under the cutout, a strip of "Piece n" buttons (pressed state; web `aria-pressed`) when detection found two or more drawings inside the frame; hidden for one. iOS adds the line "We found %lld drawings in the frame. Tap the one you want." (T136). Restore the strip from the retired Choose a pattern boards (pieces `2013:474` …, `2027:3296` …).
2. **Making your cutout (iOS `4030:4482`, web `2038:4369`):** for the first cut (detection inside the frame) the line is "Looking for your drawing in the frame and cutting it out. This takes a few seconds." (iOS, canonical; the web says "Looking for your drawing in the frame and cutting it out…" since T138) and it shows the searching magnifier (`asset/mascot-magnifier` `6004:4936`) instead of `stickerLoading`; after a change it keeps `stickerLoading`.
3. **Finding (iOS `21:4390`, web `2027:3207`):** copy "Getting your photo ready…" (upload only). Photo · Error (no drawing found) · Web `2027:3226` is no longer reached from the photo (the upload never detects); the "nothing in the frame" message lives on Adjust the area (`create.adjust.notFound`). An Adjust the area · Not found state could be drawn from `6004:4689` with the error card under the photo.
4. **Pictures (ruling 1) on the creator boards not edited here:** iOS Listing details `2014:678` and Tote `4038:4517`, web Listing `2030:3752` and Tote `4038:4662`, Ready `2030:3726` / `4038:4644`, Live `2030:3958` / `4038:4713`, iOS My designs and Design detail (no board): the product picture is the AI product photo (`mockupUrl`), fallback the bordered preview, then the cut.
5. **iOS print warning:** iOS Listing details has no print check line on its board; add "Print check: the colors may look faint" / "might print blurry" under the earn card and a refusal state: contrast → "Use anyway" in the bar, resolution → "Re-do the cutout" (the iOS app shows one of the two, unlike the web card in `6006:4657`).
6. **"Take a new photo" on Adjust the area:** the web shipped it in T138 (secondary action under Use this area / Reset, back to the photo step); the boards (`6004:4689`, `6004:4576`) and the iOS app do not have it yet.
7. Board layout: Adjust the area `6004:4576` / `6004:4689` and Listing details · Drafting `6004:4792` are children of the page `0:1`, not of their sections (`2011:94`, `2026:2864`), since round 2; left as they are (moving boards between sections is against the rules), flagged for the designer.

## Feedback round 4 (2026-11-03, T142): edits in the designer's file

Made in place in the current file (newest key in the intake log), Changelog `2043:4304` entry "2026-11-03 (15) · feedback round 4" (appended to text `2043:4306`). Node ids kept; two new boards in free slots of B1 and B4. Every edited board was checked with a screenshot after the edit (the making animation is a GIF fill and does not render in exported screenshots, as on the older Making boards). Copy: `docs/design/copy-v6.md`. Rulings 1–3 of feedback round 4 (ADR in `docs/decisions.md`). The sample product photo is the mascot product photo already used for the tile (fills reused by hash from Thumbnail 3 `4011:4390`: the sky layer plus the mascot, FIT), so no asset was uploaded.

| Node | Board | Edit | Ruling |
|---|---|---|---|
| `2012:387`, `2027:3138` | Change it · Sky / · Web · Sky | Art preview `4022:4479` / `4023:4516` shows the **AI product photo** (nested Art hidden), label "Your art" → "Your sticker"; new text action **"Fix the cutout"** `6007:4698` (iOS) / `6007:4702` (web) under the change panel. | 2 |
| `6007:4724` | **Change it · Making your sticker · Sky** (new, B1, clone of `2012:387`, at 940, 3080 in section `2011:94`) | Making state: picture area `6007:4731` = `asset/sticker-loading` with the chip "Making your sticker…"; Action row dimmed (0.4); hint `6007:4772` "Your sticker is being made" under it; Fix the cutout `6007:4741` dimmed. | 2 |
| `6007:4777` | **Change it · Making your sticker · Web · Sky** (new, B4, clone of `2027:3138`, at 2230, 4580 in section `2026:2864`) | Same: picture area `6007:4784`; "Make the change" and "Looks good as is" dimmed (`aria-disabled`); hint `6007:4814`; Fix the cutout `6007:4793` hidden (the web hides it while the product is made). | 2 |
| `2012:276`, `2027:3042`, `2038:4035` | Changing your art · Sky / · Web · Sky / Change it · Changing · Web · Sky | Art preview `4022:4455` / `4023:4485` / `4023:4523` = the product photo, label "Your sticker"; status `2012:301` / `2027:3056` / `2038:4054` → "Changing your art…" (layer names list the three lines in turn: "Changing your art…" → "Cutting it out…" → "Making your sticker…"); `2038:4059` → "This takes about a minute. Tag is working on it.", its spinner `2038:4056` hidden. | 2 |
| `2012:344`, `2027:3091` | Change it · Before and after · Sky / · Web · Sky | Before / After `4022:4463` + `4022:4470` / `4023:4500` + `4023:4507` = **two product photos** (labels kept); subtitle "Your sticker, before and after" `6007:4696` / `6007:4697`; text action **"Fix the cutout"** `6007:4700` / `6007:4704` after "Back to my original". | 2 |
| `21:4390`, `2027:3207` | Finding drawings · Cloud studio / Photo · Finding your drawing · Web · Sky | **Retired.** Ink note frames `6007:4706` / `6007:4709` (round 3 note style): Adjust the area opens on the device at once, the crop is uploaded after Use this area. | 1 |
| `2014:733`, `4038:4494`, `4031:4378`, `4038:4628` | Making your sticker / tote bag (iOS, web) | **Retired.** Notes `6007:4712`, `6007:4715`, `6007:4718`, `6007:4721`: the product is made on Change it's making state. | 2 |
| `2043:4304` | Changelog | Entry (15) appended: every id and copy change above. | — |

Not saved: a named version in the file's history (not possible through the plugin API; the designer or the founder saves it).

## Round 4 — to mirror in Figma (2026-11-03, T142)
What the apps do since round 4 that the boards still do not show; the code is the reference until the designer draws them.
1. **Adjust the area on the local photo** (iOS `6004:4576`, web `6004:4689`): the board's photo is the photo on the device, nothing is uploaded until "Use this area"; add **"Take a new photo"**: on iOS a **text link under the pinned bar** (PM ruling; the T141 branch has a third secondary pill, changed in the iOS fix round), on the web the secondary action T138 added.
2. **Your cutout without the frame outline** (iOS `2013:618`, web `2038:4233` and Fix the edges `2038:4092`): the picture is the crop filling the stage; marks on it; the dashed frame from round 2b is gone. On a saved design (Design detail › Re-do the cutout, no board) the screen adds "Take a new photo".
3. **Making your cutout** (iOS `4030:4482`, web `2038:4369`): the first cut only (the change result is cut inside Changing); the magnifier, as listed in round 3 item 2.
4. **Photo step on the web** (`2027:3184`): "Opening your photo…" while the file is read, and the reload notice card "Your photo was not kept when the page reloaded. Take or choose it again."
5. **Tote variants** of the new making board and of Change it / Before and after ("Making your tote bag…", "Your tote bag is being made", "Your tote bag, before and after", label "Your tote bag").
6. **Web Change it label:** the board says "Your sticker" (ruling); the web app still shows "Your art" (shown in capitals) (follow-up in `docs/design/copy-v6.md`).
7. Ready / Listing boards are reached from Change it's "Looks good as is" with the product already made (no flow arrow from Making product any more).

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
| 2026-11-02 | the user's files from the designer (T120, feedback round 2; no Figma read) | — | Assets page frames `asset/sticker-loading` `4036:4404`, `asset/mascot-magnifier` `6004:4936`, `asset/mascot-card` `6004:4937`, `asset/mascot-shop` `6004:4938` ("Feedback round 2" above) | Four assets replaced or added (R7). `sticker-loading.gif` replaced by the "creating cutout" GIF (320×320, 121 frames, 5.04 s, 4.2 MB) and `mascot-magnifier.gif` by the "finding image" GIF (320×320, 125 frames, 5.21 s, 5.6 MB): **GIFs are 1x (320 px); shown at 342 px** (about 1.07x upscaled). `pnpm assets` writes `sticker-loading.mp4` (95 KB) and `mascot-magnifier.mp4` (101 KB), byte-identical on rerun. New `mascot-card.png` (`mascotCard`, the card mascot holding up a drawing, standing on a fuzzy cactus against a flat blue sky; the brief called it "on clouds") and `mascot-shop.png` (`mascotShop`, the pointing mascot): both are **RGB without alpha**, photographic with their own sky / cloud background, so they are shown as full-bleed cards (radius as the photo card, `object-fit: cover`), never on a coloured surface. Fix round 0 (PM ruling, a documented deviation from R7's "2x sources"): the uploads (2384×2032, 7.5 MB; 2048×2048, 5.4 MB) stay outside the repo; the repo keeps sharp resizes to a longer side of 1200 px (2x for cards of at most 600 pt), palette PNG, compression 9: **`mascot-card.png` 1200×1023, 667,530 bytes** (palette quality 80) and **`mascot-shop.png` 1200×1200, 508,781 bytes** (quality 90). `pnpm assets` derives the iOS 1x (600×512, 526,827 bytes; 600×600, 676,986 bytes: the script writes the 1x as full-colour PNG, so it can be larger than the palette 2x) and copies the 1200 px files to `web/public/assets/` (served through `next/image`). |
| 2026-11-03 | the designer's file, key `WVJuvNJnfcNaAqOW6jWeWi`, edited in place (T137, feedback round 3) | `0:1` | Changelog `2043:4304` entry 14; boards in "Feedback round 3" above; new board `6006:4657` | No tokens or assets changed. Choose a pattern boards retired with notes; Adjust the area frame at the whole photo; Listing drafting picture + Redo; AI product photo on the tile component, the first shop tile and gallery slide 1; new print warning board. |
| 2026-11-03 | the designer's file, key `WVJuvNJnfcNaAqOW6jWeWi`, edited in place (T142, feedback round 4) | `0:1` | Changelog `2043:4304` entry 15; boards in "Feedback round 4" above; new boards `6007:4724`, `6007:4777` | No tokens or assets changed. Change it, Changing and Before and after show the AI product photo; Change it making state boards; Fix the cutout links; Finding and Making product boards retired with notes. |

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
