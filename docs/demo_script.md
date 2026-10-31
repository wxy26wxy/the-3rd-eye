# Demo script (3:00)

Shot-by-shot script for the submission video. Narration is plain, first person plural, and is meant to be read at a calm pace (about 2.5 words a second). Every live step has a fallback so a failed take never blocks the cut.

## Before recording
- **Production site:** https://the-3rd-eye.vercel.app. Phone app: TestFlight build 0.5.0 of The 3rd Eye once the product owner has uploaded it (pending, see `docs/deployments.md`); until then a local build on the phone or the simulator.
- **Sign-in is done before every take**, so no code or sign-in screen is on camera.
- **Creator codes:** open `web/.creator-codes.local` on the dev Mac. Never type a code on camera; paste it before the take starts or use the app link from `/admin`.
  - **June Park** (voice flow): shot 2. June is one of our fictional example artists; say so in the narration and on the end card.
  - **Leo** (drawing and photo flow, the Adjust-cutout shot): shot 3. Use a tester creator for rehearsals so the demo creators' data stays clean.
- **Mac:** Ollama running with `muse-glimmer`, the app pointed at the Mac only for the story-draft shot. On Vercel the same stage falls back to Muse Spark 1.3.
- **Phone:** VoiceOver on, Settings > Accessibility > VoiceOver > Speech volume up, Do Not Disturb on, screen recording ready (Control Centre). Over-the-shoulder camera on a tripod for the three phone shots.
- **Props:** one stitched toy (or a wallet), one printed die-cut sticker with an NFC tag written to `/t/<token>` of a test order (to do: print, cut and write it at the physical test on Oct 30; method: a standard NFC writer app), a second phone to play the buyer.
- **Pre-recorded safety takes:** record each live step once in rehearsal and keep the clip, named `fallback-<shot>.mov`.

## Screens on camera (iOS, in order)
Welcome ("Your art, on things people love.", signed in beforehand, so only the first frame if at all) → Pick ("What do you want to make?": Sticker or Tote bag, Next) → Choose ("Choose how you want to bring your drawing into the studio.": "Snap your drawing", "Pick one you already have", "Describe it, we draw it for you", marked "NO DRAWING SKILL NEEDED") → Camera or Upload (photo branch) or Speak, Drawing your idea and Voice result (voice branch) → Finding ("Finding your drawings…") → Adjust cutout → Design ready ("Your sticker is ready!", "Put it up for sale now?") → Listing details → Story video ("Tell buyers your story") → You're live ("<title> is in the shop."). Shots 2 and 3 cover the voice and photo branches; shots 5 and 6 cover the Orders and Messages tabs.

## Beat sheet

| Time | Shot | Capture | Meta model on screen |
|---|---|---|---|
| 0:00-0:20 | 1. The four problems | Title cards over still art | none |
| 0:20-0:55 | 2. Describe it out loud | Phone, over the shoulder, then screen recording | Muse Voice Transcribe 1.0, Muse Spark 1.3, Muse Image 1.0 |
| 0:55-1:15 | 3. Photograph a toy, adjust the cutout | Simulator capture (or phone) | SAM 3.1 |
| 1:15-1:40 | 4. A buyer finds it | Screen recording of the shop (phone-sized browser) | none (shop) |
| 1:40-2:05 | 5. The creator says thank you | Simulator capture, then phone | Muse Voice Transcribe 1.0, Muse Glimmer (Ollama) |
| 2:05-2:40 | 6. The sticker, the tap, the reply | Over the shoulder, then screen recording | Muse Voice Transcribe 1.0 (captions) |
| 2:40-3:00 | 7. What runs where | Model-map card | all of them except Muse Code, which we have not used |

### 1. The four problems (0:00-0:20)
Shot: four cards, one per problem, each held about 4 seconds over a still of a real sticker. No voice-over reading from a script on screen; the cards carry the text.

Narration:
"Most studios can sell an original once, locally. Artists with disabilities are employed at about half the rate of others. Buyers never meet the maker. And people who are blind cannot put their ideas on paper. The 3rd Eye answers all four."

Fallback: none needed (stills).

