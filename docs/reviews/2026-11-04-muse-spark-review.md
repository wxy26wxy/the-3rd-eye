# Review of the repository by Muse Spark 1.3 (2026-11-04)

A review written by Meta's Muse Spark 1.3 (`muse-spark-1.3`, Responses API, reasoning effort medium, `store: false`; 30,297 input tokens, 2,725 output tokens) from the README plus a digest of `docs/architecture.md`, `web/lib/pipeline/artworks.ts`, `web/lib/ai/meta/sam.ts`, `web/lib/ai/meta/story.ts`, `web/app/media/[...path]/route.ts`, `web/lib/media-access.ts` and `web/components/site/VideoPoster.tsx`. The model saw the code as of main 43197ce. Asked for: what is well done, defects or risks with the smallest fix, accessibility gaps, and three questions a judge would ask. Below is its answer verbatim, followed by the PM's triage of each defect.

## The model's review

1) What is well done
- web/lib/pipeline/artworks.ts changeInput(): squares picked piece on white with 10% margin capped at 1024px before Muse Image edit, avoids stretching tall/wide art to 1600x1600 output.
- web/lib/ai/meta/sam.ts untilCompleted(): injects synthetic response.output_text.done when API skips it, directly addresses streaming gap noted in docs/architecture.md.
- web/lib/media-access.ts + web/app/media/[...path]/route.ts: pure canReadMedia() with explicit PUBLIC_KINDS, creator-own, admin, ?tag= thank-you-only checks; 302 to presigned URL preserves range requests for video.
- web/components/site/VideoPoster.tsx: starts playback from useEffect after prefers-reduced-motion check, never via autoplay attribute; keeps captions on while muted.
- web/lib/ai/meta/story.ts rejectEcho() + viaOllama() native then /v1 then meta-fallback: catches Glimmer answering instructions with JSON instead of story, records provider meta-fallback in ai_calls.

2) Defects or risks
- web/lib/media-access.ts canReadMedia(): isStoryVideo=true grants anyone. In web/app/media/[...path]/route.ts GET it is checked via isStoryVideoPath(pathname) after other checks. Any historical story video becomes world-readable if pathname known; disability disclosure cannot be revoked. Fix: only current published story-video public, require ownership otherwise.
- web/app/media/[...path]/route.ts REDIRECT_CACHE private, max-age=540, Vary: Authorization, Cookie: signed 302 cached per browser keyed without tag/auth state. Buyer with ?tag= token or creator session can reuse URL after sign-out/token rotation for 9 min. Fix: no-store for tag-authorized and creator-private redirects, or Vary on query + no cache.
- web/lib/pipeline/artworks.ts cutPieces() via runAfterResponse(): full-size cuts with CUT_CONCURRENCY=2 after response on Vercel. Function may be frozen/killed, leaving candidates without cleanedUrl and orphaned blobs; unbounded memory on 4096px images. Fix: queue to durable job or cut lazily on pick.
- web/lib/ai/meta/story.ts hardTimeout(): Promise.race without aborting fetch, noted live 15-min /v1 hang while Ollama busy. Leaks connections, can exhaust Vercel concurrency. Fix: AbortController abort on timeout plus single-flight.
- web/lib/pipeline/artworks.ts clipAlpha(): JS per-pixel loop over full alpha e.g. 4096px longest side ~16M ops blocking Node, risks 270s deadline/504. Fix: move to sharp mask operation or wasm.
- web/lib/pipeline/artworks.ts createFromImage(): if storage().delete(uploadPath) fails it only warns; public source photo stays public under unguessable URL. Home interior, faces remain exposed. Fix: retry delete, expire uploads, or upload direct to private.
- web/lib/ai/meta/story.ts storyInstructions(false): Do NOT mention disability even if transcript does. Silently censors artist's own story while claiming first-person voice. Fix: filter only when artist did not say it, keep self-description verbatim.
- web/components/site/VideoPoster.tsx playWithSound(): v.focus() targets video with tabIndex=-1 after play button unmounts; keyboard focus lost. muted state stays true when prefers-reduced-motion sets v.muted=false. Fix: keep focus on visible Turn sound on button, sync state from element.

