# Handoff · web

## Owns
`web/app/**` except `web/app/api/**`, `web/app/media/**`, `web/app/tokens.css`; `web/components/**`; `web/messages/en.json`; `web/proxy.ts`; `web/public/**` (except `public/ref/`); `web/lib/db/queries.contract.ts` and `web/lib/db/queries.fixtures.ts` (web-side contract and example data); `docs/design/screens.md`.

## Current task
T106 · site pages and admin on the B3 / B5 web boards (done on `feat/web-T106`).

## Interface exposed to others
- **Data contract** `web/lib/db/queries.contract.ts`: the backend's `queries.ts` should export these functions with these signatures: `listShopProducts(filter)`, `getProductDetail(id)`, `listPublicCreators()`, `getFeaturedCreator()`, `getCreatorProfile(slug)`, `getCreatorCaptions(creatorId)`, `getStoryTag(token)`, `getOrderConfirmation(orderId)`, `listAdminOrders()`, `getArtworkTrace(artworkId)` (returns `{ artwork, variants, candidates, calls }`; `variants` are sibling text2image variants plus refine ancestors with `chosen`, `candidates` are SAM candidates), `createOrder(productId, input, {task})`, `recordTap(token, {task})`, `createBuyerMessage(token, body, {task})`, `updateOrderStatus(orderId, status, {task})`. To bind, replace each stub body with a re-export and keep the `connection()` call on reads.
- **Creator cookie** `ms_creator` (httpOnly) holds the bearer token from `POST /api/v1/auth/code`; set by `POST /create/code/session`.
- **Forwarder** `/create/bff/<path>` → `/api/v1/<path>` with `Authorization: Bearer`. Blob `handleUploadUrl` is `/create/bff/uploads`.
- **Upload pathnames** from the web: `creators/<creatorId>/photo/<uuid>.jpg` (re-encoded in the browser, EXIF dropped), `creators/<creatorId>/story-video/<uuid>.<ext>` and its soundtrack `creators/<creatorId>/audio/<uuid>.wav`; `access: "public"` until the private store is linked.
- **Captions** for `<track>`: `GET /captions/<creatorId>` returns `creators.storyVideoVtt`.
- `NEXT_PUBLIC_SITE_URL` is used for story-tag URLs and QR codes (falls back to the request host).

- **Admin auth** helper `web/lib/admin-auth.ts#checkAdminAuth(header)`: use it inside any admin Server Function or route.

## Integration (T040, 2026-10-29)
- `queries.contract.ts` is bound to the backend (maps rows from `lib/db/queries.ts`; writes go through `lib/pipeline/public`). `WEB_FIXTURES` and the example fixtures are gone; pages unchanged. `AdminOrder` gained `messages`.
- `/create/code/session` signs in in-process; `/create/bff/*` still forwards over HTTP.
- Open: story videos from the web flow carry no soundtrack WAV, so captions are not made on Vercel.

## Open questions for other roles
- **Backend: build is blocked on this branch** by `web/lib/ai/registry.ts` importing `./fixtures` and `./meta`, which only exist once T010 lands. Web was verified with temporary stand-ins that were not committed.
- **Backend: `/media/{pathname}` from public pages.** Story videos are private pathnames; the web requests `/media/<path>?tag=<token>` on story-tag pages and `/media/<path>` elsewhere (shop, profiles, and admin print links behind basic auth). Please allow public read of creator story videos, or tell us the token scheme.
- **Backend: transcribe input.** Chrome records `audio/webm` (Safari `audio/mp4`). Please accept webm in `/transcribe` or transcode.
- **Backend: `cutPathSvg` coordinate space.** The die-cut preview assumes a `0 0 100 100` viewBox; if the path is in pixels, expose the image width/height (or a normalized path).
- **Backend: `/creators/me` `split`** is used for "You earn per sale"; defaults to 50% if missing.

## Last updated
2026-10-31 (T106)

