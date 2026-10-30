# API contract · `/api/v1`

Base: `${NEXT_PUBLIC_SITE_URL}/api/v1`. JSON in and out unless noted. Errors: `{ "error": { "code": string, "message": string } }` with 4xx/5xx.
Auth: `Authorization: Bearer <token>` from `POST /auth/code`. Dev-mode only (documented as non-production).
Media never goes through these routes except short audio (≤ 4 MB). Images/video go to Blob through the client-upload flow and are referenced by URL/pathname.

## Auth
`POST /auth/code` `{ code }` → `{ token, creator: Creator }`
`GET /creators/me` → `Creator` · `PUT /creators/me` `{ displayName?, studioName?, bioShort?, storyText?, accessPrefs?, mentionDisability? }` → `Creator`

## Uploads (Vercel Blob client upload)
`POST /uploads` body per `@vercel/blob/client` `handleUpload` protocol. Allowed: `image/*`, `video/mp4`, `video/quicktime`, `audio/*`. Pathnames: `creators/<creatorId>/<kind>/<uuid>.<ext>`. Response per protocol.

## Voice
`POST /transcribe` multipart `file` (m4a/mp3/wav, ≤ 60 s) or JSON `{ audioUrl }` → `{ text, language?, segments? }`

## Create
`POST /prompts/shape` `{ transcript, answers?: string[], product: "sticker"|"tote" }` → `{ prompt, style_notes, clarifying_question: string|null, spoken_confirmation }`
`POST /artworks` one of:
- `{ source: "text2image", prompt, transcript?, product, n?: 1..4 }` → `{ artworks: ArtworkVariant[] }` (one row per variant; each has `altText`, `spokenDescription`, `differencesFromPrompt`, `genResponseId`)
- `{ source: "photo"|"canvas", imageUrl, product }` → `{ artwork: Artwork, candidates: Candidate[], imageSize: { w, h } }` (SAM finds every drawing or object; `cleanedUrl` null until a candidate is chosen when `candidates.length > 1`; `imageSize` = pixel size of the stored original, the coordinate space of `bbox`, `points` and `box`)
`POST /artworks/{id}/select` `{ candidateId }` → `Artwork` (cleaned PNG + cut path)
`POST /artworks/{id}/refine` `{ instruction }` → `{ artwork: ArtworkVariant }` (new row, `parentArtworkId` set)
`POST /artworks/{id}/cleanup` `{ candidateIds?: string[], points?: { x, y, label: "positive"|"negative" }[], box?: [x0,y0,x1,y1] }` (at least one) → `Artwork` (see T080 clarifications)
`GET /artworks` → `{ artworks: ArtworkListItem[] }` (mine, newest first; each carries `products`)
`GET /artworks/{id}` → `{ artwork: Artwork, candidates: Candidate[], imageSize: { w, h } | null, originalUrl: string | null }` (`originalUrl` presigned, valid 10 min)
`DELETE /artworks/{id}` → `{ id, deleted: true, archivedProductIds: string[] }`

## Products and listings
`POST /products` `{ artworkId, type: "sticker"|"tote" }` → `Product` (sticker: `printPngUrl`, `printSvgUrl`, `mockupUrl`; tote: `mockupUrl`) — may take up to 60 s
`POST /listings/{productId}/run` → `{ listing: ListingDraft, trace: AgentStep[] }`
`POST /listings/{productId}/approve` `{ approvedVia: "voice"|"tap", edits?: { title?, description?, priceCents? } }` → `{ product: Product, listing: Listing, storyVideoNeeded: boolean }`

## Story video (per creator, once)
`POST /creators/me/story-video` `{ videoUrl /* blob pathname */, mentionDisability?: boolean }` → `Creator` (captions generated; `storyVideoVtt` set)
`GET /creators/me/story-prompts` → `{ prompts: string[3] }`

## Orders, thank-yous, messages
`GET /orders?since=<iso>` → `{ orders: OrderSummary[], unread: number }` (poll every 10 s)
`GET /orders/{id}` → `{ order: Order, thankYou: ThankYou|null, messages: Message[] }`
`POST /orders/{id}/thank-you` `{ text?, imageUrl?, videoUrl?, transcript?, draft?: boolean }` → `draft` → `{ draftText, provider }` else `ThankYou`
`GET /orders/{id}/messages` → `{ messages }` · `POST /orders/{id}/messages` `{ body }` → `Message`
`POST /story/draft` `{ transcript, mentionDisability }` → `{ headline, bio_short, story_text, provider }`

