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
- `{ source: "photo"|"canvas", imageUrl, product }` → `{ artwork: Artwork, candidates: Candidate[] }` (SAM finds every drawing; `cleanedUrl` null until a candidate is chosen when `candidates.length > 1`)
`POST /artworks/{id}/select` `{ candidateId }` → `Artwork` (cleaned PNG + cut path)
`POST /artworks/{id}/refine` `{ instruction }` → `{ artwork: ArtworkVariant }` (new row, `parentArtworkId` set)
`POST /artworks/{id}/cleanup` `{ points?: {x,y}[], box?, phrase? }` → `Artwork`
`GET /artworks` → `{ artworks: Artwork[] }` (mine, newest first)

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
Private blob pathnames (`storyVideoUrl`, `printPngUrl`, `printSvgUrl`, `videoUrl`) are served through `GET /media/{pathname}` (auth or token-scoped) which streams or redirects to a presigned URL.