## T050 fix wave (2026-10-29)
- `/t/[token]`: story video → thank-you (`components/storytag/ThankYou.tsx`; media via `/media/<path>?tag=`, captions via `/captions/tag/<token>`) → thread (`Thread.tsx`) → note form (refreshes the thread; moderation rejections shown) → about → more. Empty states for each.
- Creator screens: `components/create/errors.tsx` (`describeError`, `ErrorNotice`) shows the API's reason; 409 keeps the form, 422 offers Retake, 504 offers Try again.
- Story video: soundtrack WAV extracted in the browser (`blobToWav`, 180 s cap) and sent as `audioUrl`; then the Glimmer draft with Use / Edit / Skip (`PUT /creators/me { storyText, bioShort }` or `{ dismissStoryDraft: true }`).
- BFF `maxDuration = 300`; `(site)/error.tsx` added.
- Open: run the story-video flow on a real iPhone (Safari `decodeAudioData` on a .mov), and the whole creator flow on Vercel after the env sync.

## T070 studio-issued creator codes (2026-10-29)
- `/admin` has a Creators section below orders (`components/admin/CreatorsSection.tsx` → client `CreatorsPanel.tsx`): table (name, slug, Example chip, studio, published count, In the shop / Hidden chip with Hide/Show button, New code button) and an Add creator form (display name required, studio, "Mention disability" off by default, "Hidden from the public shop (testing)"). Server Functions `addCreator`, `rotateCreatorCode`, `setCreatorHidden` in `app/admin/actions.ts` re-check basic auth; task `T070`.
- After add or New code, a card in an `aria-live="polite"` region shows the code large with Copy, a QR of `${origin}/create/code?c=<CODE>`, the link with Copy, and `the3rdeye://code/<CODE>`. The code lives only in the action response and component state; "Done, hide the code" or a reload removes it.
- `/create/code?c=CODE` pre-fills the field and shows the hint "We filled in your code. Tap Sign in." (`create.code.prefilled`); no auto-submit.
- New code is two steps (New code → "Yes, make a new code" / Cancel); example creators also show that re-running the seed restores their demo code. After "Done, hide the code" focus moves to the Creators heading. The live region holds only the message and the code.
- Hidden creators: `/c/<slug>` is not found, the product page hides "See more work by …" (`PublicCreator.hidden`), they are absent from the shop grids, `/artists`, Meet the artist and "more from this studio"; `/p/<id>` and `/t/<token>` still work.
- For iOS: the app registers `the3rdeye://`; `the3rdeye://code/<CODE>` opens the code screen pre-filled (no auto-submit).


## T084 Adjust cutout on Select (2026-10-30)
- `/create/select` matches the iOS Adjust cutout screen: checkboxes to combine pieces, "Add area / Remove area / Draw a box" on the photo, per-piece buttons "Box around this piece" / "Add the area around this piece", "Clear marks", "Apply cutout" (a save, shown on a checkerboard), "Use this". Calls: `GET /artworks/{id}`, `POST /artworks/{id}/select`, `POST /artworks/{id}/cleanup`, `POST /products`.
- Pure logic in `components/create/cutout.ts` (tested in `test/cutout.test.ts`); draft gains `imageSize` and `cutoutNotice` (shown on Ready).
- Not on the web: a designs list with delete / continue (the web flow has none).
- Fix round 1: navigation and controls locked while a request runs; focus to the result heading after Apply; photo URL refetched after 9 minutes or on load error. The web "unpublished" notice says "Open the product page to fix it" (iOS keeps "Open My designs"). Known limit: a "Remove area" mark is refused by bbox (the server removes the connected piece it lands on), so a mark in empty space inside a lone piece's bbox is refused although the server would keep the piece.
- Follow-ups: tappable chips on the photo; a zero-pieces box path (needs `artworkId` on the web `ApiError`); keep the applied cut in the draft so a reload after Apply does not fall back to `select`; disabled-opacity and photo max-height tokens.