## Public (web, no auth; server actions on the pages, listed for completeness)
`placeOrder(productId, { buyerName, buyerEmail?, shipNote? })` → `{ orderId, token }` · `tap(token)` increments `tapCount` · `sendReply(token, body)`

## Types (JSON field names)
```
Creator { id, slug, displayName, studioName, avatarUrl, bioShort, storyText, storyVideoUrl, storyVideoVtt, mentionDisability, accessPrefs, split, isExample }
Artwork { id, creatorId, source, transcript, shapedPrompt, originalUrl, cleanedUrl, maskUrl, cutPathSvg, altText, spokenDescription, differencesFromPrompt, genResponseId, parentArtworkId, status, createdAt }
ArtworkVariant = Artwork & { previewUrl }
ArtworkListItem = Artwork & { products: ArtworkProduct[] }
ArtworkProduct { id, type: "sticker"|"tote", status: "draft"|"published"|"archived", title: string|null }
ImageSize { w, h } /* px of the stored original */
CleanupPoint { x, y, label: "positive"|"negative" } /* px in original */
Candidate { id, bbox: [x0,y0,x1,y1] /* px in original */, score, thumbUrl }
Product { id, artworkId, creatorId, type, mockupUrl, printPngUrl, printSvgUrl, priceCents, status }
ListingDraft { title, description, tags[], price_cents, print_ok, notes }
Listing { productId, title, description, tags, priceSuggestionCents, approvedAt, approvedVia, madeByVoice }
AgentStep { step, tool?, args?, result?, text? }
OrderSummary { id, productId, productTitle, mockupUrl, buyerName, amountCents, creatorShareCents, status, createdAt, hasThankYou, unreadMessages }
Order = OrderSummary & { shipNote, token }
ThankYou { id, orderId, text, imageUrl, videoUrl, createdAt }
Message { id, orderId, direction, body, createdAt, readAt }
```
Private blob pathnames (`storyVideoUrl`, `printPngUrl`, `printSvgUrl`, `videoUrl`) are served through `GET /media/{pathname}` (auth or token-scoped) which streams or redirects to a presigned URL. (T050 note: only `printPngUrl` and `printSvgUrl` are in the private store today; story and thank-you videos are client uploads in the public store, still referenced by pathname and served through `/media`. See docs/architecture.md "Storage".)

