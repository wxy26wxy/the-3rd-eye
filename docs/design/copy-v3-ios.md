# Copy diff v3 · iOS (`ios/App/Resources/Localizable.xcstrings`)

Source: Figma file key `WVJuvNJnfcNaAqOW6jWeWi`, Changelog frame `2043:4304` (entries 1–12, 2026-11-01), and the text read from each B1/B2 board on 2026-11-01 (T110). The catalogue keys are the English strings, so "Old" is the key in `Localizable.xcstrings` today and "New" replaces it (new key, old key deleted when no view uses it). The file named in the last column is where the old string is used today (grep, 2026-11-01). Sample data on the boards ("Make the book red", "Reading Monster Sticker", $5.00, the monster description) is not copy. **PM default** = not on a board, chosen so the implementer is not blocked (listed again at the end).

The iOS UI tests find controls by these labels (`VoiceFlowUITests`, `AdjustCutoutUITests`, `DesignsUITests`, `SignOutUITests`): change the test labels in the same commit.

## Entry 4 · Change it (B1: `2011:208`, `2011:246`, `2011:293`, `2011:334`, `2021:2169`, `2021:2216`, `2012:276`, `2012:307`, `2012:344`, `2012:387`)

Flow (entries 4 and 7): Camera / photo library → Choose a pattern → **Change it** (`2012:387`) → Making your cutout → Your cutout → Making your sticker → Listing details. Voice-only creation is gone.

### Change it (entry) `2012:387` (was Voice result · Change it)
| Old (key) | New | Where today |
|---|---|---|
| Here's your idea | Change your art? | `VoiceResultView` |
| — | Your art (Art preview label chip, component `4021:4470`) | new |
| WHAT THE IMAGE SHOWS | unchanged | `VoiceResultView` |
| WHAT SHOULD I CHANGE? | unchanged | `VoiceResultView` |
| — | What to change (text field label; placeholder "Make the book red" is sample) | new (replaces "Change" as the field label) |
| Change | What to change | `VoiceResultView` field label |
| Make the frog green | Make the book red (placeholder, sample) | `VoiceResultView` |
| Say what to change | unchanged (record button) | `VoiceResultView` |
| Make the change | unchanged (primary inside the panel) | `VoiceResultView` |
| Use this | **Looks good as is** (pinned bottom action; goes to Making your cutout with the original piece) | `VoiceResultView` |
| Keeps this picture for your product | Keeps your art as it is and goes on (hint, PM default) | `VoiceResultView` |
| Swipe left or right for other pictures | **removed** (no 3-picture chooser) | `VoiceResultView` |
| %@, picture %lld of %lld | **removed** | `VoiceResultView` |

### Change it · Listening `2011:208`, Typing `2011:246`, Clarifying question `2011:293`, Microphone off `2011:334`, Transcribing `2021:2169`, Error `2021:2216` (were Speak · …)
| Old (key) | New | Where today |
|---|---|---|
| Say it out loud (screen title) | Change your art | `SpeakView` |
| Tell me what you want to see. Colors, animals, words, anything. | Say or type what to change. Your original stays safe. | `SpeakView` |
| — | Your art (Art preview label) | new |
| Tap the big button and talk. Your words will show up here. | Tap the big button and say what to change. Your words will show up here. | `SpeakView` |
| YOUR IDEA | WHAT TO CHANGE | `SpeakView` |
| Your idea (accessibility label of the card / field) | What to change | `SpeakView` |
| Type your idea | Type what to change | `SpeakView` |
| Write your idea instead of saying it (hint) | Write what to change instead of saying it (PM default, follows the label) | `SpeakView` |
| Done | Make the change | `SpeakView` |
| Turns your words into a picture (hint) | Changes your art the way you asked (PM default) | `SpeakView` |
| LISTENING, Stop, Type instead, Start talking, Hide the keyboard box, Writing down what you said…, One quick question, QUESTION, Answer out loud, YOU SAID (Typing, Clarifying question, Error) | unchanged | `SpeakView` |
| Microphone access is off. You can turn it on in Settings, or type instead. | unchanged (`2011:334`) | `SpeakView` |
| Can't reach %@. Check your connection and try again. | unchanged (`2021:2216`) | — |
| Your idea is missing. Go back and say it again. | Your art is missing. Go back and pick it again. (PM default) | `DrawingYourIdeaView` |

