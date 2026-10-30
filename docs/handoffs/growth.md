# Handoff · growth

## Owns
`README.md`, `docs/demo_script.md`, the review of `docs/accessibility.md`, `docs/handoffs/growth.md`.

## Current task
T093 · demo script, README refresh, accessibility test scripts (docs only). Done on branch `feat/growth-T093`.

## Interface exposed to others
- `docs/demo_script.md` is the recording plan; if a screen label changes, update the narration and steps there.
- The README's model map and "real vs staged" list must match `docs/architecture.md`; change both together.

## Footage still needed from the founder (phone shots)
All on a real iPhone, VoiceOver on unless noted. Record 2 takes each, plus the fallback take named in `docs/demo_script.md`.
1. Over-the-shoulder, 5-10 s: June's hand on the phone, VoiceOver reading "Start talking" (shot 2).
2. Screen recording: Say it out loud > "a green frog wearing a tiny red hat" > question (if any) > Voice result with VoiceOver reading the "WHAT THE IMAGE SHOWS" card > "Say what to change" > Use this (shot 2). Keep the audio.
3. The stitched toy (or wallet) on a table, 2-3 s, then the phone photographing it (shot 3). The Adjust-cutout combine can be the simulator capture, but a phone take is better.
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
- **Description (about 150 words):** Studios that support artists with disabilities can usually sell an original once, locally. Artists with disabilities are employed at about half the rate of others, buyers never meet the maker, and people who are blind are left out of visual art. In The 3rd Eye, artists who draw or make things photograph their work and SAM 3.1 cuts it out; the artist can combine pieces or draw a box to fix the cut. Artists who cannot draw describe an idea out loud and Meta's models turn it into art and describe the result so VoiceOver can read it back. Each artwork becomes a die-cut sticker or a tote, sold in a web shop. Every product ships with an NFC tag that opens a short captioned video of the artist. Buyers can write back, and the artist sees the reply in the iOS app.
- **Models used:** Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`): spoken ideas and video captions. Muse Spark 1.3 (`muse-spark-1.3`): prompt shaping, image descriptions, listing agent, story-draft fallback. Muse Image 1.0 (`muse-image-1.0`): artwork, refinements, mockups. SAM 3.1 (`sam-3.1`): cutouts and die-cut outlines. Muse Glimmer 30B via Ollama (`muse-glimmer`): open-weight story drafts on our own hardware. Muse Code is not listed: add it only if a session is recorded in `docs/`.
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
- iOS: the Adjust cutout and My designs scripts have not been run with VoiceOver on a device.

## Last updated
2026-10-30
