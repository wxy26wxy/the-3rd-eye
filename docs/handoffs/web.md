# Handoff · web

## Owns
`web/app/**` except `web/app/api/**`, `web/app/media/**`, `web/app/tokens.css`; `web/components/**`; `web/messages/en.json`; `web/proxy.ts`; `web/public/**` (except `public/ref/`); `web/lib/db/queries.contract.ts` and `web/lib/db/queries.fixtures.ts` (web-side contract and example data); `docs/design/screens.md`.

## Current task
T020 · public site, admin, and mobile-web creator flow (done on `feat/web-T01x`).

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
2026-10-29

## T050 fix wave (2026-10-29)
- `/t/[token]`: story video → thank-you (`components/storytag/ThankYou.tsx`; media via `/media/<path>?tag=`, captions via `/captions/tag/<token>`) → thread (`Thread.tsx`) → note form (refreshes the thread; moderation rejections shown) → about → more. Empty states for each.
- Creator screens: `components/create/errors.tsx` (`describeError`, `ErrorNotice`) shows the API's reason; 409 keeps the form, 422 offers Retake, 504 offers Try again.
- Story video: soundtrack WAV extracted in the browser (`blobToWav`, 180 s cap) and sent as `audioUrl`; then the Glimmer draft with Use / Edit / Skip (`PUT /creators/me { storyText, bioShort }` or `{ dismissStoryDraft: true }`).
- BFF `maxDuration = 300`; `(site)/error.tsx` added.
- Open: run the story-video flow on a real iPhone (Safari `decodeAudioData` on a .mov), and the whole creator flow on Vercel after the env sync.

## T070 studio-issued creator codes (2026-10-29)
- `/admin` has a Creators section below orders (`components/admin/CreatorsSection.tsx` → client `CreatorsPanel.tsx`): table (name, slug, Example chip, studio, published count, In the shop / Hidden chip with Hide/Show button, New code button) and an Add creator form (display name required, studio, "Mention disability" off by default, "Hidden from the public shop (testing)"). Server Functions `addCreator`, `rotateCreatorCode`, `setCreatorHidden` in `app/admin/actions.ts` re-check basic auth; task `T070`.
- After add or New code, a card in an `aria-live="polite"` region shows the code large with Copy, a QR of `${origin}/create/code?c=<CODE>`, the link with Copy, and `makerstory://code/<CODE>`. The code lives only in the action response and component state; "Done, hide the code" or a reload removes it.
- `/create/code?c=CODE` pre-fills the field and shows the hint "We filled in your code. Tap Sign in." (`create.code.prefilled`); no auto-submit.
- New code is two steps (New code → "Yes, make a new code" / Cancel); example creators also show that re-running the seed restores their demo code. After "Done, hide the code" focus moves to the Creators heading. The live region holds only the message and the code.
- Hidden creators: `/c/<slug>` is not found, the product page hides "See more work by …" (`PublicCreator.hidden`), they are absent from the shop grids, `/artists`, Meet the artist and "more from this studio"; `/p/<id>` and `/t/<token>` still work.
- For iOS: the app does not register `makerstory://` yet; `makerstory://code/<CODE>` should open the code screen pre-filled (no auto-submit).

