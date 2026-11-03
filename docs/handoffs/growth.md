# Handoff · growth

> Read `docs/context.md` first: the shared state for every lane and session (flow, rules, infra, open items).

## Owns
`README.md`, `docs/demo_script.md`, `docs/submission.md`, the review of `docs/accessibility.md`, `docs/handoffs/growth.md`.

## Current task
T125 · submission materials draft (docs only): `docs/submission.md`, one section per form field in form order, ready to paste, plus a checklist before submitting. Branch `feat/growth-T125`. Every `[FOUNDER: …]` placeholder in that file is for the founder (video and post links, the two rating scale values). The draft below ("Submission form") is superseded by `docs/submission.md` for the form fields it covers.

## Interface exposed to others
- `docs/demo_script.md` is the recording plan; if a screen label changes, update the narration and steps there.
- The README's model map and "real vs staged" list must match `docs/architecture.md`; change both together.
- `docs/submission.md` restates the model map, file paths, real vs staged and the demo beats; change it with the README, `docs/architecture.md` and `docs/demo_script.md`.

## Footage still needed from the founder (phone shots)
All on a real iPhone, VoiceOver on unless noted. Record 2 takes each, plus the fallback take named in `docs/demo_script.md`.
1. Over-the-shoulder, 5-10 s: June's rough pencil sketch on the table and the phone photographing it, VoiceOver on (shot 2).
2. Screen recording: Choose a pattern > "Use this" > Change it > "Say what to change" > "make the book red, and give him a yellow raincoat" > question (if any) > "Make the change" > Changing your art (shot 2). Keep the audio.
3. Screen recording, continuing take 2: Before and after with VoiceOver reading the "WHAT THE IMAGE SHOWS" card > "Use this" > Making your cutout > Your cutout > "Use this" > Making your sticker > "Your sticker is ready!" (shot 3). The simulator is fine as a backup, a phone take is better.
4. Thank-you video, 10 s, front camera (shot 5).
5. (After the Oct 30 physical test; not done yet) The printed die-cut sticker: close-up of the front and the NFC tag on the back (shot 6).
6. Tapping the sticker with the buyer phone, the page opening, the captioned video playing (shot 6). Backup: scanning the QR from `/admin`.
7. The buyer typing a reply, then the creator app's Messages tab with the reply arriving (shot 6). Use two phones or one phone and the simulator.
8. Still of a real sticker for each of the four problem cards (shot 1).
9. Open question for the founder: a person with a disability on camera? Only with their consent; otherwise keep to hands, screens and products.

## Submission form (draft; fill the placeholders)
- **Project title:** The 3rd Eye
- **Track and problem statement:** Startups, "Build for Your World"
- **One-liner:** The 3rd Eye turns art by people with disabilities into stickers and tote bags with an NFC tag that plays the artist's own story.
- **Description (about 150 words):** Studios that support artists with disabilities can usually sell an original once, locally. Artists with disabilities are employed at about half the rate of others, buyers never meet the maker, and people who can't draw well can't finish the piece they imagine. In The 3rd Eye, an artist photographs or uploads their own sketch and SAM 3.1 finds the drawings in it; they pick one. Then they say or type what to change: Muse Voice Transcribe writes the request down, Muse Image edits their piece, and Muse Spark describes the result so they can compare before and after, with VoiceOver reading it on iOS. They can change it again or go back to the original. SAM cuts the piece out and it becomes a die-cut sticker or a tote, sold in a web shop. Every product ships with an NFC tag that opens a short captioned video of the artist. Buyers can write back, and the artist sees the reply in the iOS app.
- **Models used:** Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`): the spoken change request and video captions. Muse Spark 1.3 (`muse-spark-1.3`): descriptions of each result, listing agent, story-draft fallback. Muse Image 1.0 (`muse-image-1.0`): edits of the artist's picked piece (the piece is the input image), mockups. SAM 3.1 (`sam-3.1`): finding the drawings in a photo, cutouts and die-cut outlines. Muse Glimmer 30B via Ollama (`muse-glimmer`): open-weight story drafts on our own hardware. Muse Code is not listed: add it only if a session is recorded in `docs/`.
- **How the models are used / what is staged:** copy the "real and staged" list from `README.md`.
- **Built when:** Oct 27 - Nov 4, 2026.
- **Demo video link:** `<VIDEO_URL>`
- **Live site:** https://the-3rd-eye.vercel.app
- **Repository link:** `<REPO_URL>`
- **iOS app (TestFlight) link:** `<TESTFLIGHT_URL>`
- **Team and contact:** `<TEAM_NAMES>`, `<CONTACT_EMAIL>`
- **Demo access for judges:** a creator code for a hidden judge account issued from `/admin`: `<ISSUE_AND_PASTE_PRIVATELY>`. Do not put codes in the repository.

## Open questions for other roles
- QA: confirm the labels used in `docs/demo_script.md` and the VoiceOver scripts on a phone.
- iOS: the Change it, Before and after, Your cutout and My designs scripts have not been run with VoiceOver on a device.

## Last updated
2026-11-02 (T125: submission materials draft)