## T090 fix wave (2026-10-30)
- Select: the cut saved by Apply cutout lives in the draft (`appliedCutout`) and comes back with its choice after a reload; zero-pieces path (Photo shows "Draw a box around your drawing" after a 422 `no_drawing_found`; Select opens with no pieces in box mode, "Use the whole photo" for keyboards, sends `cleanup { box }`); numbered chips on the photo toggle the piece; "Your cutout is saved" read once (heading only); "Pick a piece…" spoken when marks become unsendable; the unpublished notice no longer points to a product page (see decisions).
- `components/create/api.ts` `ApiError` keeps the error's extra fields (`details`, `artworkId`).
- Sign-in: admin card link `/create/code#c=<CODE>`, QR `/create/code?c=<CODE>`; `lib/code-links.ts`; the code page (`CodeField`) fills from either and strips the code from the address bar.
- Note forms show `moderation_unavailable` (story tag: try again in a minute; checkout: remove the note and try again).
- Tokens `--opacity-disabled`, `--size-photo-max-height` replace the raw values in `Create.module.css`.
- Still open: a real place on the web to fix an unpublished product (no designs page); the Select changes were not run against the live backend (they write to the shared database).
- T090 fix round 1: chips let the pointer through in box mode; unpublished notice points to My designs in the iPhone app; web `ApiError.extra` (was `details`); Swift token is `Tokens.Size.photoMaxHeightShare`. Deferred: a component or stubbed-BFF browser test of Select (zero pieces, rescue button, chip toggle, single announcement), before v0.6.

## T102 Sky primitives (2026-10-31)
Every page now draws with the Sky look (Inter, white page, ink, accent green); screen layouts are still the old ones until the per-screen tasks.
- **Primitives (`web/components/ui/`)**
  - `Button`: `variant` `primary` (56 px ink pill, label left, 48 px arrow circle right; `arrow` defaults on), `white` (same on a photo: white pill, ink circle), `secondary` (50 px white pill, hairline border), `ghost` (underlined text, 44 px target), `danger`. `ButtonFace` unchanged.
  - `Card`: `tone` `cream` / `white` = white surface, `lime` = accent with accent border and deep-green text, `ink`; 28 px radius, 1.5 px border, no shadow.
  - `ChoiceCard` / `ChoiceGroup`: `layout="grid"` = product cards (28 px radius, picture on top, check radio top right); `stack` = option rows (18 px radius, 44 px icon circle, radio at the end). Selected = accent fill + accent border + deep-green radio with a white check. `badge` (string) shows as an eyebrow above the title.
  - `Display`: Inter Medium, sizes `xl` 48, `l` 32 → 40 from 48rem, `m` 21; `tone="onPhoto"` = white Bold. `tilt` is ignored.
  - `Eyebrow` (new file; `Text` re-exports it): caps label, optional `tone` `muted` | `accent`.
  - `Field`: `surface-alt` control with a `textMuted` border (3:1 input boundary), 13 px label; `Switch` track deep green when on.
  - `IconButton`: 48 px outlined circle; `size="s"` = 44 px (the Back control).
  - `Loading`: label + 24 px spinner; `variant="sky"` adds the sky card with the animated magnifier mascot (still front pose under reduced motion). `Status` unchanged.
  - `Mascot` (new): `pose` `book` | `front` | `magnifier`, `decorative`, `eager`; `<img>` from `ASSETS`, alt from `messages.mascot.<pose>`.
  - `LogoMark` (new): the 40 × 35 eye mark; decorative unless `label` is passed.
  - `Sheet`: plain white section (no scallop). `StepPill`: visually hidden "Step n of 3". `Scallop`, `Starburst`: render nothing (exports kept).
  - `Icons`: stroke 1.8; new `ChevronLeftIcon`, `ChevronRightIcon`.
- **Wrappers:** `components/Tag.tsx` is a thin wrapper over `Mascot` (every pose → `book` until larger sources exist; `eager` passes through). `site/Wordmark` = `LogoMark` + `BRAND.name` in Inter Semi Bold (link name "{brand} home").
- **CreateScreen:** logo mark top-left, or a 44 px Back chevron in its place when `back` is set; 48 px title; muted lead; body; bottom action bar sticky at the bottom (`footer` prop). `step` is announced only. `create/glyphs.tsx` `ProductGlyph` now shows `mascot-book.png` / `tote.png`.
- **Adding an asset:** put the file in `design/assets/`, add an entry under `assets` in `design/tokens.json` (name, file, node id), run `pnpm assets` (copies to `web/public/assets/` and the iOS catalog) and `pnpm tokens` (adds `ASSETS.<name>` to `web/lib/assets.ts`). Components import `ASSETS` from `@/lib/assets` and render a plain `<img>` (or `Mascot` / `LogoMark`); never hard-code `/assets/...` paths.
- **Open for per-screen tasks:** Welcome sky photo and white pill (`Button variant="white"`, `Display tone="onPhoto"`); shop hero (tilted card and copy, T106); dark footer and mobile Menu drawer (T106); Drawing/Photo finding screens should pass `variant="sky"` to `Loading`; admin tables still use the old layout.

