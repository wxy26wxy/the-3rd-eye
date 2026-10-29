# maker story — brief

Our app helps artists with disabilities turn their art into products people want to buy. Artists who draw snap a photo, and Meta's Segment Anything Model (SAM 3.1) cuts out the artwork. Artists who can't draw, like people who are blind, describe their idea out loud. Muse Spark shapes the description into an image prompt, Muse Image generates the art, and Muse Spark then writes a description of the result that the phone reads back to them so they can refine it. The art becomes stickers and tote bags, and each one ships with an NFC story tag that plays a short video of the artist talking about their work.

This solves three problems: studios can only sell one-off originals locally, artists with disabilities struggle to earn income and recognition, and buyers never get to know the person behind what they buy.

## The longer version: four problems

1. **Art that can't sell at scale.** Most art studios serving people with disabilities can only sell original pieces locally, and once a piece sells, it's gone. We turn one artwork into products that can be sold again and again, with no inventory.
2. **Talent without income or recognition.** People with disabilities are employed at about half the rate of people without disabilities. We give them a way to earn money and be recognized as artists.
3. **No connection between buyers and creators.** Buyers usually have no idea who made what they're buying. Our NFC story tag lets them hear directly from the artist, which makes the product more meaningful and a better gift.
4. **People who can't draw are left out.** People who are blind or have low vision have visual ideas too, but they can't put them on paper. By describing their idea out loud and letting AI generate the image, they can become creators too.

## Models used (exact names)

| Stage | Model |
|---|---|
| Speech to text (prompts, stories, captions) | Muse Voice Transcribe 1.0 (`muse-voice-transcribe-1.0`) |
| Shape a spoken idea into an image prompt; describe results; listing agent | Muse Spark 1.3 (`muse-spark-1.3`) |
| Generate and refine artwork; product mockups | Muse Image 1.0 (`muse-image-1.0`) |
| Find and cut out drawings; sticker die-cut outline | SAM 3.1 (`sam-3.1`) |
| Draft creator stories from transcripts (open weights) | Muse Spark Open via Baseten (`meta-models/muse-spark-open-1026`) |
| Development tooling | Muse Code |

There is no Meta text-to-speech model. Descriptions are written by Muse Spark and spoken by the device (iOS `AVSpeechSynthesizer`, web `speechSynthesis`).

## Hackathon

Meta Global AI Developer Hackathon, Startups track, problem statement "Build for Your World". Building period Oct 27 – Nov 4, 2026. Everything in this repository was built during that period.
