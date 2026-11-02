# The 3rd Eye — brief

Our app helps artists with disabilities turn their art into products people want to buy. Every piece starts from the artist's own work: they snap a photo of a drawing or a sketch (or upload one), and Meta's Segment Anything Model (SAM 3.1) finds the drawings in it so they can pick one. Then they change it until it is theirs: they say what to change (Muse Voice Transcribe writes it down) or type it, Muse Image edits the picked piece, which it receives as the input image, and Muse Spark describes the result so they can compare before and after on screen or hear it read by the phone's screen reader. They can change it again, go back to the original, or keep it as is. SAM 3.1 cuts the final piece out, and it becomes a sticker or a tote bag. Each one ships with an NFC story tag that plays a short video of the artist talking about their work.

This solves four problems: studios can only sell one-off originals locally, artists with disabilities struggle to earn income and recognition, buyers never get to know the person behind what they buy, and people who can't draw well can't finish the piece they imagine.

## The longer version: four problems

1. **Art that can't sell at scale.** Most art studios serving people with disabilities can only sell original pieces locally, and once a piece sells, it's gone. We turn one artwork into products that can be sold again and again, with no inventory.
2. **Talent without income or recognition.** People with disabilities are employed at about half the rate of people without disabilities. We give them a way to earn money and be recognized as artists.
3. **No connection between buyers and creators.** Buyers usually have no idea who made what they're buying. Our NFC story tag lets them hear directly from the artist, which makes the product more meaningful and a better gift.
4. **People who can't draw well still can't finish the piece they imagine.** With a photo of a sketch and their voice, they change it until it is theirs.

## Models used (exact names)

| Stage | Model |
|---|---|
| Speech to text (the spoken change instruction, story and thank-you captions) | Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`) |
| Describe each result (before and after, alt text, what differs from the request); listing agent | Muse Spark 1.3 (`muse-spark-1.3`) |
| Edit the picked piece with the change instruction (the piece is the input image); product mockups | Muse Image 1.0 (`muse-image-1.0`) |
| Find the drawings in a photo; cut out the picked or changed piece (the creator can fix the edges: add or remove areas, or draw a box); sticker die-cut outline | SAM 3.1 (`sam-3.1`) |
| Draft creator stories from transcripts (open weights, on our own hardware) | Muse Glimmer 30B via Ollama (`muse-glimmer`), with Muse Spark 1.3 as fallback |
| Development tooling | none claimed (Muse Code was considered and not used; see README) |

The text-to-image routes (shape a prompt, generate from text, refine) remain in the backend, unused by the apps since v0.8 and still tested (`docs/api.md`).

There is no Meta text-to-speech model. Descriptions are written by Muse Spark and shown as text; on iOS the system's VoiceOver reads them (the app has no speech engine of its own), on the web a "Read aloud" button uses `speechSynthesis`.

## Hackathon

Meta Global AI Developer Hackathon, Startups track, problem statement "Build for Your World". Building period Oct 27 – Nov 4, 2026. Everything in this repository was built during that period.

Source for problem 2: U.S. Bureau of Labor Statistics, *Persons with a Disability: Labor Force Characteristics — 2025* (2026-03-03), employment-population ratio ages 16–64: 38.1 % with a disability vs 74.8 % without. <https://www.bls.gov/news.release/disabl.nr0.htm>
