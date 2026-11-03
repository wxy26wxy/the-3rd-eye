# Submission materials (draft)

One section per field of the submission form, in form order, ready to paste. Anything in `[FOUNDER: …]` is for the founder to fill or choose before submitting. Facts here come from `README.md`, `docs/architecture.md`, `docs/decisions.md` and `docs/demo_script.md`; if one of those changes, change this file too.

Due: 2026-11-04, 9 PM ET (team target: noon). Track: Startups. Problem statement: "Build for Your World".

---

## Most Viral Track — X post

Optional field. Plain language, the live site, one link placeholder.

**Single post** (271 characters as X counts them, with each of the two links counted as 23):

> Artists with disabilities photograph a sketch, say what to change, and get a die-cut sticker with an NFC tag that plays their story. Built with Meta's SAM 3.1, Muse Image, Muse Spark, Muse Voice Transcribe and Muse Glimmer. https://the-3rd-eye.vercel.app [FOUNDER: video or post link, one URL]

**Thread (4 posts):**

> 1/ Studios that support artists with disabilities can usually sell an original once, locally. Then it's gone. We built The 3rd Eye so one drawing can become stickers and tote bags people buy again and again. https://the-3rd-eye.vercel.app

> 2/ The artist photographs their own sketch. They frame it on the phone and only that part is uploaded; Meta's SAM 3.1 finds the drawing in it. They say "make the book red", Muse Voice Transcribe writes it down, Muse Image edits their piece (not a new picture), and Muse Spark describes the result so VoiceOver can read it.

> 3/ They can change it again or go back to the original. Every version is already shown as a die-cut sticker or a tote, so they compare the products themselves. Each one carries an NFC tag: tap it and the artist tells you about the work, with captions. You can write back.

> 4/ Our entry for the Meta Global AI Developer Hackathon. Checkout is staged in the demo (no payment is taken). The 3-minute video: [FOUNDER: link]

---

## Project Description

The 3rd Eye helps artists with disabilities turn their art into products people want to buy. It answers four problems:

1. **Art that can't sell at scale.**
2. **Talent without income or recognition.**
3. **No connection between buyers and creators.**
4. **People who can't draw well still can't finish the piece they imagine.**

The artist photographs or uploads their own drawing, draws a frame around it on the device (only the framed part is uploaded; the full photo never leaves the device), and Meta's SAM 3.1 finds the drawing in that crop and cuts it out; they check the cutout (adding or removing area if it missed a detail). Then they say what to change (Muse Voice Transcribe 1.0 writes it down) or type it, or keep it as is. Muse Image 1.0 edits the cut-out piece, which it receives as the input image, and Muse Spark 1.3 describes the result so they can compare before and after on screen or through VoiceOver. They can change it again or go back to the original; a changed picture is cut out and made into a new product photo, so Before and after compares the two products. It becomes a die-cut sticker or tote bag, with an NFC tag that opens a short captioned video of the artist.

It is for artists with disabilities, their studios, and buyers who want to know who made what they buy.

Real: every Meta model call, the creator flow on iOS and the web, the shop and print files. Staged: payments (no charge), notifications (iOS polls about every 10 seconds) and fulfilment (by hand). Muse Glimmer runs only while our Mac serves; Muse Spark covers it on the deployed site. Example artists are fictional. Accessibility: VoiceOver, Dynamic Type, Increase Contrast, 44-point targets, WCAG AA contrast (one recorded exception), every result as text.

---

## Public GitHub Repository

https://github.com/wxy26wxy/the-3rd-eye

Start with the README section "Try it in 3 minutes", then `docs/architecture.md` (exact model ids, request shapes and the creator data flow). Written reviews of merged work are in `docs/reviews/`.

---

## 3-Minute Demo Video

[FOUNDER: video link]

What the video shows (beats from `docs/demo_script.md`):
1. 0:00 The four problems, one card each.
2. 0:20 June, a fictional example artist, photographs a sketch; SAM 3.1 finds it; she says what to change; Muse Voice Transcribe writes it down and Muse Image 1.0 edits her own drawing.
3. 0:55 Before and after: VoiceOver reads Muse Spark 1.3's description; SAM 3.1 cuts it out and it becomes a sticker.
4. 1:15 A buyer finds the sticker in the shop and places a staged order (no payment taken).
5. 1:40 The creator records a thank-you with captions; Muse Glimmer on our own Mac drafts the artist's story.
6. 2:05 The printed sticker's NFC tag opens the artist's captioned video, the buyer writes back, and the reply reaches the creator app; the video closes on the model map (2:40).

