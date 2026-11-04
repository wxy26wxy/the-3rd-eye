# Demo script (3:00)

Shot-by-shot script for the submission video. Narration is plain, first person plural, and is meant to be read at a calm pace (about 2.5 words a second). Every live step has a fallback so a failed take never blocks the cut.

## Before recording
- **Production site:** https://the-3rd-eye.vercel.app. Phone app: the next TestFlight build of The 3rd Eye (the round 4 app, v0.9.1) once the product owner has uploaded it (pending, see `docs/deployments.md`); until then a local build on the phone or the simulator.
- **Sign-in is done before every take**, so no code or sign-in screen is on camera.
- **Creator codes:** open `web/.creator-codes.local` on the dev Mac. Never type a code on camera; paste it before the take starts or use the app link from `/admin`.
  - **June Park** is the main artist of the video (round 5, 2026-11-03): the photo flow, Change it by voice, Before and after and the listing (shots 2 and 3), his sticker is the product in shot 4, he records the thank-you and owns the story video (shot 5), and his story tag is the one tapped (shot 6). June is one of our fictional example artists; say so in the narration and on the end card. His portrait (illustrative, provided by the founder) shows on the shop, his page, the product page and the story tag.
  - Leo is hidden from the public site since 2026-11-03 and is not in the video; keep his `/t/` links out of every shot. Use a tester creator for rehearsals so the demo creators' data stays clean (a change makes a new draft artwork each time).
- **Mac:** Ollama running with `muse-glimmer`, the app pointed at the Mac only for the story-draft shot. On Vercel the same stage falls back to Muse Spark 1.3.
- **Phone:** VoiceOver on, Settings > Accessibility > VoiceOver > Speech volume up, Do Not Disturb on, screen recording ready (Control Centre). Over-the-shoulder camera on a tripod for the three phone shots.
- **Props:** one rough pencil sketch on paper (a character with a book works well with the change "make the book red"), one printed die-cut sticker with an NFC tag written to `/t/<token>` of a test order (to do: print, cut and write it at the physical test before the freeze, Nov 3, 18:00; method: a standard NFC writer app), a second phone to play the buyer.
- **Pre-recorded safety takes:** record each live step once in rehearsal and keep the clip, named `fallback-<shot>.mov`.

## Screens on camera (iOS, in order; v0.9.1 round 4 order; copy from `docs/design/copy-v3-ios.md`, `copy-v4.md`, `copy-v5.md` and `copy-v6.md`)
Welcome ("Your art, on things people love.", signed in beforehand, so only the first frame if at all) → Pick ("What do you want to make?": Sticker or Tote bag, the "My story video" row, Next) → Choose ("How do you want to add your art?": "Take a photo" or "Upload a picture") → Camera or the photo library → **Adjust the area at once, on the photo in the phone** (no upload yet; "Drag the corners so the frame covers your drawing.", "Use this area", "Reset", "Take a new photo") → Making your cutout (only the framed part is uploaded; SAM looks in it; the searching magnifier) → Your cutout (the framed part filling the screen, no frame outline: "Here's the cutout of your art. Fix the edges if you need to.", a strip of the drawings only when there are two or more, "Add area" / "Remove area" marks, "Apply cutout", "Use this", "Start over") → **Change it with the sticker being made** ("Making your sticker…", the two buttons waiting with "Your sticker is being made", then **the AI product photo of his sticker**, labelled "Your sticker"; "Say what to change" or the "What to change" field, "Make the change" and "Looks good as is" side by side, "Fix the cutout") → Changing your art ("YOU ASKED"; "Changing your art…" → "Cutting it out…" → "Making your sticker…") → Before and after ("Here's the change", "Your sticker, before and after": **two product photos**, "WHAT THE IMAGE SHOWS", "Use this", "Change it again", "Back to my original", "Fix the cutout") → Change it on the change (its photo at once) → "Looks good as is" → Listing details (the product photo on top, the drafting card "Writing your listing…" with "Redo", then the fields and the print check line) → Story video ("Tell buyers your story") → Video saved → You're live ("<title> is in the shop."). There is no Finding screen and no separate Making your sticker screen any more. The Create tab's "My story video" row (Watch, Record again) is shown once in shot 5. Shots 2 and 3 cover the creation flow; shots 5 and 6 cover the Orders and Messages tabs.

