# Handoff · web

## Owns
`web/app/**` except `web/app/api/**`, `web/app/media/**`, `web/app/tokens.css`; `web/components/**`; `web/messages/en.json`; `web/proxy.ts`; `web/public/**` (except `public/ref/`); `web/lib/db/queries.contract.ts` and `web/lib/db/queries.fixtures.ts` (web-side contract and example data); `docs/design/screens.md`.

## Current task
T020 · public site, admin, and mobile-web creator flow (done on `feat/web-T01x`).

## Interface exposed to others
- **Data contract** `web/lib/db/queries.contract.ts`: the backend's `queries.ts` should export these functions with these signatures: `listShopProducts(filter)`, `getProductDetail(id)`, `listPublicCreators()`, `getFeaturedCreator()`, `getCreatorProfile(slug)`, `getCreatorCaptions(creatorId)`, `getStoryTag(token)`, `getOrderConfirmation(orderId)`, `listAdminOrders()`, `getArtworkTrace(artworkId)` (returns `{ artwork, variants, candidates, calls }`; `variants` are sibling text2image variants plus refine ancestors with `chosen`, `candidates` are SAM candidates), `createOrder(productId, input, {task})`, `recordTap(token, {task})`, `createBuyerMessage(token, body, {task})`, `updateOrderStatus(orderId, status, {task})`. To bind, replace each stub body with a re-export and keep the `connection()` call on reads.
- **Creator cookie** `ms_creator` (httpOnly) holds the bearer token from `POST /api/v1/auth/code`; set by `POST /create/code/session`.
- **Forwarder** `/create/bff/<path>` → `/api/v1/<path>` with `Authorization: Bearer`. Blob `handleUploadUrl` is `/create/bff/uploads`.
- **Upload pathnames** from the web: `creators/<creatorId>/originals/<uuid>.<ext>` and `creators/<creatorId>/story-video/<uuid>.<ext>`; `access: "public"` until the private store is linked.
- **Captions** for `<track>`: `GET /captions/<creatorId>` returns `creators.storyVideoVtt`.
- `NEXT_PUBLIC_SITE_URL` is used for story-tag URLs and QR codes (falls back to the request host).

- **Admin auth** helper `web/lib/admin-auth.ts#checkAdminAuth(header)`: use it inside any admin Server Function or route.

## Open questions for other roles
- **Backend: build is blocked on this branch** by `web/lib/ai/registry.ts` importing `./fixtures` and `./meta`, which only exist once T010 lands. Web was verified with temporary stand-ins that were not committed.
- **Backend: `/media/{pathname}` from public pages.** Story videos are private pathnames; the web requests `/media/<path>?tag=<token>` on story-tag pages and `/media/<path>` elsewhere (shop, profiles, and admin print links behind basic auth). Please allow public read of creator story videos, or tell us the token scheme.
- **Backend: transcribe input.** Chrome records `audio/webm` (Safari `audio/mp4`). Please accept webm in `/transcribe` or transcode.
- **Backend: `cutPathSvg` coordinate space.** The die-cut preview assumes a `0 0 100 100` viewBox; if the path is in pixels, expose the image width/height (or a normalized path).
- **Backend: `/creators/me` `split`** is used for "You earn per sale"; defaults to 50% if missing.

## Last updated
2026-10-28