---

## Describe your use of Meta products

| Stage | Model id | What it does | Where in the repo |
|---|---|---|---|
| Find the drawings in a photo | `sam-3.1` | Two phrase searches ("drawing", "handmade object") on the crop the device uploads (the full photo never leaves the device); results merged, largest first, the largest cut out | `web/lib/ai/meta/sam.ts` (`findCandidates`), `web/lib/pipeline/artworks.ts`, `web/app/api/v1/artworks/route.ts` |
| Cut out the piece inside the area frame | `sam-3.1` | Cuts out the picked or changed piece; the cut is clipped to the uploaded crop, the **Adjust the area** frame (`clipToBox`); masks finished with hole filling and soft edges | `web/lib/ai/meta/sam.ts`, `web/lib/image/mask.ts`, `web/app/api/v1/artworks/[id]/select/route.ts`, `.../cutout/route.ts`, `.../cleanup/route.ts` |
| Die-cut outline | `sam-3.1` (its mask) | The sticker's cut line is grown from the SAM mask; print PNG and die-cut SVG | `web/lib/image/sticker.ts`, `web/lib/pipeline/products.ts` |
| Spoken change request; video captions | `muse-voice-transcribe-1.0` | Writes down what the artist says to change; captions story and thank-you videos (WAV in) | `web/lib/ai/meta/transcribe.ts`, `web/app/api/v1/transcribe/route.ts`, `web/lib/ai/meta/captions.ts` |
| Change the picked piece | `muse-image-1.0` | Edit with the picked piece as `input_image` plus the instruction and a keep-the-style guard; the result is a child artwork, so the original is never lost | `web/lib/ai/meta/image.ts` (`editBody`), `web/lib/pipeline/artworks.ts` (`changeArtwork`), `web/app/api/v1/artworks/[id]/change/route.ts` |
| Product mockups | `muse-image-1.0` | Composes the sticker or tote mockup from the cut-out | `web/lib/ai/meta/mockup.ts`, `web/lib/pipeline/products.ts` |
| Describe each result | `muse-spark-1.3` | Vision description in strict JSON: alt text, a spoken description and what differs from the request, shown as text and read by VoiceOver | `web/lib/ai/meta/describe.ts` |
| Listing agent and moderation | `muse-spark-1.3` | Tool loop that checks the print file, suggests a price and drafts the listing; moderates the listing text (`moderate_content`) and buyers' notes to the artist (`moderate.ts`) | `web/lib/ai/meta/listing-agent.ts`, `web/lib/ai/meta/tools/` (`moderate-content.ts`), `web/lib/ai/meta/moderate.ts`, `web/app/api/v1/listings/[productId]/run/route.ts` |
| Story drafts (open weights) | `muse-glimmer` (Muse Glimmer 30B via Ollama) | Drafts the artist's shop story from their video transcript on our development Mac; Use, Edit or Skip; Muse Spark 1.3 covers it on Vercel (`provider: "meta-fallback"`) | `web/lib/ai/meta/story.ts`, `web/lib/pipeline/story.ts`, `web/app/api/v1/story/draft/route.ts`, `web/app/api/v1/creators/me/story-video/route.ts` |
| Trace of every call | all of the above | One `ai_calls` row per model call, readable per artwork | `web/lib/ai/trace.ts`, `web/app/admin/trace/[artworkId]/` |

Muse Spark's prompt-shaping route and the text-to-image routes remain in the backend but have not been used by the apps since v0.8 (the photo-first version). There is no Meta text-to-speech model, so on-device speech reads Spark's descriptions. Muse Code is not used.

The listing agent is a Muse Spark 1.3 tool loop (`tool_choice: "auto"`, at most 8 model turns) with five function tools (`check_resolution`, `check_contrast`, `suggest_price`, `moderate_content`, `finalize_listing`), answered with `function_call_output` and `previous_response_id`; a final strict-JSON call forces a listing if the loop runs out, and the full step trace is stored with the product (`agent_trace`) as well as in `ai_calls`. SAM 3.1 takes one text phrase per request, so each photo gets two searches in parallel ("drawing" finds pieces on paper, "handmade object" finds things like a knitted bear that "drawing" misses), merged by overlap with the paper or table filtered out, and the chosen piece's mask becomes both the transparent cut-out and the sticker's die-cut line.

---

## Why are Meta's models important to your solution?