## T105 Creator flow on the B4 boards (2026-10-31)
- **Frame (`create/CreateScreen`)**: logo mark or 44 px Back (only screens with a back action: Code, Product, Method, Speak, Result, Photo, Select when not busy, Listing); 48 px title (`align="center"` on Ready and Live); muted lead; body with 20 px gaps and 24 px gutters; `footer` goes into `create/PinnedBar` (sticky white bar; its top line shows only while content is under it). Step is announced only.
- **Cards (`create/cards.tsx`)**: `InfoCard` (eyebrow + text; tones white / green for the question / alt for the story), `ErrorCard` (warning icon, message, optional text actions; `role=alert` unless `live` says otherwise), `NoticeCard`. `errors#ErrorNotice` now renders an `ErrorCard` with "Try again" / "Retake the photo" as text actions inside it.
- **Pure views for tests**: `screens/SelectView.tsx` (every Select state from props) and `screens/ListingView.tsx` (`LISTING_FORM`: the bar's submit button submits the form by id). `Select.tsx` and `Listing.tsx` keep all logic and API calls (T090 behaviour and the cleanup contract unchanged).
- **Forms submitted from the bar**: the code sign-in (still a plain form POST, works without JS), Speak's typed idea, Listing.
- **Assets**: `ASSETS.mascotMagnifierVideo` (MP4). `ui/Loading variant="sky"` plays it, `ui/SkyCard` is the static sky card (Photo idle, Live, Drawing error). Never reference the GIF from a page.
- **Primitive additions**: `Field hintPosition="below"`, `LogoMark tone="white"`, `ButtonFace arrow`, `Loading inline` is left-aligned, icons `Plus`, `Minus`, `Box`, `Warning`, `Close`, `Image`.
- **Checking states without the backend**: seed `sessionStorage["ms:create"]` with a draft and stub `window.fetch` for `/create/bff/*` in a navigation init script (chrome-devtools `navigate_page` `initScript`); the Blob client upload can be stubbed the same way (`/create/bff/uploads` → a client token, `vercel.com/api/blob` → a blob JSON).

## T106 Site pages and admin on the B3 / B5 boards (2026-10-31)
- **Layout:** `--layout-max` is the 1280 content column; `Container` adds the gutters (24 px on phones, 80 px from 64rem), so a 1440 page has 80 px sides and wider screens centre the column.
- **Site frame:** `site/SiteNav` (Web nav: links from 48rem, Menu below) + `site/NavMenu` (Nav drawer as a modal `<dialog>`: the page is inert, Esc closes, Tab wraps, focus to the first link and back to Menu) + `site/SiteFooter` (ink). The story tag (`storytag/Shell`) and `app/not-found.tsx` use the same nav and footer; the skip link stays in `app/layout.tsx`.
- **Primitive additions:** `Display size="web"` (page titles: 48 px, 72 px from 64rem); `Chip` re-skinned to the board Chip (`lime` = Green, `cream` = Neutral surfaceAlt, no border); `site/Avatar` initials (two letters) and sizes `l` 56 / `xl` 80 / `xxl` 120; `site/CopyButton` shows the copied label; `site/StoryVideo` frame with the poster play circle (`site/VideoPoster`, decorative, native controls stay).
- **Product card** is one component for Large and Small: a container query under 12.5rem stacks the chips; the title clamps to 2 lines. Grids: `shop/Collection#ProductGrid` (2 per row on phones, 4 from 64rem).
- **Admin:** header `admin.header` from `lib/brand`; `admin/CodeCard` is the one-time code card (live region always mounted, message + code only); story tag cell shows the path (`/t/<token>`) and copies the full URL.
- **Assets:** `ASSETS.heroSky` (`design/assets/hero-sky.png`, node `2018:1805`, the board's raw fill, 816 × 1456).
