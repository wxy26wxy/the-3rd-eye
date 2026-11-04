# The 3rd Eye

The 3rd Eye helps artists with disabilities turn their art into products people want to buy. Every piece starts from the artist's own work: they photograph or upload a drawing (or something they made), draw a frame around it, and Meta's SAM 3.1 finds the drawing inside the frame. Then they change it until it is theirs. They say what to change (Muse Voice Transcribe 1.0 writes it down) or type it, Muse Image 1.0 edits the picked piece, which it receives as the input image, and Muse Spark 1.3 describes the result in words, so the artist can compare before and after on screen or hear it through the phone's screen reader (VoiceOver). They can change it again, go back to the original, or keep it as is. SAM 3.1 then cuts the final piece out, and it becomes a die-cut sticker or a tote bag. Each one ships with an NFC story tag that opens a short captioned video of the artist talking about their work.

This is our entry for the Meta Global AI Developer Hackathon (Startups track, "Build for Your World"). We built it from Oct 27 to Nov 4, 2026, and everything in this repository was written in that period.

## Screenshots

<p>
  <img width="280" src="docs/images/ios-change-it.png" alt="The iOS app's Change your art? screen, scrolled to the form: the product photo of your sticker at the top (the sample mascot, from the mock), a What the image shows card, the What to change field with the words Make the sky purple typed in, the Say what to change microphone button, the buttons Make the change and Looks good as is, and a Fix the cutout link">
  <img width="280" src="docs/images/ios-before-after.png" alt="The iOS app's Here's the change screen: the subtitle Your sticker, before and after, a You asked card with Make the sky purple, the Before and After product photos side by side (the same sample mascot on both sides, because the mock makes no real edit), and the buttons Use this, Change it again, Back to my original and Fix the cutout">
  <img width="280" src="docs/images/ios-adjust-the-area.png" alt="The iOS app's Adjust the area screen: the heading, the line Drag the corners so the frame covers your drawing, the photo still on the phone with a white resizable frame around all of it (round handles on the four corners and the four edges; the test suite's picture shows a dark rectangle and a green square), the buttons Use this area and Reset, and a Take a new photo link">
</p>

![The shop home page at desktop width: the eyebrow "Stickers & totes by disabled artists", the headline "Art with a story in every piece.", the buttons Shop new arrivals and How story tags work, the line "By default, half of every sale goes to the artist", and a photo of the green mascot holding two tote bags](docs/images/web-shop-home.png)

The iOS shots are the current app in the simulator against the mock API, with the mascot standing in for the art (the mock makes no real edit, so Before and After match); the shop shot is the live site at 1440 px. Mascot and sky imagery: The 3rd Eye design team; the creator portraits are illustrative, provided by the founder.

## Try it in 3 minutes

1. **Buy something.** Open <https://the-3rd-eye.vercel.app>, pick a sticker, choose a **Size** and a quantity, tap **Add to bag**, fill in the order sheet (name, optional email and note) and tap **Place order**. Payment is staged: the order is created with no charge. The success page shows the story-tag link `/t/<token>`, the page a buyer sees when they tap the sticker's NFC tag. Leave the artist a note there.
2. **Make something.** Open `/create` on your phone (or the iOS app built from `ios/`) and sign in with the creator code in the submission notes (anyone else: email <hi@esprel.com> or open a "Creator code request" issue in this repository, and we send a code for the hidden Test Artist account, whose pieces never show in the shop). Pick **Sticker**, take or upload a photo of a drawing, and on **Adjust the area** drag the frame onto it; only the framed part is uploaded. SAM 3.1 cuts the drawing out (a strip lets you switch pieces, Add area / Remove area fix the edges) and **Change it** shows the AI product photo of your sticker. Say or type a change, tap **Make the change**, and **Before and after** shows the two stickers with Muse Spark's description (VoiceOver reads it on iOS); keep it, change it again, or go back. **Looks good as is** opens the listing the agent drafts; approve it and the sticker is in the shop. The full walk-through is in `docs/demo_script.md`.
3. **See the trace.** The admin page (`/admin`, password in the submission notes) lists orders, print files and every model call behind each artwork at `/admin/trace/<artworkId>`.

