# Submission materials

One section per field of the submission form, in form order. The form takes plain text only, so every answer below is plain text with no markdown: paste it as it is. `[FOUNDER: …]` marks the four things only the founder can fill: the video link, the X post link and the two scale values.

Due: 2026-11-04, 9 PM ET. Track: Startups. Problem statement: "Build for Your World".

---

## Most Viral Track — X post

Single post (under 280 characters as X counts them):

An artist with a disability draws something. They photograph it, say "make the sky purple", and get a sticker with a tag that plays their own story. The drawing stays theirs the whole way. Built on Meta's SAM 3.1, Muse Image, Muse Spark and Muse Voice. https://the-3rd-eye.vercel.app

Thread (3 posts):

1/ Studios that support artists with disabilities sell an original once, locally, and then it is gone. The 3rd Eye turns one drawing into stickers and totes that sell again and again, and half of every sale goes to the artist. https://the-3rd-eye.vercel.app

2/ The artist photographs their drawing and SAM 3.1 finds it, no tracing. They say what to change and Muse Image edits that drawing, not a new one. Muse Spark writes down what changed, so a screen reader can read it. Nothing is redrawn behind their back.

3/ Every sticker carries an NFC tag. Tap it and the artist tells you about the piece in their own voice, with captions, and you can write back. Our entry for the Meta Global AI Developer Hackathon; the demo: [FOUNDER: video link]

---

## Project Description

The 3rd Eye helps artists with disabilities turn their art into products people want to buy. The artist snaps a photo of their drawing and Meta's SAM 3.1 cuts the artwork out. They say what to change, Muse Voice writes it down, and Muse Image changes their own drawing rather than painting a new one. Muse Spark reads a description of the result back to them, so an artist who cannot see the screen can still hear what changed and refine it. The art becomes stickers and tote bags, and each one ships with an NFC tag that plays a short video of the artist talking about their work, with captions.

It solves four problems:

1. Art that can't sell at scale. Most studios serving people with disabilities can only sell original pieces locally, and once a piece sells, it's gone. We turn one artwork into products that can be sold again and again, with no inventory.

2. Talent without income or recognition. People with disabilities are employed at about half the rate of people without disabilities. We give them a way to earn money (half of every sale by default) and to be recognized as artists.

3. No connection between buyers and creators. Buyers usually have no idea who made what they buy. Our NFC story tag lets them hear directly from the artist, which makes the product more meaningful and a better gift.

4. Finishing the piece they imagine. Many artists can draw the first version but not the second: a different colour, a bird on the leaf, a bolder line. By saying the change out loud and hearing the result described, they finish the piece themselves, and the drawing stays theirs.

Real: every model call, the creator flow on iOS and the web, the shop and the print files. Staged: payment (no charge is taken) and fulfilment (by hand). The example artists are fictional and labelled as such.

---

## Public GitHub Repository

https://github.com/wxy26wxy/the-3rd-eye

Start with the README section "Try it in 3 minutes". docs/architecture.md has the model ids and request shapes; docs/reviews/ has the written review of every merged change, and a review of the whole repository by Muse Spark 1.3 with our triage (docs/reviews/2026-11-04-muse-spark-review.md).

---

## 3-Minute Demo Video

[FOUNDER: video link]

What it shows: June, a fictional example artist, photographs a drawing; SAM 3.1 finds it; he says what to change and Muse Image edits his own drawing; VoiceOver reads Muse Spark's description of the change; the piece becomes a sticker; a buyer orders it (no payment taken); June records a thank-you; the printed sticker's NFC tag opens his captioned video and the buyer writes back.

---

## Describe your use of Meta products

Each model covers one thing a disabled artist may not be able to do alone.

See. SAM 3.1 finds the drawing in a phone photo, so the artist never has to trace or select pixels. Its mask also becomes the sticker's die-cut line. Muse Image 1.0 receives that drawing as its input image and applies the artist's change to it, so the result is still their drawing. The same model renders the product photo.

