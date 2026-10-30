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

### VoiceOver test script (iOS: Adjust cutout)
Needs a creator who can use the photo branch. Simulator: Create > Sticker > "Take a photo" falls back to the photo library. Use a photo of a toy or a drawing that SAM 3.1 splits into 2 or more pieces. Not yet run on a phone with VoiceOver (see docs/handoffs/ios.md).
1. On the Adjust cutout screen VoiceOver reads the title, then "Your photo", then the mode buttons, then the pieces strip. The numbered labels on the photo are hidden from VoiceOver, so each piece is read once, as "Piece 1", "Piece 2" (checkbox behaviour).
2. Focus "Piece 1". It reads "Piece 1, selected" (or "Not selected") with the hint "Leaves it out of the cutout" / "Adds it to the cutout". Double-tap toggles it; the state change is read.
3. With "Piece 1" focused, swipe up or down to open the actions. Expected: "Box around this piece", "Add the area around this piece", and "Leave this piece out" (only while the piece is selected). Run "Add the area around this piece": a mark is added and "Added area, mark 1" appears as a mark that can be deleted (hint "Deletes this mark").
   - Focus "Added area, mark 1" and double-tap: the mark is deleted and "Mark removed" is announced. This is the mark's accessibility action (T091); XCUITest cannot run it, because a test tap goes to the photo's touch layer instead, so check it here. Repeat with Switch Control if available.
4. Select two pieces, double-tap "Apply cutout". The result is shown as text ("Your cutout") and "Use this" becomes available.
5. The mode buttons' hint says to use the piece actions instead of dragging. Check that no step needs a drag or a tap on the photo itself.
6. Check once with the largest Dynamic Type size: the three mode buttons stack vertically and nothing is clipped.

### VoiceOver test script (iOS: My designs)
Signed in as a creator who has a few designs (a draft, one in the shop, one that failed).
1. My designs tab: each tile is a single element, read as "<alt text>, <badge>", where the badge is "In the shop", "Draft", "Didn't work", "Cutting out..." or "Needs a cutout". A tile without an image shows a symbol; no endless spinner.
2. Hint on a tile: "Opens the design. More actions are in the actions list." Swipe up or down: "Make a sticker" (only when no sticker is in the shop) and "Delete". Run "Delete": a confirmation appears; confirm, and the tile disappears.
3. Double-tap a tile to open the design. Swipe through: the large picture, the badge, the products (type, title, status), then the buttons ("Edit listing", "Make a sticker" or "Make a tote", "Re-do the cutout", "See it in the shop", "Delete").
4. "Re-do the cutout" opens Adjust cutout; run the script above, then "Use this" returns to the design.
5. (T091) With a design in progress in Create (pick Sticker, then leave), open a design and double-tap "Make a sticker": the dialog "Replace the design you're making?" is read with its message and "Replace it" / "Cancel". On a design with a sticker in the shop and a sticker draft, the button reads "Continue the sticker draft" and its dialog says "This continues your sticker draft…" with "Yes, continue the draft".

### VoiceOver test script (web: Select screen)
Safari on iPhone with VoiceOver on, or macOS Safari with VoiceOver (Control+Option+arrows), at `/create`, signed in, Sticker > photo. Same checks work with keyboard only (Tab, Space, Enter).
1. The heading "Pick your art" is read first, then the sentence "We found n pieces. Pick one, or several to combine them." and the group "Pieces found".
2. Each piece is a checkbox labelled "Piece n"; Space or double-tap toggles it, and the state is read.
3. Under each piece there is a group with the buttons "Box around this piece" and "Add the area around this piece". Activate one: the status line reads "Box drawn" or "Mark added". The hint "With a keyboard or screen reader, use the buttons under each piece instead." is on screen.
4. The mode group "What a tap on the photo does" is a set of three radio buttons ("Add area", "Remove area", "Draw a box"); arrow keys or swipes move between them and the checked one is read.
5. "Apply cutout" shows "Saving the cutout..." then "Your cutout is saved. Here it is." in a status region that VoiceOver reads without moving focus. "Show the cutout" and "Back to photo" toggle the picture, whose alt text is "Your cutout".
6. Tab order follows the visual order; every focused control has a visible focus ring; with `prefers-reduced-motion` on there is no animation.