### 2. Describe it out loud, VoiceOver on (0:20-0:55)
Creator: **June Park** (signed in beforehand). Capture: phone over the shoulder for the first 5 seconds (June's hand, VoiceOver on), then the phone's screen recording.

Steps and what the viewer sees:
1. Create tab > Sticker > Next > "Describe it, we draw it for you". Speak opens; VoiceOver reads "Start talking".
2. June says: "a green frog wearing a tiny red hat". Muse Voice Transcribe 1.0 turns it into text; the card reads "YOU SAID, a green frog wearing a tiny red hat".
3. If Muse Spark 1.3 asks a clarifying question, VoiceOver announces it and the "QUESTION" card shows it. Answer in one short sentence.
4. "Drawing your idea" screen: the "I HEARD" card shows the shaped prompt while Muse Image 1.0 draws.
5. **Voice result: VoiceOver reads the description card.** Hold this for the full sentence: "WHAT THE IMAGE SHOWS, ..." is Muse Spark 1.3's description. Cut to the card as text so deaf viewers get it too.
6. "Say what to change", say "add a gold crown", the new picture and its new description arrive. "Use this".

Narration (leave about 10 s silent for VoiceOver speech and the generation wait):
"June is one of our example artists; she is blind. She says her idea out loud. Muse Voice Transcribe writes it down, and Muse Spark turns it into a prompt. Muse Image draws it. Muse Spark then describes the picture, and VoiceOver reads that to her."

Fallback: if the live generation takes more than 40 seconds or fails, cut to `fallback-voice.mov` (the rehearsal take). If the phone microphone fails, use "Type instead" with the keyboard's dictation key and say so in the narration ("she uses dictation here"). With `AI_FIXTURES=1` on a local server the whole flow runs offline with synthetic art, but fixtures are not Meta output; do not use them for the final cut and do not narrate them as models.

### 3. Photograph a toy, adjust the cutout (0:55-1:15)
Creator: **Leo** (signed in beforehand). Capture: simulator capture (the simulator uses a photo from the library) or the phone. Show the toy on the table for 2 seconds first.

Steps:
1. Create > Sticker > Next > "Snap your drawing" (or "Pick one you already have" in the simulator), then "Take a photo". "Finding your drawings…" shows while SAM 3.1 works; the toy comes back as 2 or 3 numbered pieces.
2. **Adjust cutout:** tap pieces 1 and 2 to combine them (both selected; the line under the photo reads "Got 2 pieces. They are cut out together."), tap "Apply cutout". The cutout appears on the checkerboard. Optionally show "Draw a box" trimming a stray piece.
3. "Use this". Design ready: "Your sticker is ready!" with the die-cut sticker preview and "Put it up for sale now?". Listing details, "Tell buyers your story" and "You're live" follow in the app; this shot stops at Design ready.

Narration:
"Makers who do not draw can photograph what they made. SAM 3.1 finds the pieces. If it split the toy in two, the maker combines the pieces, and we cut a clean sticker."

Fallback: if SAM returns nothing on stage, use the stored photo of the bear or wallet from rehearsal (`fallback-adjust.mov`). Do not retry on camera more than once.

### 4. A buyer finds it (1:15-1:40)
Capture: screen recording of https://the-3rd-eye.vercel.app in a phone-sized browser window. Product: Leo's bus sticker (or the sticker just published).

Steps: shop home ("A story you can hold.") > The collection > the product page ("The story behind it") > "Buy this piece": enter a name, "Buy for {price}" (the page says "Demo checkout: no payment is taken yet.") > "Thank you!" with the "Open the story tag" link.

Narration:
"A buyer finds the sticker in the shop and sees who made it. Checkout is staged in this demo: it creates the order but takes no payment. After buying, the buyer gets a link to the story tag."

Fallback: the shop has seeded products and orders; if the live site is slow, use a recording made in rehearsal.

### 5. The creator says thank you (1:40-2:05)
Capture: simulator capture of the Orders tab, then the phone for the 10-second video.

Steps: Orders tab shows the new order (the list refreshes about every 10 seconds, there is no push notification) > Order detail > thank-you composer > record a 10-second video > send. Mention the story-draft sheet: after the story video, "Here's a story we drafted from your video" offers "Use this story", "Edit it" or "Skip".

Narration:
"The creator sees the order arrive and records a short thank-you; Muse Voice Transcribe adds captions. Muse Glimmer, an open-weight model on our own Mac through Ollama, drafts the artist's story from their words. The artist can use it, edit it, or skip it."

Fallback: if Ollama is down, the stage uses Muse Spark 1.3 and the response says `provider: "meta-fallback"`; narrate it honestly ("Spark covers when the Mac is off"). If recording fails, use `fallback-thankyou.mov`.

### 6. The sticker, the tap, the reply (2:05-2:40)
Capture: over the shoulder for the print and tap; screen recordings for the page and the creator app.

Steps:
1. Show the printed die-cut sticker (print PNG and die SVG downloaded from `/admin`). Show the NFC tag on the back. The physical sticker and tag are planned for the physical test on Oct 30 (method: a standard NFC writer app); until they exist, use the QR route in the fallback and do not narrate a tap.
2. **Tap the sticker with the buyer phone.** `/t/<token>` opens: the artist's captioned video, the thank-you, the note box.
3. Buyer types a reply and sends it.
4. **Switch to the creator app, Messages tab: the reply arrives** (within about 10 seconds of polling). Show it.

Narration:
"The sticker carries an NFC tag. The buyer taps it and meets the artist, with captions. The buyer writes back, and the reply shows up in the creator's app."

Fallback: if the tag does not read, scan the QR code on `/admin` for the same order (the tag page is the same URL). If the reply is slow, cut to `fallback-reply.mov`. The iOS app does not write tags; the planned method is a standard NFC writer app.

### 7. What runs where (2:40-3:00)
Capture: one card listing the models, then the vote ask over the logo.

Narration:
"Muse Voice Transcribe 1.0 hears. Muse Spark 1.3 shapes, describes and writes the listing. Muse Image 1.0 draws. SAM 3.1 cuts. Muse Glimmer drafts stories on our own hardware. We built this from October 27 to November 4. Please vote for The 3rd Eye."

Fallback: none needed.

## Edit notes
- Keep VoiceOver audio audible in shot 2; lower any music under it.
- Burn in captions for all narration.
- Do not show a creator code, a bearer token, the admin password or `.env.local`. Blur the URL bar if a sign-in link is visible.
- Label example creators as fictional in the end card.
- Narration totals 276 words (counted with wc -w: 42, 46, 33, 38, 44, 29, 44); each shot is written to fit its slot at 2.5 words a second. Time a read-through before recording; none has been done yet.
