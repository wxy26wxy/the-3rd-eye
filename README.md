# The 3rd Eye

Artists with disabilities turn their art into stickers and tote bags that ship with an NFC story tag. Buyers tap the tag to meet the artist.

This repository is the entry for the Meta Global AI Developer Hackathon (Startups track, "Build for Your World"). Everything here was built during the building period, Oct 27 – Nov 4, 2026.

- `web/` — Next.js app: public shop, story-tag pages, admin, and the JSON API used by the iOS app
- `ios/` — SwiftUI creator app (XcodeGen project). Builds and passes its tests in the simulator; not yet run end to end on a phone against the deployed API
- `design/` — design tokens, the single source of truth for both platforms
- `docs/` — brief, plan, decisions, progress, API contract, runbooks
- `scripts/` — token generator, seed, fixtures, repository checks

See `docs/brief.md` for the product and the exact Meta models used.

## Status (v0.1, Oct 29)
- **Captions.** Story and thank-you videos get English captions from Muse Voice Transcribe when the client sends a WAV of the video's soundtrack (`audioUrl`, see `docs/api.md`). The mobile web flow extracts it in the browser; the iOS app extracts it with AVAssetReader. If a client cannot extract the sound, the video is saved without captions (no stale captions are kept).
- **Open-weight stage (Muse Glimmer).** After a story video is captioned, Muse Glimmer drafts the artist's shop story from their own words; the artist chooses Use, Edit or Skip, and "Mention my disability" (off by default) tells the model whether it may mention disability at all. Glimmer runs through Ollama on the team's development Mac (M3 Max); during the demo the app runs against that Mac. On Vercel Ollama is not reachable, so the same stage falls back to Muse Spark 1.3 and every response says `provider: "meta-fallback"`.

