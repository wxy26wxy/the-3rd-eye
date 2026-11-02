# Accessibility

Accessibility is a requirement for every screen, not polish. This page lists what each client must do and how to check it by hand.

## Both clients
- Every image has alt text; generated artwork carries `altText` and `spokenDescription` from the API, and both clients show the description as text, not only as sound.
- Every control has a label a screen reader can read; icon-only buttons have a text label and a hint.
- Touch targets are at least 44 pt / px; primary actions are `size.cta`, 56 points tall (Sky tokens, T100; the public Accessibility page says 56 since T106).
- Colours and sizes come from `design/tokens.json` (tokens only, no raw values), including the high-contrast palette.
- Motion respects reduced-motion settings.
- **Contrast:** every text meets WCAG AA (4.5:1, 3:1 for large text) except the web Welcome title, which sits on a photo by design: white on the bare sky measures a median 2.7–2.8:1 in the title band and 2.6:1 at its brightest 10 % (T110, sampled from `design/assets/hero-sky.png`; the designer's Changelog estimate is about 2.5:1, and the 2.4–2.7:1 in the v2 table below is the T100 sample of the sky, not of the v3 title band). It is an accepted exception at the owner's request (ruling R5, v3 flag 1 below); the iOS Welcome keeps its scrim.
- Anything the app tells the person (arrival messages, questions, errors, results, the "YOU ASKED" line while the art is being changed) is visible on screen.

## Web
- Semantic elements (`button`, `label`, headings in order), visible focus rings, `prefers-reduced-motion`, alt text on every `img`.
- Creator preferences in `accessPrefs` (`voiceFirst`, `simpleMode`, `speakDescriptions`, `highContrast`, `largeText`, `helperMode`) are stored on the creator profile. The web reads `speakDescriptions`; there is no settings screen for them on either client today, so they change only through the API (`PUT /creators/me`) or the seed.

## iOS
The app uses iOS's own accessibility settings instead of copying them (decision 2026-10-29, T081):
- **Speaking instead of typing:** the keyboard's dictation key. Text fields have no mic buttons. Since v3 (T110) the only voice feature is "Say what to change" on Change it (the voice idea path "Say it out loud" is removed); it records audio and sends it to Muse Voice Transcribe; those are product features, not accessibility settings.
- **Hearing descriptions and messages:** VoiceOver. The app has no text-to-speech. Text that matters on arrival (the change being made, the description on Before and after, "Your cutout is ready. Here it is.", "Your sticker is ready!" (or "Your tote bag is ready!"), "You're live!", "Video saved!", the story talking points, the drafted story, listing messages) is on screen and posted once as a VoiceOver announcement.
- **Bigger text:** Dynamic Type, up to the largest accessibility size.
- **Contrast:** Settings → Accessibility → Display & Text Size → Increase Contrast switches the app to the high-contrast palette.
- **Simple mode:** still stored. It defaults to on and no client can change it today (API or seed only). In v0.7 it limited the voice path to one picture; that path and its 3-picture pager are removed in v0.8, so no v0.8 screen is expected to change with it.
- Pictures are single VoiceOver elements labelled with their alt text; cards that belong together (eyebrow + text) read as one element.

### VoiceOver check (iOS: Sky tab bar, T103) — to confirm by ear in test round 3
The Home tab bar is a SwiftUI drawing inside a `UITabBar` host that exposes one element per tab (XCUITest sees one tab bar with four buttons and the selected state; `TabBarUITests`). What VoiceOver says has not been heard yet. On a device with VoiceOver on:
1. Swipe to the tab bar. Expected: "Create, selected, tab, 1 of 4" (or the system's equivalent wording); then "My designs, tab, 2 of 4", "Orders, tab, 3 of 4", "Messages, tab, 4 of 4". No separate stops for the icons.
2. With an unread order, Orders reads "… 2 new".
3. Double-tap My designs: it becomes selected and the My designs screen shows. Double-tap it again on a pushed design: back to the grid.
4. If "tab" or the position is missing, note the exact reading in the test-round notes; the fallback is to set the `.tabBar` trait on a plain container view (see the T103 decision).

### VoiceOver test script (iOS: Choose a pattern → Change it → Before and after, v0.8)
Run on a phone or simulator with VoiceOver on (Settings → Accessibility → VoiceOver, or the Accessibility Inspector in the simulator), signed in. Labels are the v3 copy (`docs/design/copy-v3-ios.md`). Not yet run on a phone.
1. Create tab → swipe to "Sticker, Die-cut, waterproof", double-tap, "Next". "How do you want to add your art?" offers two rows only: "Take a photo" and "Upload a picture" (there is no voice row). In the simulator choose "Upload a picture" and a photo of a drawing with two or more pieces.
2. **Choose a pattern:** VoiceOver reads the title "Tap the one you want.", then "We found n drawings in your photo. Pick one to change and turn into a sticker." The photo is one image element, "Your photo with the drawings we found". Each piece is read once, "Piece 1", "Piece 2", with its selected state ("Not selected" when off); picking one unpicks the other (single pick). Double-tap "Use this".
3. **Change it:** the title "Change your art?", then "Say or type what to change. Your original stays safe.", the picture ("Your art" and its alt text, one element), "WHAT THE IMAGE SHOWS, …", then "WHAT SHOULD I CHANGE?", the field "What to change", the record button "Say what to change", "Make the change" (hint "Changes your art the way you asked") and the pinned "Looks good as is" (hint "Keeps your art as it is and goes on"). Everything is on this one screen; there is no separate speaking screen.
4. Double-tap "Say what to change": "LISTENING" is read and the button becomes "Stop". Say "make the book red", double-tap "Stop". "Writing down what you said…" is shown, then "You said: make the book red" is announced and the words land in the "What to change" field, where they can be edited. (Typing instead: dictate with the keyboard's dictation key into the same field.) With the microphone off, the record button's error says "Microphone access is off. You can turn it on in Settings, or type instead." and the field still works.
5. Double-tap "Make the change". (iOS asks no clarifying question in v0.8: the change API has none.)
6. **Changing your art:** "Changing your art now. This can take up to a minute." is announced and the "YOU ASKED" card shows the request. On an error, "Something went wrong. Please try again." with "Try again" and "Back to my art".
7. **Before and after:** the result is announced. Swipe through: "Here's the change", "YOU ASKED, make the book red" (one element), "Before" (the picked piece, its alt text), "After" (the changed picture, its alt text), "WHAT THE IMAGE SHOWS, …" with the full description, and "Different from what you asked: …" when Muse Spark noted a difference. Then "Use this", "Change it again" (hint "Draws a new version with your change") and "Back to my original". There is no "Hear" or "Stop" button: VoiceOver is the voice.
8. "Back to my original" returns to the picked piece with no wait (nothing is lost; the change stays a saved draft). "Change it again" goes back to Change it with the changed picture as "Your art".
9. "Use this" → **Making your cutout**: "Making your cutout" and "Cutting out your art. This takes a few seconds." are read; the screen then moves to Your cutout (script below). From Change it, "Looks good as is" goes the same way with the picked piece.
Also check once with Increase Contrast on (high-contrast colours, no grain) and with the largest Dynamic Type size (text wraps, nothing clipped, "Looks good as is" and "Use this" stay reachable).

### VoiceOver test script (iOS: Your cutout → Making your sticker, v0.8)
Continues the script above. Not yet run on a phone.
1. **Your cutout:** VoiceOver reads the title "Your cutout", then "Here's the cutout of your changed art. Fix the edges if you need to.", the cutout picture ("Your cutout: <alt text>"), "Your cutout is ready. Here it is.", the edge tools "Add area", "Remove area", "Draw a box", "Fix the edges", then "Use this", "Apply cutout" and "Start over" in the bar.
2. The edge tools must work without a drag and without tapping a spot on the photo. Double-tap "Fix the edges"; the photo is one element, "Your photo, image". Swipe up or down on it for its actions: "Box around your art" and "Add the area around your art" (on the piece the cut-out was made from; on the whole photo when no drawing was found, where "Use this" alone cuts out the whole photo).
3. Run "Add the area around your art": "Added area, mark 1" appears as a mark that can be deleted (a mark made in "Remove area" reads "Left out, mark n") (hint "Deletes this mark"); double-tap it: the mark is deleted and "Mark removed" is announced (the T091 action, which XCUITest cannot run).
4. Double-tap "Apply cutout": "Cutting out your art…" then "Your cutout is ready. Here it is." is announced and shown.
5. "Use this" → **Making your sticker**: "Making your sticker" and "Adding the white border and getting it ready to print." are read; the looping animation is decorative (hidden from VoiceOver) and with Reduce Motion on it shows a still frame. There is no Back while it is busy. For a tote: "Making your tote bag" and "Placing your art on the bag and getting it ready to print."
6. "Your sticker is ready!" (or "Your tote bag is ready!") is announced, then Listing details follows as before.
7. Check once with the largest Dynamic Type size: the three edge tools stack vertically and nothing is clipped.

### VoiceOver test script (iOS: My designs)
Signed in as a creator who has a few designs (a draft, one in the shop, one that failed).
1. My designs tab: each tile is a single element, read as "<alt text>, <badge>", where the badge is "In the shop", "Draft", "Didn't work", "Cutting out..." or "Needs a cutout". A tile without an image shows a symbol; no endless spinner.
2. Hint on a tile: "Opens the design. More actions are in the actions list." Swipe up or down: "Make a sticker" (only when no sticker is in the shop) and "Delete". Run "Delete": a confirmation appears; confirm, and the tile disappears.
3. Double-tap a tile to open the design. Swipe through: the large picture, the badge, the products (type, title, status), then the buttons ("Edit listing", "Make a sticker" or "Make a tote", "Re-do the cutout", "See it in the shop", "Delete").
4. "Re-do the cutout" opens Your cutout; run the edge-tool steps of the Your cutout script above, then "Use this" returns to the design.
5. (T091) With a design in progress in Create (pick Sticker, then leave), open a design and double-tap "Make a sticker": the dialog "Replace the design you're making?" is read with its message and "Replace it" / "Cancel". On a design with a sticker in the shop and a sticker draft, the button reads "Continue the sticker draft" and its dialog says "This continues your sticker draft…" with "Yes, continue the draft".

### VoiceOver test script (web: Choose a pattern → Change it → Before and after → Your cutout, v0.8)
Safari on iPhone with VoiceOver on, or macOS Safari with VoiceOver (Control+Option+arrows), at `/create`, signed in, Sticker > "Upload a picture". Same checks work with keyboard only (Tab, Space, Enter). Labels are the v3 copy (`docs/design/copy-v3-web.md`). Not yet run.
1. **Welcome:** the heading "Your art, on things people love." is read as one heading (the forced line breaks are not in the accessible name), then "Start creating" and "I already have an account". The title is white on the sky photo, the accepted contrast exception (see "Designer flags (v3)" below); check it with zoom at 200 % and note how it reads.
2. **Choose method:** "How do you want to add your art?" with two options, "Take a photo" and "Upload a picture"; no voice option.
3. **Choose a pattern:** the heading "Tap the one you want." is read first, then "We found n drawings in your photo. Pick one to change and turn into a sticker." and the group "Drawings found". Each piece ("Piece n") is a single-choice control; the selected one is read as selected. "Use this" goes on.
4. **Change it:** heading "Change your art?", the picture labelled "Your art", "What the image shows", the field "What should change?", "Start talking", "Make the change" and "Looks good as is". With the microphone denied, the lead reads "We can't use the microphone, so type what to change. Your original stays safe." and an alert card says "We can't use the microphone. You can type instead."; the field still works.
5. "Make the change" → **Changing your art**: the status "This takes about a minute. Tag is working on it." is read without moving focus. On an error: "The change did not work this time." with "Try again" and "Back to my art".
6. **Before and after:** heading "Here's the change", "You asked …", the "Before" and "After" pictures (each with alt text), "What the image shows" with "Hear what the image shows" (browser `speechSynthesis`), then "Use this", "Change it again" and "Back to my original". Focus lands on the heading when the result arrives.
7. "Use this" → **Making your cutout** ("Making your cutout", "Cutting out your changed art.") → **Your cutout**: "Your cutout", "Here's the cutout of your changed art.", "Your cutout is ready. Here it is." in a status region, then "Fix the edges", "Use this" and "Start over".
8. "Fix the edges": "Fix the edges if you need to. Tap the photo to add or remove an area." The keyboard and screen-reader path needs no pointer or drag (the T113 controls; confirm the readings on the build):
   - The group "Drawings found" holds one checkbox per piece, "Piece n"; Space or double-tap toggles it and the state is read.
   - Under each piece, a group with the buttons "Box around this piece" and "Add the area around this piece". Activate one: the status region reads "Box drawn" or "Mark added" without moving focus.
   - The hint "With a keyboard or screen reader, use the buttons under each piece instead." is on screen. When no pieces were found it reads "With a keyboard or screen reader, use the whole photo instead." and the button "Use the whole photo" is the path.
   - The mode group "What a tap on the photo does" is a set of three radio buttons ("Add area", "Remove area", "Draw a box"); arrow keys or swipes move between them and the checked one is read.
   - The "Marks" list shows each mark as a button, for example "Added area, mark 1. Remove this mark"; activating it removes the mark and "Mark removed" is announced. "Clear marks" empties the list ("Marks cleared").
   - "Apply cutout" shows "Cutting out your art…" then "Your cutout is ready. Here it is." in the status region.
   Pass: a keyboard-only user can add an area, draw a box around a piece and remove a mark without clicking the photo; fail: write down the control and what it read.
9. **Making your sticker:** "Making your sticker" and "Adding the white border and getting it ready to print."; the animation has empty alt text and, with `prefers-reduced-motion` on, shows a still frame.
10. Tab order follows the visual order on every screen; every focused control has a visible focus ring.

## Designer flags (Sky, T100)
Raised on the Figma file (key `vIOMPzc2kjP18BbgduLmc8`) during the T100 intake. Contrast ratios computed from the token hex values (WCAG 2.x relative luminance).

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| ink `#111827` on white | 17.7:1 | body, titles, CTA label on white | pass |
| ink on page `#FCFCFC` | 17.3:1 | headlines | pass |
| textMuted `#6B7280` on page | 4.7:1 (4.8:1 on white) | descriptions, 15 px | pass AA, little margin: do not lighten |
| ink on accent `#65C361` | 8.0:1 | selected card title | pass |
| greenDeep `#173D2B` on accent | 5.5:1 | selected card caption, 13 px | pass |
| greenDeep on `#E4F3C8` | 10.3:1 | method icons | pass |
| white on accent | 2.2:1 | not used on the boards | never use for text |
| white on the sky photo | 2.4–2.7:1 (sky), ~1.5:1 (pink cloud) | Welcome headline, body, "I already have an account" | **fails**: needs `color.scrim` (v3: still so on iOS; the web Welcome title is the accepted exception, see "Designer flags (v3)") |
| white on sky under the scrim `rgba(0,0,0,0.35)` | 5.3–5.7:1 (sky), ~3.5:1 (cloud) | same | passes for the 48 px headline everywhere; body text must sit over sky, not cloud, or the scrim is a gradient that is darkest behind the text |
| border `#D1D5DB` on white | 1.5:1 | unselected card and secondary pill outline | below 3:1 for UI boundaries; the card is still found by its label and radio, the pill by its text. Flagged to the designer |
| text field border textMuted `#6B7280` on white / on `#F3F4F6` | 4.8:1 / 4.4:1 | web text inputs and textareas (`ui/Field`, T102 fix round 1) | pass 3:1 for input boundaries; inputs never use the `#D1D5DB` hairline because an empty field has no label inside it to find |
| focus `#1E3A24` on white / on accent | 12.5:1 / 5.7:1 | focus ring | pass (kept from Direction A); the web ring is ink `#111827`, 2 px, 2 px offset since T102 |
| forced colours (Windows High Contrast) | system colours | web choice cards and option rows | the selected card gets a `Highlight` border, outline and radio; the check glyph of unselected cards is hidden with `visibility`, not colour (T102 fix round 1) |

1. **White text on the sky photo needs a scrim.** Token `color.scrim` = `rgba(0,0,0,0.35)` (also `semantic.scrim`) is added now. Welcome lays it under the text block (or as a top-to-bottom gradient ending in it) on both clients.
2. **13 px is the floor for all text.** Captions on the boards are 13 px (`type.bodyS`), and `type.caption` is 13 (ruling; the brief said 12). The one exception is `type.eyebrow`, 11 px caps with 0.08em tracking, for short labels such as "NO DRAWING SKILL NEEDED". All sizes scale: Dynamic Type through `relativeTo:` on iOS, `rem`-based sizes on the web from T102.
3. **No visible step indicator on the boards.** The step pill is retired; each flow screen keeps the VoiceOver hint "Step n of 3" (iOS `accessibilityHint`, web visually hidden text) so the position in the flow is still announced.
4. **24 px radio is fine** because the whole product card is the target (one control, at least 44 px, label = product name and description, selected state announced). The radio is decoration inside it.
5. **"I already have an account"** is 14 px text on Welcome; give it a 44 px tall tap area (padding, not a larger font).
6. **Primary CTA** is 56 px tall (was 60): above the 44 px minimum. "Both clients" above now says 56; `common.md` (outside the repo docs) still says 60 and should follow.
7. **Icon-only parts:** the arrow circle in the CTA and the chevrons on method cards are decorative (hidden from VoiceOver); the button's text is its label.

## Designer flags (v3, T110)
Raised at the v3 intake (2026-11-01; file key in the newest row of the intake log in `docs/design/screens.md`). Ratios are WCAG 2.x, computed from the token hex values; photo ratios were sampled from `design/assets/hero-sky.png`.

| Pair | Ratio | Use | Verdict |
|---|---|---|---|
| ink `#111827` on accentSoft `#E4F3C8` | 15.2:1 | shop and product chips, method icon circles | pass |
| greenDeep `#173D2B` on accentSoft | 10.3:1 | chip text in green | pass |
| textMuted `#6B7280` on accentSoft | 4.1:1 | — | do not use for text on accentSoft |
| greenDeep on accent `#65C361` | 5.5:1 | selected card caption | pass (the brief's 5.9 was an estimate; measured 5.48) |
| inkSoft `#374151` on white / page / surfaceAlt | 10.3:1 / 10.1:1 / 9.4:1 | muted text on the story-tag sheet (T106) and v3 secondary text | pass (darker than v2's `#263A35`, still well above 4.5) |
| white on scrimStrong (ink 72 %) over the sky photo | 8.2–9.1:1 (7.0:1 even over pure white) | text on photos where a scrim is used | pass |
| white on scrim (ink 55 %) over the sky photo | 4.9–5.8:1 (4.0:1 over pure white) | nav drawer, iOS Welcome | pass on the sky photo; use scrimStrong over bright or unknown photos |
| white on the bare sky, Welcome · Web `2026:2865` | median 2.7–2.8:1 in the title band (top third), 2.6:1 at its brightest 10 % | web Welcome title and copy | **fails 4.5:1 and 3:1: accepted exception (R5)**, see 1 |
| ink on the bare sky (text action "I already have an account") | about 6.4:1 | web Welcome text action | pass |

1. **Welcome · Web on the bare sky (accepted exception, ruling R5).** The designer removed the panels (entry 5) and then the top gradient (entry 6) at the owner's request; the white title sits on the photo at about 2.5–2.9:1. The board wins. Mitigations that do not change the look: the title is real text (an `h1`, 48 px Bold, large text) so screen readers and zoom work; the board has no body line, so no body-size text is on the bare sky; under `prefers-contrast: more` the page may add `--scrim` behind the text block (implementer's choice, not required). README says contrast passes "for every text except the web Welcome title, which sits on a photo by design". The iOS Welcome (`21:4229`) is unchanged and keeps its scrim.
2. **Outfit draws capital I and lowercase l alike** (designer's own note, entry 9). Words like "Ill" read ambiguously out of context. No code change (R6): sign-in codes are safe because their alphabet (`web/lib/codes.ts` `CODE_ALPHABET`) has no I, L, O, 0 or 1. Flag kept for the designer.
3. **Loading animation is 1x.** `sticker-loading.gif` is 320×320 in a 342×342 slot (about 1.07x upscaled on a 1x screen, soft on 2x/3x). 2x pending from the designer. Under reduced motion (iOS Reduce Motion, web `prefers-reduced-motion`) show the first frame still, no autoplay; the status line above it carries the meaning, so the animation is decorative (no alt text, hidden from VoiceOver).
4. **Shop hero text sits on `color/page` beside the photo, never on it** (Note · Hero motion: frame `2035:4133`, its text `2035:4134`). The v2 scrim panel and its 5.08:1 worst pixel no longer apply. No hero motion; any future motion stops under reduced motion.
5. **"Add to bag" opens a sheet** (R1): the sheet is a modal dialog with a visible title ("Buy this piece"), focus moves into it and returns to "Add to bag" on close; the quantity stepper's − and + have the accessible names "Fewer" and "More" and the value is announced (copy diff, web).
6. **Size options and quantity** are a radio group (Size) and a labelled number control (Quantity), not colour-only chips; the selected size has a border and a check, as product cards do.
