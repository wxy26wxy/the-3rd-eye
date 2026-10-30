# Accessibility

Accessibility is a requirement for every screen, not polish. This page lists what each client must do and how to check it by hand.

## Both clients
- Every image has alt text; generated artwork carries `altText` and `spokenDescription` from the API, and both clients show the description as text, not only as sound.
- Every control has a label a screen reader can read; icon-only buttons have a text label and a hint.
- Touch targets are at least 44 pt / px; primary actions are 60.
- Colours and sizes come from `design/tokens.json` (tokens only, no raw values), including the high-contrast palette.
- Motion respects reduced-motion settings.
- Anything the app tells the person (arrival messages, questions, errors, results, the "I HEARD" confirmation while drawing) is visible on screen.

## Web
- Semantic elements (`button`, `label`, headings in order), visible focus rings, `prefers-reduced-motion`, alt text on every `img`.
- Creator preferences in `accessPrefs` (`voiceFirst`, `simpleMode`, `speakDescriptions`, `highContrast`, `largeText`, `helperMode`) are stored on the creator profile. The web reads `speakDescriptions`; there is no settings screen for them on either client today, so they change only through the API (`PUT /creators/me`) or the seed.

## iOS
The app uses iOS's own accessibility settings instead of copying them (decision 2026-10-29, T081):
- **Speaking instead of typing:** the keyboard's dictation key. Text fields have no mic buttons. The voice idea path ("Say it out loud") and "Say what to change" record audio and send it to Muse Voice Transcribe; those are product features, not accessibility settings.
- **Hearing descriptions and messages:** VoiceOver. The app has no text-to-speech. Text that matters on arrival (the drawing confirmation, the clarifying question, the image description, "Your design is ready!", "You're live!", "Video saved!", the story talking points, the drafted story, listing messages) is on screen and posted once as a VoiceOver announcement.
- **Bigger text:** Dynamic Type, up to the largest accessibility size.
- **Contrast:** Settings → Accessibility → Display & Text Size → Increase Contrast switches the app to the high-contrast palette.
- **Simple mode:** still honoured. It defaults to on and no client can change it today (API or seed only); with it on the app asks for one picture, so the pager in step 6 below needs a creator with `simpleMode: false` (the mock: sign in with a code starting `MULTI`).
- Pictures are single VoiceOver elements labelled with their alt text; cards that belong together (eyebrow + text) read as one element.

### VoiceOver test script (Speak → Voice result)
Run on a phone or simulator with VoiceOver on (Settings → Accessibility → VoiceOver, or the Accessibility Inspector in the simulator), signed in.
1. Create tab → swipe to "Sticker, Die-cut around your art", double-tap. Swipe to "Say it out loud, Describe it, we draw it", double-tap.
2. "Say it out loud" screen: VoiceOver reaches the "YOUR IDEA" card, then "Start talking" (record button). Double-tap, say "a frog with a crown", double-tap again ("Stop"). The card now reads "YOU SAID, a frog with a crown". (Or use "Type instead" and the keyboard's dictation key.)
3. Double-tap "Done". If a question comes back, VoiceOver announces it and the "QUESTION" card shows it; answer with "Answer out loud" or by typing, then "Done".
4. Drawing screen: VoiceOver announces the confirmation (for example "A happy frog with a gold crown. Drawing it now."), which is also shown in the "I HEARD" card.
5. Voice result: VoiceOver announces the description. Swipe through: "YOU SAID, …", the picture (its alt text, "Image"), then "WHAT THE IMAGE SHOWS, …" with the full description. There is no "Hear" or "Stop" button.
6. With several pictures (`simpleMode` off), each picture reads "<alt text>, picture n of 3"; swipe left/right on it to change pictures. The description card and the announcement follow the selected picture.
7. "Change it" → "Say what to change" (record) or the "Change" field → "Make the change". The new picture's description is announced and shown.
8. "Use this" → "Your design is ready!" is announced.
Also check once with Increase Contrast on (high-contrast colours, no grain) and with the largest Dynamic Type size (text wraps, nothing clipped).