## Beat sheet

| Time | Shot | Capture | Meta model on screen |
|---|---|---|---|
| 0:00-0:20 | 1. The four problems | Title cards over still art | none |
| 0:20-0:55 | 2. Photograph a sketch, change it by voice | Phone, over the shoulder, then screen recording | SAM 3.1, Muse Voice Transcribe 1.0, Muse Image 1.0 (edit), Muse Spark 1.3 |
| 0:55-1:15 | 3. Before and after, then the listing | Screen recording (phone), or simulator capture | Muse Spark 1.3, Muse Image 1.0 (product photo) |
| 1:15-1:40 | 4. A buyer finds it | Screen recording of the shop (phone-sized browser) | none (shop) |
| 1:40-2:05 | 5. The creator says thank you | Simulator capture, then phone | Muse Voice Transcribe 1.0, Muse Glimmer (Ollama) |
| 2:05-2:40 | 6. The sticker, the tap, the reply | Over the shoulder, then screen recording | Muse Voice Transcribe 1.0 (captions) |
| 2:40-3:00 | 7. What runs where | Model-map card | all of them except Muse Code, which we have not used |

### 1. The four problems (0:00-0:20)
Shot: four cards, one per problem, each held about 4 seconds over a still of a real sticker. No voice-over reading from a script on screen; the cards carry the text. Card 4 reads: "People who can't draw well still can't finish the piece they imagine. With a photo of a sketch and their voice, they change it until it is theirs."

Narration:
"Most studios can sell an original once, locally. Artists with disabilities are employed at about half the rate of others. Buyers never meet the maker. And people who can't draw well can't finish the piece they imagine. The 3rd Eye answers all four."

Fallback: none needed (stills).