Speak. Muse Voice Transcribe 1.0 turns the spoken change ("make the sky purple") into the instruction, and turns the artist's story video into captions.

Hear. Muse Spark 1.3 writes what the image shows and what changed as structured text, so VoiceOver reads every result aloud. It also names the things in a photo so SAM can find the subject, and runs the listing agent that drafts the shop listing.

Their own words. Muse Glimmer (open weights, through Ollama) drafts the artist's shop story from the video transcript; the artist uses, edits or skips it. On the deployed site Muse Spark covers this stage.

Models used: sam-3.1 (find the drawing, cut it out, die-cut line), muse-image-1.0 (edit the artist's drawing as the input image, product photo), muse-voice-transcribe-1.0 (spoken changes, video captions), muse-spark-1.3 (descriptions for VoiceOver, naming the subject for SAM, the listing agent with tools and moderation), muse-glimmer (story drafts). Every call is logged and readable per artwork at /admin/trace. Code: web/lib/ai/meta/ in https://github.com/wxy26wxy/the-3rd-eye

---

## Why are Meta's models important to your solution?

Three things made this possible, and we did not find them elsewhere in one API.

Muse Image edits the artist's own picture. It takes the drawing as the input image and changes only what was asked, so an artist who cannot draw a second version still ends up with their drawing, not a machine's.

SAM 3.1 finds a hand-drawn piece in an ordinary phone photo, and finds a knitted toy or a clay figure just as well. The artist frames it with two fingers and the model does the rest; the cut it makes is accurate enough to print as the die-cut line.

Muse Spark returns its descriptions as structured text, not prose to parse. That is what lets a blind or low-vision artist hear exactly what changed and decide, and what lets us show the same words on screen for everyone else.

---

## Feedback from your experience using partner technologies

What worked
- One Responses-API client covered Spark, Image and SAM; strict JSON schemas, function tools and reasoning effort behaved as documented.
- SAM's streaming parser gave us masks with little code, and box prompts used the same request shape as phrases.
- Strict JSON for descriptions and listings: the fields come back the way we validate and show them, which keeps screen-reader text predictable.
- Muse Image editing with an input image kept the artist's drawing recognisable through several changes.
- Muse Glimmer through Ollama drafted usable stories from a 30-second transcript.

What cost time
- Voice Transcribe accepts WAV only, and our host has no ffmpeg, so the phone and the browser encode WAV themselves, including the soundtrack of every story video.
- There is no Meta text-to-speech model; the phone's own voice reads Spark's descriptions.
- We found no documented edit request for Muse Image and had to verify one live; the output is always 1600×1600 with no transparency, so SAM does the cut-out afterwards.
- SAM takes one phrase per request, so each photo costs two or more calls plus our own merge.

Three wishes
- Voice Transcribe: accept M4A or WebM and return word timestamps.
- Muse Image: a documented edit mode with a mask or a transparent result.
- SAM 3.1: several phrases in one request.

---

## How likely are you to build with Meta Model API?

Likely. Five models shipped in nine days through one client; the audio format and the undocumented edit shape were the friction. [FOUNDER: scale value]

## Overall opinion of Meta Model API

Positive. Editing with an input image and finding a drawing in a photo are what made a photo-first creator flow possible; clearer docs for edits and audio would save the next team days. [FOUNDER: scale value]

---

## Checklist before submitting

- [x] The repository is public and the link opens signed out.
- [x] The production alias https://the-3rd-eye.vercel.app serves the release (`docs/deployments.md`).
- [ ] The 3-minute video is uploaded and its link opens signed out; the `[FOUNDER: …]` links above are filled.
- [ ] The judge creator code and the admin password are in the form's notes field only, never in the repository or the video.
- [x] README screenshots match the current build (Nov 4).
- [x] The printed sticker and its NFC tag were tested on a phone (Nov 4).
- [x] `bash scripts/check_clean.sh` prints `check_clean: ok` on the submitted commit.