### Changing your art `2012:276`, Error `2012:307` (were Drawing your idea)
| Old (key) | New | Where today |
|---|---|---|
| Drawing your idea | Changing your art | `DrawingYourIdeaView` |
| I HEARD | YOU ASKED | `DrawingYourIdeaView`, `LoadingScreen` |
| Making your picture now. This can take up to a minute. | Changing your art now. This can take up to a minute. | `DrawingYourIdeaView` |
| Something went wrong. Please try again. / Try again | unchanged (`2012:307`) | — |
| Go back (error action) | Back to my art | `DrawingYourIdeaView` (keep "Go back" where `ListingDetailsView`, `FindingDrawingsView`, `LoadingScreen` still use it) |

Changelog text for the shared error string: "The drawing did not work this time." → "The change did not work this time." (web wording; the iOS board shows the generic "Something went wrong. Please try again.").

### Change it · Before and after `2012:344` (was Voice result)
| Old (key) | New | Where today |
|---|---|---|
| Here's your idea | Here's the change | `VoiceResultView` |
| YOU SAID | YOU ASKED (on this board only) | `VoiceResultView` |
| You said: %@ (VoiceOver) | You asked: %@ | `VoiceResultView` |
| — | Before | new (Art preview label) |
| — | After | new (Art preview label) |
| WHAT THE IMAGE SHOWS | unchanged | `VoiceResultView` |
| Different from what you said: %@ | Different from what you asked: %@ (PM default; from `differences_from_prompt`, R2) | `VoiceResultView` |
| Use this | unchanged (primary; goes to Making your cutout with the changed art) | `VoiceResultView` |
| Change it | Change it again | `VoiceResultView` |
| — | Back to my original (text action; switches to the parent artwork, R2) | new |
| Changing it… | unchanged | `VoiceResultView` |
| Draws a new version with your change (hint) | unchanged | `VoiceResultView` |

## Entry 7 · Choose a pattern, Your cutout, Making your cutout

### Choose a pattern `2013:408` (was Adjust cutout)
| Old (key) | New | Where today |
|---|---|---|
| Pick your art | Tap the one you want. | `AdjustCutoutView` |
| We found %lld pieces. Pick one, or several to combine them. | We found %lld drawings in your photo. Pick one to change and turn into a sticker. (tote: "…turn into a tote bag.", same pattern) | `AdjustCutoutView` |
| We found one piece. Change the cutout with the tools below. | We found one drawing in your photo. Use it to change and turn into a sticker. (PM default; tote variant as above) | `AdjustCutoutView` |
| Tap a piece below to pick it. / Got piece %lld! Tap another piece to add it too. / Got %lld pieces. They are cut out together. | **removed** (single pick, no message line on the board) | `AdjustCutoutView` |
| Piece %lld, Not selected | unchanged (pieces strip; radio-group behaviour: one can be picked) | `AdjustCutoutView` |
| Use this | unchanged (goes to Change it) | `AdjustCutoutView` |
| Retake | unchanged on this screen | `AdjustCutoutView` |
| Add area, Remove area, Draw a box, Clear marks, Apply cutout, mark badges and their hints | removed from this screen (they move to Your cutout) | `AdjustCutoutView` |
| Box around this piece / Add the area around this piece / Leave this piece out | removed on Choose a pattern (the board annotation still lists them as piece actions; with a single pick and no tools they have nothing to do: PM default remove) | `AdjustCutoutView` |