### 2. Photograph a sketch, change it by voice, VoiceOver on (0:20-0:55)
Creator: **June Park** (signed in beforehand). Capture: phone over the shoulder for the first 5 seconds (June's rough pencil sketch on the table, the phone photographing it, VoiceOver on), then the phone's screen recording.

Steps and what the viewer sees:
1. Create tab > Sticker > Next > "Take a photo" (detail line "Snap your drawing") > "Open the camera".
2. **Adjust the area** opens at once (nothing is uploaded yet): the photo as he took it, with the frame around the **whole photo**. "Drag the corners so the frame covers your drawing." He drags two corners in onto his sketch (a VoiceOver user does the same with the frame's actions, "Shrink 10 %" and "Move left 10 %", and hears "Frame covers … percent of the photo") and taps "Use this area". Keep this to about 5 seconds.
3. **Making your cutout:** the phone uploads **only the framed part** (the full photo never leaves the phone) and the magnifier plays while SAM 3.1 looks for the drawing in it. (If the frame holds nothing: "We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again." Do not show this on camera.)
4. **Your cutout:** the first cut shows on the checkerboard, filling the screen (no frame outline) (when the frame holds two or more drawings, a strip of "Piece 1", "Piece 2" sits under it; frame only the sketch so the strip does not appear). A bit of paper edge is still in it, so he taps "Fix the edges", picks "Remove area", taps the stray bit, taps "Apply cutout" and the cut is redone ("Your cutout is ready. Here it is."). (With VoiceOver: the photo's action "Add the area around your art" and the marks list.) He taps "Use this".
5. **Change it** opens at once with "Making your sticker…" over the creating animation (the two buttons wait, "Your sticker is being made"); after 10–20 seconds **the AI product photo of his sticker** fades in, labelled "Your sticker", and VoiceOver says "Your sticker is ready!". Keep the wait out of the cut (jump cut), or let his speak the change while it waits: the field and "Say what to change" work during the wait. He taps "Say what to change" and says "make the book red, and give him a yellow raincoat". Muse Voice Transcribe 1.0 writes it down ("Writing down what you said…"), the words land in the "What to change" field, and VoiceOver announces "You said: …". He can fix the words in the field, then taps "Make the change". (The iOS app asks no follow-up question; the words in the field are what is sent.)
6. **Changing your art:** the "YOU ASKED" card shows his words while the status line goes "Changing your art…" (Muse Image 1.0 edits his own piece; the picture is the input image, nothing is drawn from words alone) → "Cutting it out…" (SAM) → "Making your sticker…".

Narration (leave about 10 s silent for VoiceOver speech and the edit wait):
"June is one of our example artists. He photographs his sketch, frames it, and SAM finds it. Then he says what to change. Muse Voice Transcribe writes it down, and Muse Image changes his own drawing, not a new one."

Fallback: if the live edit takes more than 40 seconds or fails ("Something went wrong. Please try again."), cut to `fallback-change.mov` (the rehearsal take). If the phone microphone fails, type in the "What to change" field (the keyboard's dictation key also works) and say so in the narration ("he uses dictation here"). With `AI_FIXTURES=1` on a local server the whole flow runs offline with synthetic art, but fixtures are not Meta output; do not use them for the final cut and do not narrate them as models.

### 3. Before and after, then the listing (0:55-1:15)
Creator: **June Park**, continuing shot 2. Capture: the phone's screen recording (or the simulator, which uses a photo from the library).

Steps:
1. **Before and after:** "Here's the change", "Your sticker, before and after", with the **two product photos** side by side (his first sticker and the changed one). **VoiceOver reads the "WHAT THE IMAGE SHOWS" card**, Muse Spark 1.3's description of the result; if the change missed something, "Different from what you asked: …" says so. Cut to the card as text so deaf viewers get it too. Point at "Change it again", "Back to my original" (the original is never lost) and "Fix the cutout"; tap "Use this".
2. **Change it** shows the changed sticker at once (its product was made during Changing). He taps "Looks good as is".
3. **Listing details:** the AI product photo on top, and under it for a few seconds the **drafting card** ("Writing your listing…", "We'll show the name, price and description when it's ready.") with a secondary "Redo" (do not tap it on camera). The fields appear filled when Muse Spark 1.3 has written them, and "Approve and list it" turns on. **The warning line:** a faint pencil sketch may show "Print check: the colors may look faint"; that is a warning, not a block ("Use anyway" lists it). If the line shows, keep it in the take for two seconds: it is honest about print quality. "Tell buyers your story" and "You're live" follow; this shot stops at the filled listing, and the drafting card can be a 3-second insert.

Narration:
"Muse Spark describes the result, and VoiceOver reads it to him, so he can compare before and after. He can change it again or go back. Each version is already a sticker."

Fallback: if the change or the product photo is slow on stage, use the rehearsal take (`fallback-cutout.mov`). Do not retry on camera more than once.

### 4. A buyer finds it (1:15-1:40)
Capture: screen recording of https://the-3rd-eye.vercel.app in a phone-sized browser window. Creator: **June Park**. Product: June's sticker (the smiling cactus, or the sticker just published in shot 3); the shop's hero chip and the first "Meet the makers" card show June with his portrait. Since round 3 the shop card and the first picture on the product page show the **AI product photo** (the Muse Image mockup, `mockupUrl`, of the sticker in a scene), for stickers and totes alike; hold on the card for a second. The **second gallery picture** is the bordered die-cut sticker (white border, contained, never cropped): swipe to it once so viewers see what is printed. The art in the AI photo is not guaranteed to be to scale.

Steps: shop home ("Art with a story in every piece.") > "New this week" > the product page (breadcrumb Shop / Stickers / the name, "Sticker · die-cut · waterproof", "June earns from every sticker sold.") > **Size** "4 in" > quantity "More" once (2) > **"Add to bag"** > the order sheet "Buy this piece": enter a name, "Place order · <price>" (the sheet says "Demo checkout: no payment is taken yet.") > "Thank you!" with the "Open the story tag" link.

Narration:
"A buyer finds the sticker in the shop and sees who made it. They pick a size and a quantity. Checkout is staged in this demo: it creates the order but takes no payment. Then they get a link to the story tag."

Fallback: the shop has seeded products and orders; if the live site is slow, use a recording made in rehearsal. `/admin` shows the order with "size × qty" for the edit if needed.

### 5. The creator says thank you (1:40-2:05)
Creator: **June Park**. Capture: simulator capture of the Orders tab, then the phone for the 10-second video.

Steps: Orders tab shows the new order (the list refreshes about every 10 seconds, there is no push notification) > Order detail > thank-you composer > record a 10-second video > send. Show the Create tab once: under the product choice the **"My story video"** row ("Recorded <date>") opens the player ("Watch", with captions) and "Record again" (the new video replaces the old one on every product). Mention the story-draft sheet: after the story video, "Here's a story we drafted from your video" offers "Use this story", "Edit it" or "Skip".

Narration:
"The creator sees the order arrive and records a short thank-you; Muse Voice Transcribe adds captions. Muse Glimmer, an open-weight model on our own Mac through Ollama, drafts the artist's story from their words. The artist can use it, edit it, or skip it."

Fallback: if Ollama is down, the stage uses Muse Spark 1.3 and the response says `provider: "meta-fallback"`; narrate it honestly ("Spark covers when the Mac is off"). If recording fails, use `fallback-thankyou.mov`.

### 6. The sticker, the tap, the reply (2:05-2:40)
Creator: **June Park** (the tag of a staged order on his sticker; `DEMO_STORY_TAG_TOKEN` should point at a June order). Capture: over the shoulder for the print and tap; screen recordings for the page and the creator app.

Steps:
1. Show the printed die-cut sticker (print PNG and die SVG downloaded from `/admin`). Show the NFC tag on the back. The physical sticker and tag are done at the physical test before the freeze (Nov 3, 18:00) (method: a standard NFC writer app); until they exist, use the QR route in the fallback and do not narrate a tap.
2. **Tap the sticker with the buyer phone.** `/t/<token>` opens: the artist's captioned video, the thank-you, the note box.
3. Buyer types a reply and sends it.
4. **Switch to the creator app, Messages tab: the reply arrives** (within about 10 seconds of polling). Show it.

Narration:
"The sticker carries an NFC tag. The buyer taps it and meets the artist, with captions. The buyer writes back, and the reply shows up in the creator's app."

Fallback: if the tag does not read, scan the QR code on `/admin` for the same order (the tag page is the same URL). If the reply is slow, cut to `fallback-reply.mov`. The iOS app does not write tags; the planned method is a standard NFC writer app.

### 7. What runs where (2:40-3:00)
Capture: one card listing the models, then the vote ask over the logo.

Narration:
"Muse Voice Transcribe 1.0 hears. Muse Spark 1.3 describes and writes the listing. Muse Image 1.0 edits the artist's drawing. SAM 3.1 finds and cuts. Muse Glimmer drafts stories on our own hardware. We built this from October 27 to November 4. Please vote for The 3rd Eye."

Fallback: none needed.

## Edit notes
- Keep VoiceOver audio audible in shots 2 and 3; lower any music under it.
- Burn in captions for all narration.
- Do not show a creator code, a bearer token, the admin password or `.env.local`. Blur the URL bar if a sign-in link is visible.
- Label example creators as fictional in the end card.
- Narration totals 279 words (counted with wc -w: 43, 40, 32, 43, 44, 29, 48; shot 2 gained "frames it," in round 3; shot 3 ends on "Each version is already a sticker." since round 4); each shot is written to fit its slot at 2.5 words a second. Time a read-through before recording; none has been done yet.
