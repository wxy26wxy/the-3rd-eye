# Demo script (3:00)

Shot-by-shot script for the submission video. Narration is plain, first person plural, and is meant to be read at a calm pace (about 2.5 words a second). Every live step has a fallback so a failed take never blocks the cut.

## Before recording
- **Production site:** https://the-3rd-eye.vercel.app. Phone app: TestFlight 0.5.0 build 3 of The 3rd Eye (the v0.8 build) once the product owner has uploaded it (pending, see `docs/deployments.md`); until then a local build on the phone or the simulator.
- **Sign-in is done before every take**, so no code or sign-in screen is on camera.
- **Creator codes:** open `web/.creator-codes.local` on the dev Mac. Never type a code on camera; paste it before the take starts or use the app link from `/admin`.
  - **June Park** (photo, Change it by voice, Before and after, Your cutout): shots 2 and 3. June is one of our fictional example artists; say so in the narration and on the end card.
  - **Leo**: his bus sticker is the product in shot 4. Use a tester creator for rehearsals so the demo creators' data stays clean (a change makes a new draft artwork each time).
- **Mac:** Ollama running with `muse-glimmer`, the app pointed at the Mac only for the story-draft shot. On Vercel the same stage falls back to Muse Spark 1.3.
- **Phone:** VoiceOver on, Settings > Accessibility > VoiceOver > Speech volume up, Do Not Disturb on, screen recording ready (Control Centre). Over-the-shoulder camera on a tripod for the three phone shots.
- **Props:** one rough pencil sketch on paper (a character with a book works well with the change "make the book red"), one printed die-cut sticker with an NFC tag written to `/t/<token>` of a test order (to do: print, cut and write it at the physical test before the freeze, Nov 3 9:00 AM; method: a standard NFC writer app), a second phone to play the buyer.
- **Pre-recorded safety takes:** record each live step once in rehearsal and keep the clip, named `fallback-<shot>.mov`.

## Screens on camera (iOS, in order; v0.8 copy from `docs/design/copy-v3-ios.md` and the feedback-round-2 changes in `docs/design/copy-v4.md`)
Welcome ("Your art, on things people love.", signed in beforehand, so only the first frame if at all) → Pick ("What do you want to make?": Sticker or Tote bag, the "My story video" row, Next) → Choose ("How do you want to add your art?": "Take a photo" ("Snap your drawing") or "Upload a picture" ("Pick one you already have")) → Camera ("Open the camera") or the photo library → Finding ("Finding your drawings…") → Choose a pattern ("Tap the one you want.", "Use this") → Adjust the area ("Drag the corners so the frame covers your drawing.", "Use this area", "Reset") → Change it ("Change your art?": "Say what to change" or the "What to change" field, "Make the change" and "Looks good as is" side by side in the card) → Changing your art ("YOU ASKED") → Before and after ("Here's the change": Before, After, "WHAT THE IMAGE SHOWS", "Use this", "Change it again", "Back to my original") → Making your cutout → Your cutout ("Here's your cutout.", the preview, "Use this", "Start over"; no edge tools) → Making your sticker ("Adding the white border and getting it ready to print.") → Design ready ("Your sticker is ready!", "Put it up for sale now?") → Listing details (drafting card "Writing your listing…", then the filled fields) → Story video ("Tell buyers your story") → Video saved → You're live ("<title> is in the shop."). The Create tab's "My story video" row (Watch, Record again) is shown once in shot 5. Shots 2 and 3 cover the creation flow; shots 5 and 6 cover the Orders and Messages tabs.

## Beat sheet