## Clarifications (T010 backend, 2026-10-28)
Additive only; no existing field or path changed.
1. **Media access (`GET /media/{pathname}`).** Public, no auth: a creator's current story video, and these path kinds: `creators/<id>/{mockups|cleaned|thumbs|avatar|story-video}/...` (mockups, cleaned art and thumbs are also returned as direct public Blob URLs). `?tag=<nfc token>` (alias `?t=`): only that order's thank-you video and image (never print files, originals or masks). Creator auth (Bearer or `ms_creator` cookie): the creator's own files. Admin basic auth: everything (print PNG, die-cut SVG). Private originals, masks and print files live in the private Blob store. The route answers `302` to a short-lived URL (range requests work for video).
2. **Uploads.** Client uploads (`POST /uploads`) land in the public Blob store under `creators/<creatorId>/<kind>/<uuid>.<ext>`. Use kind `story-video` for story videos, `thank-you` for thank-you media, `photo` / `canvas` for artwork sources, `audio` for recordings. The token request needs creator auth (Bearer or cookie).
3. **Audio format.** Muse Voice Transcribe accepts **WAV only** (verified live: `audioEncoding: "WAV"` is the only accepted value; m4a/mp3/webm/ogg are rejected). `POST /transcribe` accepts any format, passes WAV through, and converts others with ffmpeg when the server has it (local dev). **Vercel has no ffmpeg, so in production send WAV** (16-bit PCM, mono, 16 kHz is ideal): web decodes the MediaRecorder blob with `AudioContext.decodeAudioData` and encodes WAV; iOS records Linear PCM WAV. Non-WAV without ffmpeg → `415 unsupported_audio`.
4. **Captions for videos.** `POST /creators/me/story-video` and `POST /orders/{id}/thank-you` accept an optional `audioUrl` (Blob pathname of a WAV of the video's soundtrack); captions are made from it. Without it the server tries the video itself (works only where ffmpeg exists); when captioning fails the video is still saved and `storyVideoVtt` stays null. Cue times are estimated (the API returns no timestamps) by spreading the measured duration over sentence-sized cues.
5. **`cutPathSvg`** is an SVG path in a `0 0 100 100` viewBox: the cleaned PNG fitted `contain` and centered in that square. The white border extends a few units past 0–100; render with `overflow: visible`. Pixel-exact die lines are in the private print SVG.
6. **`Creator.split`** (`{ creator_bps, org_bps, production_bps }`) is included in `/auth/code`, `GET/PUT /creators/me` and `/creators/me/story-video`. Creator share of a price = `floor(price * creator_bps / 10000)`.
7. **Public actions over HTTP** (same as the lib functions in `web/lib/pipeline/public.ts`, for clients that prefer fetch): `POST /public/orders { productId, buyerName, buyerEmail?, shipNote? } → { orderId, token }`; `POST /public/tap { token } → { tapCount }`; `POST /public/reply { token, body } → Message`.
8. **Sign-in cookie.** `POST /auth/code` also sets the httpOnly `ms_creator` cookie; every creator route accepts it in place of the Bearer header.
9. **Client-supplied file references** (`imageUrl`, `videoUrl`, `audioUrl` on `/artworks`, `/transcribe`, `/creators/me/story-video`, `/orders/{id}/thank-you`) must be the caller's own uploads: a pathname `creators/<yourId>/<kind>/<file>` or an `https://<public-store>.public.blob.vercel-storage.com/creators/<yourId>/...` URL. Anything else → `403 forbidden_path | forbidden_url`. `/transcribe { audioUrl }` is capped at 4 MB (`413 too_large`).
10. **Errors may carry extra fields** inside `error`, e.g. `{ "error": { "code": "deadline_exceeded", "message": "...", "artworkId": "...", "artworkIds": [...] } }`.
    - Long routes (`/artworks*`, `/products`, `/listings/*`) answer within 270 s: on timeout `504 deadline_exceeded` with the artwork id(s) created so far; those rows stay `status: "draft"` with `lastError` set (new nullable `Artwork.lastError`). Other pipeline failures also set `lastError` and include `artworkId`.
    - `POST /artworks` photo/canvas with no drawing found → `422 no_drawing_found` (with `artworkId` and a hint in `message`).
    - `POST /listings/{id}/approve` → `409 print_check_failed` when the print check failed, `409 moderation_failed` when the text fails moderation. Edited title/description are moderated again before publishing, so edits cannot bypass the check; `409 listing_missing` before the agent ran.
11. **`product` on `POST /artworks`** is used: text prompts get the product's print style appended when they were not shaped for it; it is recorded on the artwork (`shapingTrace.product`).

## Clarifications (T050 fix wave, 2026-10-29)
Additive; no existing field or path removed.
1. **Video captions need `audioUrl` on Vercel.** `POST /creators/me/story-video` and `POST /orders/{id}/thank-you` caption from `audioUrl` when present (a WAV of the video's soundtrack, uploaded with kind `audio`: `creators/<id>/audio/<uuid>.wav`, 16-bit PCM mono 16 kHz, ≤ 10 MB, about 3 minutes). Without it the server tries the video itself, which works only where ffmpeg exists (local dev). When captioning fails, or the soundtrack is silent, the new video is saved with `storyVideoVtt: null` (thank-you `videoVtt: null`): old captions are never kept for a new video.
   - **Web:** the story-video screen decodes the picked video's audio with `AudioContext.decodeAudioData`, downmixes and resamples to 16 kHz (`lib/audio/wav.ts#blobToWav`), uploads the WAV and sends `audioUrl`. If the browser cannot decode the audio, the video is sent without it.
   - **iOS:** reads the recorded movie's audio track with `AVAssetReader` (output settings: Linear PCM, 16-bit little-endian integer, 1 channel, 16 000 Hz), writes a WAV header around the samples, uploads it as kind `audio` and sends its pathname as `audioUrl` with the video (story video and thank-you video).
2. **Story draft from the video (`Creator.storyDraft`).** After a story video is captioned, the server drafts a story from the transcript (`draftStory`, Muse Glimmer locally, Spark fallback) and stores it on the creator. `GET /creators/me`, `PUT /creators/me` and `POST /creators/me/story-video` return `storyDraft: { headline, bio_short, story_text, provider, mentionDisability, createdAt } | null`. Nothing is published until the creator accepts it with `PUT /creators/me { storyText, bioShort? }` (that also clears `storyDraft`). `POST /story/draft { transcript?, mentionDisability }` drafts from `transcript`, or from the stored video transcript when `transcript` is omitted, stores it as `storyDraft` and returns it. `provider` is `ollama` (Muse Glimmer on the development Mac) or `meta-fallback` (Muse Spark 1.3, always on Vercel).
3. **Talking points** (`GET /creators/me/story-prompts`) use the creator's most recently chosen artwork: the newest `ready` artwork that has a product.
4. **Creator tokens expire.** Tokens are `<creatorId>.<expiresAtUnixSeconds>.<signature>`, valid 30 days, checked on every request (`401 unauthorized` when expired or malformed). `POST /auth/code` issues a fresh token. Older tokens without an expiry are rejected; sign in again.
5. **Login codes** are random 10-character codes generated by the seed (letters and digits without look-alikes). They are not in the repository; see `web/.creator-codes.local` (git-ignored) on the machine that ran the seed.
6. **Upload limits** (`POST /uploads`): images 25 MB, video 200 MB, audio 10 MB (by the pathname kind: `audio` → audio types, `story-video`/`thank-you` video files → video types, otherwise images). SVG is not accepted. A malformed JSON body answers `400 invalid_json`.
7. **Buyer notes are moderated.** `POST /public/reply` and the story-tag form reject unkind or unsafe notes with `422 note_rejected`; ship notes on `POST /public/orders` likewise (`422 note_rejected`, the order is not placed).
8. **Listing agent results are the server's.** `print_ok` = the resolution check and the contrast check, computed by the server (the tools are run server-side when the model skipped them); moderation runs on the final title and description. `ListingDraft.print_ok` and `notes` reflect those results, not the model's claim. Re-running `POST /listings/{id}/run` on a published product does not touch the live listing: the new copy is kept as a pending draft (`listings.draft_copy`) and goes live only through `approve` (which re-checks print and moderation and clears the draft).
9. **Tote print file.** `POST /products` with `type: "tote"` now returns `printPngUrl` (private, 150 dpi, short side ≥ 1500 px, transparent background kept); `printSvgUrl` stays null for totes.
10. **Orders store the production share** (`orders.production_share_cents`), computed with the creator and organization shares at order time.

## Studio-issued creator codes (T070, 2026-10-29)
Additive; no new public route and no change to `POST /auth/code`.
1. **Where codes come from.** The studio (admin, basic auth) adds a creator on `/admin` → Creators → Add creator, or makes a new code for an existing one. Both are Server Functions behind the admin auth check, not public API. There is no self-sign-up. A new code is a random 10-character code (`web/lib/codes.ts`, same alphabet as the seed); it is shown once on `/admin` and never listed again.
2. **Sign-in link.** `/create/code?c=<CODE>` only pre-fills the code field (trimmed, uppercased, ≤ 64 characters); the person still taps Sign in, which posts the code as before. Treat the link like a password. The iOS form of the same link is `makerstory://code/<CODE>` (the app does not register the scheme yet).
3. **Rotating a code** (`/admin` → New code) makes the old code and its link fail with `401 invalid_code`. Tokens already issued (`<id>.<exp>.<sig>`) are not tied to the code and stay valid until they expire (30 days).
4. **Hidden creators** (`creators.hidden`, for testing): left out of shop grids, `/artists`, the featured artist, "more from this studio", and `/c/<slug>` (not found). A direct product link `/p/<id>` still opens and can be bought, `/t/<token>` keeps working for their orders, and they can sign in and use every creator route.

## Clarifications (T080 backend, 2026-10-29): adjust the cut-out, manage designs
Additive except `cleanup`, whose body changed (no client called it before; `phrase` is gone).

1. **Coordinates.** `Candidate.bbox`, cleanup `points` and `box` are pixels of the **stored original**: origin top-left, x to the right, y down, size `imageSize { w, h }` (returned by `POST /artworks` for photo/canvas and by `GET /artworks/{id}`). It is not the size of the photo the client uploaded (the server rotates it by EXIF and may upscale it up to ×2). A box is half-open `[x0, y0, x1, y1)` with `x0 < x1`, `y0 < y1`; values outside the image are clamped. Convert a tap on a view showing the original (aspect-fit) as `x = (tapX - imageLeft) * imageSize.w / shownWidth`, same for y; non-integers are fine (the server floors).
2. **`POST /artworks/{id}/cleanup`** body `{ candidateIds?, points?, box? }`, at least one key (`400 invalid_request` otherwise):
   - `candidateIds`: 1–6 ids from this artwork's `candidates` (`400 invalid_candidate` for any other id). The cut-out is the **union** of those candidates; no model call, a few seconds. One id behaves like `select`. Use it for "combine pieces".
   - `points`: 1–10 `{ x, y, label }`. `label` is `"positive"` (part of the object) or `"negative"` (not part of it); it defaults to `"positive"` when omitted. Without a `box`, at least one point must be positive (`400 invalid_request`).
   - `box`: the whole object (`[x0, y0, x1, y1]`, see 1).
   - `points` and/or `box` are sent to SAM as **one object**; the result is unioned with any `candidateIds`. Negative points shape only the SAM object: they do not trim the `candidateIds` masks. To trim a combined selection, send a `box` around it with positive and negative points and without `candidateIds`.
   - The mask is finished on the server (holes filled, small gaps closed, specks under 0.5 % of the main piece dropped except pieces the creator chose, soft anti-aliased edge) before the cut.
   - Response: `Artwork` with a new `cleanedUrl` (a new URL every time, safe to cache), `cutPathSvg`, `altText`, `spokenDescription`, `status: "ready"`. When nothing is found → `422 no_drawing_found`.
   - When the artwork already has products, their print files and mockups are rebuilt from the new cut-out in the same request (allow up to 120 s); product ids, status, price and listing text do not change. A published product's shop image changes with it.
3. **`GET /artworks/{id}`** (own artwork, else `404 not_found`) → `{ artwork: Artwork, candidates: Candidate[], imageSize: ImageSize | null, originalUrl: string | null }`. `originalUrl` is a presigned URL of the stored original (valid 10 minutes, fetch it directly; do not store it); `imageSize` is its size. Both are null only for rows without an original. Use it for "Re-do the cutout" (show the original, draw the box / points, call `cleanup`) and to resume an artwork whose candidate was never chosen.
4. **`GET /artworks`** items carry `products: ArtworkProduct[]` (newest first; empty when none) for status badges. `title` is the listing title, or null before the listing agent ran.
5. **Tile state** (both clients): `status: "ready"` and `cleanedUrl` set → show the cut-out; `cleanedUrl` null and `lastError` set → failed (offer "Re-do the cutout" or delete); `cleanedUrl` null, no `lastError`, `candidates.length > 1` in `GET /artworks/{id}` → waiting for a choice (open the picker). A tile never needs an endless spinner.
6. **`DELETE /artworks/{id}`** (own artwork, else `404 not_found`) → `{ id, deleted: true, archivedProductIds }`. Soft delete: the artwork leaves `GET /artworks` and `GET /artworks/{id}` answers 404. Its products are set to `status: "archived"` and leave the shop (shop list and product page). Orders already placed keep working: `GET /orders`, `GET /orders/{id}` and the story-tag page `/t/{token}` still render. Not undoable through the API.
7. **Candidates for photos of objects.** A photo now looks for both drawings and physical objects (two SAM phrases, overlapping results merged, anything covering more than 95 % of the frame, such as the paper or the table, dropped, at most 6). `Candidate` is unchanged.