## The four problems

1. **Art that can't sell at scale.** Most art studios serving people with disabilities can only sell original pieces locally, and once a piece sells, it's gone. We turn one artwork into products that can be sold again and again, with no inventory.
2. **Talent without income or recognition.** People with disabilities are employed at about half the rate of people without disabilities. We give them a way to earn money and be recognized as artists.
3. **No connection between buyers and creators.** Buyers usually have no idea who made what they're buying. Our NFC story tag lets them hear directly from the artist, which makes the product more meaningful and a better gift.
4. **People who can't draw well still can't finish the piece they imagine.** With a photo of a sketch and their voice, they change it until it is theirs.

Source for problem 2: U.S. Bureau of Labor Statistics, *Persons with a Disability: Labor Force Characteristics — 2025* (released 2026-03-03): employment-population ratio for ages 16–64 was 38.1 % with a disability and 74.8 % without. <https://www.bls.gov/news.release/disabl.nr0.htm>

## What is real and what is staged

Real:
- Every Meta model call in the model map below, on the deployed site and in the iOS app.
- The creator flow (photo or upload, Adjust the area, Your cutout, Change it by voice or text, Before and after, listing, story video, thank-you), the shop, the story-tag page (the artist's captioned video starts by itself, muted, with a "Turn sound on" button), the buyer-to-creator note thread, and the admin pages for print files.
- Print files (PNG and die-cut SVG), generated for every order and downloadable from `/admin`.

Staged or limited:
- **Payments.** Add to bag opens an order sheet; Place order creates one order (product, size, quantity) and takes no payment (`PAYMENTS_MODE=staged`). The size prices (sticker 3 in = listed price, 4 in +$2, sticker sheet +$6) are sample pricing.
- **Creators.** The example artists in the shop are fictional and labelled as such. Real creators sign in with a code issued from `/admin`; this is development-grade sign-in, not production auth.
- **Notifications.** The iOS app checks for new orders and messages about every 10 seconds. There are no push notifications.
- **Physical sticker and NFC tag.** Done by hand: a sticker was printed from the print file and cut along its die-cut line, and a tag written with a standard NFC writer app opens the story page `/t/<token>` on a phone (steps in `scripts/print_checklist.md`). The iOS app does not write tags. The QR code on `/admin` opens the same story page.
- **Fulfilment.** We print and ship by hand from the admin page.
- **Open-weight stage.** After a story video is captioned, Muse Glimmer drafts the artist's shop story (Use, Edit or Skip; "Mention my disability" is off by default). Glimmer runs through Ollama on our development Mac, so it serves only while that Mac is up; on the deployed site the same stage falls back to Muse Spark 1.3 and every response says `provider: "meta-fallback"`.
- **Verified on a phone (Nov 4):** the creator flow from a photo to a listed sticker in the iOS app, and the story tag page in Safari. **Not yet verified:** captions from a video recorded in the app on a real iPhone, and a VoiceOver pass over the Change it, Before and after, Your cutout and My designs screens. See `docs/risks.md` and `docs/accessibility.md`.

## Model map

| Stage | Model | Id |
|---|---|---|
| Speech to text (the spoken change instruction, story and thank-you captions) | Muse Voice Transcribe 1.0 | `muse-voice-transcribe-1.0` |
| Name the things in a photo so SAM can find the subject; describe each result (Before and after, alt text, what differs from the request); listing agent | Muse Spark 1.3 | `muse-spark-1.3` |
| Edit the picked piece with the change instruction (the piece is the input image); product mockups | Muse Image 1.0 | `muse-image-1.0` |
| Find the drawing inside the **Adjust the area** frame (the device uploads only the framed part, and detection runs on it); cut out the changed piece; die-cut outline | SAM 3.1 | `sam-3.1` |
| Draft the artist's story from their own words (open weights) | Muse Glimmer 30B via Ollama | `muse-glimmer` |

Muse Code is not exposed to our API key, so it is not used; Muse Spark 1.3 reviewed the repository instead (`docs/reviews/2026-11-04-muse-spark-review.md`). Every model call is recorded in the `ai_calls` table and can be read at `/admin/trace`.

## Accessibility

- **iOS uses the system's features instead of copying them:** the keyboard's dictation key for speaking instead of typing, VoiceOver for hearing descriptions and messages, Dynamic Type for text size, Increase Contrast for the high-contrast palette.
- **There is no Meta text-to-speech model.** Muse Spark writes the description, both apps show it as text, and VoiceOver reads it on iOS. On the web a "Read aloud" button uses the browser's `speechSynthesis`.
- **Contrast:** text meets WCAG AA (4.5:1, 3:1 for large text) for every text except the web Welcome title, which sits on a photo by design (about 2.6–2.8:1; recorded with the measurements in `docs/accessibility.md`). The iOS Welcome keeps a scrim behind its text.
- Everything the app tells the person (questions, confirmations, errors, results) is visible text as well as an announcement.
- Hand-run VoiceOver test scripts for each creator screen are in `docs/accessibility.md`; they have not yet been run on a device.

## Repository

- `web/` - Next.js app: public shop, story-tag pages, admin, and the JSON API used by the iOS app
- `ios/` - SwiftUI creator app (XcodeGen project)
- `design/` - design tokens, the single source of truth for both platforms
- `docs/` - brief, plan, decisions, progress, API contract, runbooks, demo script
- `scripts/` - token generator, seed, probes, repository checks

## Run it

Node 24 and pnpm. From the repository root run `pnpm install`.

**Web** (`web/`):
- `cp .env.example .env.local` and fill what you have. The app builds and the unit tests pass with no keys. With `AI_FIXTURES=1` the AI stages return synthetic offline results (not Meta output) so the screens can be explored without keys.
- `pnpm dev` serves http://localhost:3000. `pnpm build && pnpm start` runs the production build.
- Real runs need `META_API_KEY`, `DATABASE_URL` (Neon Postgres), `CREATOR_SESSION_SECRET`, `ADMIN_PASSWORD` and the Blob settings listed in `docs/architecture.md`. `pnpm db:migrate` then `pnpm seed` creates the schema and the example creators; the seed writes their sign-in codes to `web/.creator-codes.local`, which is not committed, and gives Maya Ortiz and June Park their portraits from `scripts/seed-assets/avatars/` while they have none. `FEATURED_CREATOR_SLUG` (default `june-park`) picks the creator the shop features first.
- Live data is maintained with founder-run scripts (`pnpm avatar`, `pnpm replace-art`, `pnpm move-orders`, `pnpm story-video`): `docs/scripts.md`.
- For the open-weight stage, run Ollama with the `muse-glimmer` model and set `OLLAMA_BASE_URL`.

**iOS** (`ios/`, Xcode and XcodeGen):
- `xcodegen generate`, then build and run the `The3rdEye` scheme in the simulator. `API_BASE_URL` defaults to the deployed site; pass `API_BASE_URL=http://localhost:3000` to use a local server.
- On a phone: `docs/handoffs/ios.md` ("Install on your iPhone" and TestFlight).

**Mock API for iOS (no backend):** `python3 ios/scripts/mock_api.py` serves port 3999; build with `API_BASE_URL=http://localhost:3999`.

## Test it

- Web: `pnpm test` and `pnpm lint` from `web/`.
- iOS: `xcodebuild test -scheme The3rdEye -destination 'platform=iOS Simulator,name=iPhone 17 Pro' -derivedDataPath build/DerivedData` from `ios/`; UI tests use the mock API as described in `docs/handoffs/ios.md`.
- Repository check: `bash scripts/check_clean.sh`.
- By hand: `docs/accessibility.md` (VoiceOver scripts) and `docs/demo_script.md` (the end-to-end path we record).
- API and architecture: `docs/api.md`, `docs/architecture.md`. Decisions and risks: `docs/decisions.md`, `docs/risks.md`.

Live site: https://the-3rd-eye.vercel.app