| Time | Shot | Capture | Meta model on screen |
|---|---|---|---|
| 0:00-0:20 | 1. The four problems | Title cards over still art | none |
| 0:20-0:55 | 2. Photograph a sketch, change it by voice | Phone, over the shoulder, then screen recording | SAM 3.1, Muse Voice Transcribe 1.0, Muse Image 1.0 (edit), Muse Spark 1.3 |
| 0:55-1:15 | 3. Before and after, then the cutout | Screen recording (phone), or simulator capture | Muse Spark 1.3, SAM 3.1 |
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
1. Create tab > Sticker > Next > "Take a photo" (detail line "Snap your drawing") > "Open the camera". "Finding your drawings…" shows while SAM 3.1 finds the pieces.
2. **Choose a pattern:** "Tap the one you want." June picks the sketch ("Piece 1") and taps "Use this".
3. **Adjust the area:** "Drag the corners so the frame covers your drawing." The frame already sits on her sketch; she drags one corner to tighten it (a VoiceOver user does the same with the frame's actions, "Grow 10 %" and "Shrink 10 %", and hears "Frame covers … percent of the photo") and taps "Use this area". Keep this to about 4 seconds.
4. **Change it:** "Change your art?" shows her piece as "Your art" with "WHAT THE IMAGE SHOWS". She taps "Say what to change" and says "make the book red, and give him a yellow raincoat". Muse Voice Transcribe 1.0 writes it down ("Writing down what you said…"), the words land in the "What to change" field, and VoiceOver announces "You said: …". She can fix the words in the field, then taps "Make the change".
5. The iOS app asks no follow-up question; the words in the field are what is sent.
6. **Changing your art:** the "YOU ASKED" card shows her words while Muse Image 1.0 edits her own piece (the picture is the input image; nothing is drawn from words alone).

Narration (leave about 10 s silent for VoiceOver speech and the edit wait):
"June is one of our example artists. She photographs her sketch, and SAM finds it. Then she says what to change. Muse Voice Transcribe writes it down, and Muse Image changes her own drawing, not a new one."

Fallback: if the live edit takes more than 40 seconds or fails ("Something went wrong. Please try again."), cut to `fallback-change.mov` (the rehearsal take). If the phone microphone fails, type in the "What to change" field (the keyboard's dictation key also works) and say so in the narration ("she uses dictation here"). With `AI_FIXTURES=1` on a local server the whole flow runs offline with synthetic art, but fixtures are not Meta output; do not use them for the final cut and do not narrate them as models.

### 3. Before and after, then the cutout (0:55-1:15)
Creator: **June Park**, continuing shot 2. Capture: the phone's screen recording (or the simulator, which uses a photo from the library).

Steps:
1. **Before and after:** "Here's the change" with "Before" and "After" side by side. **VoiceOver reads the "WHAT THE IMAGE SHOWS" card**, Muse Spark 1.3's description of the result; if the change missed something, "Different from what you asked: …" says so. Cut to the card as text so deaf viewers get it too. Point at "Change it again" and "Back to my original" (the original is never lost); tap "Use this".
2. **Making your cutout** ("Cutting out your art. This takes a few seconds.") while SAM 3.1 cuts the changed piece out.
3. **Your cutout:** "Here's your cutout." The screen is a preview only (the cutout on the checkerboard, "Use this", "Start over"); the area was already set on Adjust the area, so there is nothing to fix here. Tap "Use this".
4. **Making your sticker** ("Adding the white border and getting it ready to print.", the looping sticker animation) → "Your sticker is ready!" and "Put it up for sale now?". Then Listing details: for a couple of seconds the **drafting card** shows ("Writing your listing…", "We'll show the name, price and description when it's ready."), the fields appear filled when Muse Spark 1.3 has written them, and "Approve and list it" turns on. "Tell buyers your story" and "You're live" follow in the app; this shot stops at Design ready, and the drafting card can be a 3-second insert.

Narration:
"Muse Spark describes the result, and VoiceOver reads it to her, so she can compare before and after. She can change it again or go back. SAM cuts it out, and it becomes a sticker."

Fallback: if SAM returns nothing on stage, use the rehearsal take (`fallback-cutout.mov`). Do not retry on camera more than once.

### 4. A buyer finds it (1:15-1:40)
Capture: screen recording of https://the-3rd-eye.vercel.app in a phone-sized browser window. Product: Leo's bus sticker (or the sticker just published). The shop card and the first picture on the product page show the **bordered sticker tile** (the die-cut sticker with its white border, contained, never cropped); hold on the card for a second. The AI product photo is only a later picture in the gallery.

Steps: shop home ("Art with a story in every piece.") > "New this week" > the product page (breadcrumb Shop / Stickers / the name, "Sticker · die-cut · waterproof", "Leo earns from every sticker sold.") > **Size** "4 in" > quantity "More" once (2) > **"Add to bag"** > the order sheet "Buy this piece": enter a name, "Place order · <price>" (the sheet says "Demo checkout: no payment is taken yet.") > "Thank you!" with the "Open the story tag" link.

Narration:
"A buyer finds the sticker in the shop and sees who made it. They pick a size and a quantity. Checkout is staged in this demo: it creates the order but takes no payment. Then they get a link to the story tag."

Fallback: the shop has seeded products and orders; if the live site is slow, use a recording made in rehearsal. `/admin` shows the order with "size × qty" for the edit if needed.

### 5. The creator says thank you (1:40-2:05)
Capture: simulator capture of the Orders tab, then the phone for the 10-second video.

Steps: Orders tab shows the new order (the list refreshes about every 10 seconds, there is no push notification) > Order detail > thank-you composer > record a 10-second video > send. Show the Create tab once: under the product choice the **"My story video"** row ("Recorded <date>") opens the player ("Watch", with captions) and "Record again" (the new video replaces the old one on every product). Mention the story-draft sheet: after the story video, "Here's a story we drafted from your video" offers "Use this story", "Edit it" or "Skip".

Narration:
"The creator sees the order arrive and records a short thank-you; Muse Voice Transcribe adds captions. Muse Glimmer, an open-weight model on our own Mac through Ollama, drafts the artist's story from their words. The artist can use it, edit it, or skip it."

Fallback: if Ollama is down, the stage uses Muse Spark 1.3 and the response says `provider: "meta-fallback"`; narrate it honestly ("Spark covers when the Mac is off"). If recording fails, use `fallback-thankyou.mov`.

### 6. The sticker, the tap, the reply (2:05-2:40)
Capture: over the shoulder for the print and tap; screen recordings for the page and the creator app.

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
- Narration totals 280 words (counted with wc -w: 43, 38, 35, 43, 44, 29, 48); each shot is written to fit its slot at 2.5 words a second. Time a read-through before recording; none has been done yet.