### Your cutout `2013:618` (was Adjust cutout · Preview)
| Old (key) | New | Where today |
|---|---|---|
| Your cutout | unchanged (now the title) | `AdjustCutoutView` |
| — | Here's the cutout of your changed art. Fix the edges if you need to. | new |
| — | Here's the cutout of your art. Fix the edges if you need to. (Looks good as is path, PM default) | new |
| Your cutout is saved. Here it is. | Your cutout is ready. Here it is. | `AdjustCutoutView` |
| Add area / Remove area / Draw a box | unchanged (edge tools kept) | `AdjustCutoutView` |
| Tap the photo where the cutout should include more. Tap a mark again to remove it. | unchanged | `AdjustCutoutView` |
| Clear marks / Apply cutout / Use this | unchanged | `AdjustCutoutView` |
| Back to photo | **removed** | `AdjustCutoutView`, `AdjustCutoutUITests` |
| Shows your photo with the marks again (hint) | removed with it | `AdjustCutoutView` |
| Retake | Start over | `AdjustCutoutView` |
| Takes a new photo (hint) | Starts again from the camera (PM default) | `AdjustCutoutView` |
| Saving the cutout… | Cutting out your art… | `AdjustCutoutView` |
| Pieces strip, Show the cutout | removed (pieces strip and Back to photo removed on this board) | `AdjustCutoutView` |

### Making your cutout `4030:4482` (new board, clone of Changing your art)
| Old (key) | New |
|---|---|
| — | Making your cutout |
| — | Your art (Art preview label) |
| — | Cutting out your art. This takes a few seconds. |

## Entry 8 · Making your sticker `2014:733` (was Listing details · Making your sticker)
Logo mark instead of Back (no back while busy). Loading animation slot `4037:4389`, 342×342, radius 24: `Tokens.Asset.stickerLoading` MP4 (muted, looped; Reduce Motion → first frame, paused).

| Old (key) | New | Where today |
|---|---|---|
| Listing details (title while making) | Making your sticker | `ListingDetailsView` (keep "Listing details" for the form, `2014:678`, and in `EditListingSheet`, `DesignDetailView`, tests) |
| Check the name and price, then list it. (while making) | Adding the white border and getting it ready to print. | `ListingDetailsView` (keep the old string on the form `2014:678`) |
| Making your sticker. This can take up to a minute. | unchanged | `ListingDetailsView` |

## Entry 11 · tote bag (`4038:4494`, `4038:4517`, B2 `4038:4389`)
| Old (key) | New | Where today |
|---|---|---|
| — | Making your tote bag | new |
| — | Placing your art on the bag and getting it ready to print. | new |
| Putting your art on a tote bag. This can take up to a minute. | Making your tote bag. This can take up to a minute. | `ListingDetailsView` |
| Your tote bag is ready! | unchanged | — |
| Listing details · Tote bag `4038:4517` | same strings as the sticker form | — |
| Home · Create tab · Tote bag selected `4038:4389` | same strings as `2015:783` (no copy change) | — |

## Not on a changed board, but voice-only creation is removed everywhere (R7, entry 4)
| Old (key) | New | Where today |
|---|---|---|
| Say it out loud (method option) | **removed** | `ChooseMethodView`, `VoiceFlowUITests` |
| Describe it, we draw it for you | **removed** | `ChooseMethodView` |
| NO DRAWING SKILL NEEDED | **removed** | `ChooseMethodView` |
| How do you want to make it? | How do you want to add your art? (web board `2026:2998`; same flow) | `ChooseMethodView` |
| Choose how to make your art (VoiceOver) | Choose how to add your art (PM default) | `ChooseMethodView` |
| Opens this way of making art (hint) | unchanged | `ChooseMethodView` |
| Draw it or say it. We make the sticker or tote. | Snap or upload your art. We make the sticker or tote. (**PM default**: the iOS Welcome board `21:4229` is unchanged, but its sentence promises the removed voice path; this is the web Welcome sentence from entry 5) | `WelcomeView` |
| A happy frog wearing a crown (voice placeholder) | removed with the voice idea screen | `SpeakView` |

## Entries 1–3, 5–6, 9–10, 12
Web or layout only; no iOS copy. Entry 9 (Outfit) is in tokens; entry 10 (GIF) is the animation above.

## Strings with no board (PM defaults, flagged to the designer)
"Keeps your art as it is and goes on" · "Write what to change instead of saying it" · "Changes your art the way you asked" · "Your art is missing. Go back and pick it again." · "Different from what you asked: %@" · "We found one drawing in your photo…" · "Here's the cutout of your art…" (original path) · "Starts again from the camera" · "Choose how to add your art" · the iOS Welcome sentence · removing the per-piece actions on Choose a pattern.