The product only works if the art stays the artist's own. Muse Image 1.0 takes the picked piece as its input image and edits it, so a change like "make the book red" keeps the artist's drawing instead of replacing it with a new picture. SAM 3.1 finds hand-drawn pieces on a page, and also objects such as a knitted toy, without the artist having to trace anything; its mask then becomes the sticker's die-cut line. Muse Spark 1.3 returns its descriptions as strict JSON (alt text, a spoken description, what differs from the request), so every result is readable by a screen reader, not only visible. Muse Glimmer runs on our own Mac through Ollama, so the artist's story draft comes from open weights we host ourselves; on the deployed site, which cannot reach the Mac, Muse Spark 1.3 writes it and the response says so (`provider: "meta-fallback"`).

---

## Feedback from your experience using partner technologies

**What worked**
- **Responses API as a drop-in.** The `openai` npm SDK with `baseURL: https://api.meta.ai/v1` covered Spark, Image and SAM with one client (`web/lib/ai/meta/client.ts`). Strict `json_schema`, `reasoning.effort`, function tools with `previous_response_id` all worked when verified live on 2026-10-28 (5 tool calls in 4 turns on the listing smoke run).
- **SAM streaming with `@meta-sam/parser`.** `parseImageStream` and `decodeMaskToRaster` turned the stream into masks with little code, and box prompts (`buildObjectPrompt`, which sends the Adjust the area frame) used the same request shape as phrases.
- **Strict JSON schemas.** With `additionalProperties: false` and every property required, the description and listing outputs come back as fields we validate and show directly, which keeps the screen-reader text predictable.

**What cost time**
- **WAV-only transcription.** Voice Transcribe accepts only `audioEncoding: "WAV"`; MP3, M4A, WEBM and others return "Malformed request". Vercel has no ffmpeg, so iOS records 16 kHz PCM WAV and the web encodes WAV in the browser, including the soundtrack of every story video.
- **No text-to-speech model.** Descriptions are spoken by VoiceOver on iOS and the browser's `speechSynthesis` on the web.
- **Image edit request shape.** We did not find an edit request shape for Muse Image, so we verified one live: the compose shape (`input_text` + `input_image` with the `image_generation` tool) edits, always returns 1600×1600 whatever `size` says, and has no transparent output, so SAM does the cut-out.
- **SAM takes one phrase per request.** Finding both drawings and objects needs two calls per photo (about twice the SAM cost) plus our own merge. The stream does not always send `response.output_text.done`, so we stop on `response.completed`.
- **Vercel's 4.5 MB request body cap** (a Vercel limit, not a Meta one) meant photos and videos are uploaded from the device straight to Blob storage instead of through our API.

**One wish each**
- Muse Voice Transcribe: accept M4A or WebM, and return word timestamps for captions.
- Muse Image: a documented edit mode with mask or transparent PNG output.
- SAM 3.1: several phrases in one request.
- Muse Spark: a text-to-speech companion, so a description can be read in the same voice on every platform.
- Muse Glimmer: a hosted endpoint matching the Ollama build, so the open-weight stage runs in production too.

---

## How likely are you to build with Meta Model API?

Suggested answer: "Likely: the Responses API drop-in and strict JSON made it fast to ship five models in nine days; WAV-only audio and an edit request shape we had to find ourselves were the friction." [FOUNDER: pick the scale value]

## Overall opinion of Meta Model API

Suggested answer: "Positive: SAM 3.1 and Muse Image editing with an input image are what made a photo-first creator flow possible; better docs for edits and audio formats would save the next team time." [FOUNDER: pick the scale value]

---

## Checklist before submitting

- [ ] Repository is public at https://github.com/wxy26wxy/the-3rd-eye and the link opens signed out.
- [ ] The production alias https://the-3rd-eye.vercel.app is pinned to the release deployment (`docs/deployments.md`).
- [ ] The 3-minute video is uploaded and the link opens signed out; the `[FOUNDER: …]` links above are filled.
- [ ] The judge creator code and the admin password are in the form's notes field only, never in the repository or the video.
- [ ] README screenshots match the current build.
- [ ] [FOUNDER: confirm the printed sticker and its NFC tag were tested at the Nov 3 physical test; if not, add "the printed NFC tag is not yet tested" to Project Description and drop "with an NFC tag" from the X post.]
- [ ] [FOUNDER: confirm whether the VoiceOver pass on a real iPhone (`docs/accessibility.md`) has been run; if not, keep README's "not yet verified on a phone" wording in mind before calling VoiceOver support tested.]
- [ ] `bash scripts/check_clean.sh` prints `check_clean: ok` on the submitted commit.