3) Accessibility gaps
- README + docs/accessibility.md: VoiceOver pass over Change it, Before and after, Your cutout, My designs not yet run on device; iOS shots use mock API where Before/After match, so blind artist has not validated Muse Spark description differences_from_prompt read by VoiceOver.
- Adjust the area screen docs/images/ios-adjust-the-area.png: drag corners/edges with round handles plus Reset only. No keyboard, slider, or tap-to-nudge alternative for motor-impaired artist; reload loses local photo per docs/architecture.md.
- README Accessibility: web Welcome title on photo ~2.6-2.8:1 fails WCAG AA 4.5:1; No Meta TTS, web Read aloud uses speechSynthesis with no rate/voice control or text highlighting for low-vision.
- docs/architecture.md Live findings Voice Transcribe: no timestamps, captions spread over audioDurationMs. Deaf buyers/artists get unsynced story-video and thank-you captions; no caption-edit screen shown.
- iOS polling every ~10s, no push per README: motor-impaired artist must keep app open to learn order/message arrived; error/confirm announced as visible text only, no haptic/audio confirmation described.

4) Three questions a judge would ask
- Payments are staged PAYMENTS_MODE=staged, auth is development-grade creator codes, Glimmer runs on a dev Mac, NFC writing and fulfilment are by hand: what works on the live site without you in the room?
- Each re-frame uploads a new crop as a new artwork row with no delete yet T146, and each change builds a new product: how do you prevent private originals and draft products from accumulating and leaking?
- Voice instruction becomes Muse Image edit input_image plus listing-agent prompt: how do moderation, prompt-injection, and artist consent work when voice changes the art that is sold?

## PM triage of the defects (2026-11-04)

1. Story videos world-readable by pathname: **accepted as designed.** Story videos are public by policy (they play on the creator page and every product page to anyone); the pathnames are unguessable UUIDs. A revoked or replaced video is a real gap: the old blob stays readable by its pathname until deleted. Follow-up: delete the previous story-video blob when a new one is stored.
2. Cached 302 for tag- and creator-scoped media: **partly accepted.** The redirect is cached per browser for 9 minutes; a buyer who had a valid tag token keeps the signed link for that window. The signed link itself expires in 10 minutes, so the exposure is bounded. Follow-up: `no-store` on tag- and creator-authorised redirects.
3. Background cuts after the response on Vercel: **accepted as a known trade-off** (T155). The cuts run two at a time at a 2048 px cap, inside the function's remaining time; a missing cut falls back to the old re-cut on pick, so nothing is lost, only slower. Orphaned blobs are possible when a cut is skipped late.
4. `hardTimeout` without aborting the fetch: **accepted.** The native Ollama call does carry an abort signal (`callSignal`); the `/v1` path relies on the SDK's timeout. Follow-up: abort on timeout and single-flight per creator.
5. Per-pixel `clipAlpha` on the main thread: **noted.** At the 2048 px cap it is about 4 million operations, under 100 ms; the 4096 px figure predates T155.
6. Source photo left public if the delete fails: **accepted.** Follow-up: retry the delete and expire uploads.
7. "Do not mention disability" filter in `storyInstructions(false)`: **disagree with the framing, keep the behaviour.** The setting is the artist's own choice ("Mention my disability", off by default); when it is off, the draft leaves it out and the artist can still write it in by hand. The model's point stands for a different design (opt-out at the sentence level), not this one.
8. Focus after "Turn sound on" and the muted state under reduced motion: **partly wrong.** The `muted` state follows the element's `volumechange` event, so it does update; focus moving to the player after the button disappears was a deliberate choice in the autoplay review. Keeping focus on a visible control would need the button to stay; noted as a possible refinement.

Accessibility gaps 1, 2 and 4 are real and already listed in `docs/accessibility.md` and `docs/risks.md` (the VoiceOver pass on a device, keyboard-free frame adjustment, captions spread evenly over the audio because Voice Transcribe returns no timestamps). Gap 3 is recorded as a design exception. Gap 5 (polling, no haptics) is a limitation of the hackathon build.

Items 1, 2 and 6 were fixed in T160 (`feat/backend-T160`): the replaced story video is deleted, scoped media redirects are `no-store`, the public-upload delete is retried once.
