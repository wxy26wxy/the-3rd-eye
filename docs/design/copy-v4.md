# Copy diff v4 · feedback round 2 (iOS and web)

Source: the owner's test of v0.8-rc1 (2026-11-02, rulings R1–R8 of feedback round 2) and the boards changed or added in the designer's file on 2026-11-03 (Changelog entry 13; node ids in `docs/design/screens.md`, "Feedback round 2"). One file for both platforms because every change applies to both creator flows. Apply these rows verbatim.

- **Web** (`web/messages/en.json`): "Key" is the proposed key; keys marked **new** are proposals (rename if a component needs a different shape, keep the English text). "Old" is the string in `en.json` today.
- **iOS** (`ios/App/Resources/Localizable.xcstrings`): the catalogue keys are the English strings, so the key is the string itself; format placeholders are `%@` (text) and `%lld` (integers). "Old" is the key in the catalogue today; delete an old key when no view uses it any more.
- **PM default** = not on a board; chosen so the implementer is not blocked (listed again at the end).
- The iOS UI tests find controls by label (`AdjustCutoutUITests`, `VoiceFlowUITests`, `DesignsUITests`): change test labels in the same commit as the string.

## Adjust the area (new screen, R2) · iOS `Adjust the area · Sky`, web `Adjust the area · Web · Sky`

Flow: Choose a pattern › Use this → **Adjust the area** → Use this area (`cleanup {candidateIds:[piece], box}`) → Change it. Design detail › Re-do the cutout also opens it. Web route `/create/adjust` (T12x owns the name).

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.adjust.title` **new** | `Adjust the area` | — | Adjust the area |
| `create.adjust.copy` **new** | `Drag the corners so the frame covers your drawing.` | — | Drag the corners so the frame covers your drawing. |
| `create.adjust.copyNone` **new** | `We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it.` | — | We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it. (no drawing found; the frame starts at the whole photo; **PM default**) |
| `create.adjust.photoLabel` **new** | `Your photo` | — | Your photo (the image under the frame; web `alt`, iOS label) |
| `create.adjust.use` **new** | `Use this area` | — | Use this area (primary) |
| — | `Cuts out what is inside the frame` | — | Cuts out what is inside the frame (iOS hint on Use this area; **PM default**) |
| `create.adjust.reset` **new** | `Reset` | — | Reset (secondary; puts the frame back on the piece) |
| — | `Puts the frame back around your drawing` | — | Puts the frame back around your drawing (iOS hint on Reset; **PM default**) |
| `create.adjust.resetDone` **new** | `Frame reset` | — | Frame reset (announcement after Reset; **PM default**) |
| `create.adjust.applying` **new** | `Cutting out your art…` (exists) | — | Cutting out your art… (busy label on Use this area; same text as `create.select.applying`) |
| `create.adjust.keyboardHint` **new** | — | — | With a keyboard: arrow keys move the frame, Shift and arrow keys change its size. (web only, under the photo) |

**The frame** is one accessible element (iOS: one element with custom actions and an adjustable-style value; web: one focusable element, `role="group"` with `aria-roledescription` "area frame", handles `aria-hidden`).

| Web key | iOS key | New |
|---|---|---|
| `create.adjust.frameLabel` **new** | `Area frame` | Area frame (label) |
| `create.adjust.frameSize` **new** | `Frame covers %lld by %lld percent of the photo` | Frame covers {w} by {h} percent of the photo (value; announced after each change; `{w}` / `{h}` are whole percentages of the photo's width and height) |
| — | `Drag a corner or an edge to change the area. Swipe up or down for more actions.` | iOS hint on the frame (**PM default**) |
| `create.adjust.grow` **new** | `Grow 10 %` | Grow 10 % (action; each side moves out 5 % of the photo, clamped to the photo) |
| `create.adjust.shrink` **new** | `Shrink 10 %` | Shrink 10 % (action; stops at the minimum size) |
| `create.adjust.moveUp` **new** | `Move up 10 %` | Move up 10 % |
| `create.adjust.moveDown` **new** | `Move down 10 %` | Move down 10 % |
| `create.adjust.moveLeft` **new** | `Move left 10 %` | Move left 10 % |
| `create.adjust.moveRight` **new** | `Move right 10 %` | Move right 10 % |
| `create.adjust.atEdge` **new** | `The frame is at the edge of the photo` | The frame is at the edge of the photo (announced when a move or grow cannot go further; **PM default**) |
| `create.adjust.tooSmall` **new** | `The frame can't get smaller` | The frame can't get smaller (announced at the minimum size; **PM default**) |

The space between "10" and "%" follows the brief's wording ("Grow 10 %"); keep it identical on both platforms so the demo scripts match.

## Choose a pattern (unchanged board `2013:408`, `2027:3254`)
| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.select.use` | `Use this` | Use this (→ Change it) | Use this (→ **Adjust the area**) — text unchanged, destination changed |
| `create.select.copyNone` | `Draw a box around your art, or tap it, then tap Apply cutout.` (iOS no-drawing line) | We could not find your drawing by ourselves. Draw a box around it on the photo. | **removed** on Choose a pattern: with no drawing found the flow goes straight to Adjust the area with the whole photo (`create.adjust.copyNone`) |
| `create.select.boxAround`, `create.select.addAround`, `create.select.keyboardHint`, `create.select.keyboardHintNone`, `create.select.wholePhoto` | — | Box around this piece / Add the area around this piece / … / Use the whole photo | **removed** (no per-piece tools; the frame replaces them) |
| — | `Box around this piece`, `Add the area around this piece`, `Leave this piece out` (if still in the catalogue) | — | **removed** |

## Your cutout (simplified, R3) · iOS `2013:618`, web `2038:4233`

The screen keeps only: the cutout preview on the checkerboard, the status line, "Use this" (pinned) and "Start over".

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.cutout.copy` | `Here's the cutout of your changed art. Fix the edges if you need to.` | Here's the cutout of your changed art. (web) / …Fix the edges if you need to. (iOS) | Here's your cutout. (iOS key: `Here's your cutout.`) |
| `create.cutout.copyOriginal` | `Here's the cutout of your art. Fix the edges if you need to.` | Here's the cutout of your art. (web) / …Fix the edges if you need to. (iOS) | **removed** (one sentence for both paths: "Here's your cutout.") |
| `create.select.applied` | `Your cutout is ready. Here it is.` | Your cutout is ready. Here it is. | unchanged (status line) |
| `create.select.use` | `Use this` | Use this | unchanged (pinned primary) |
| `common.startOver` | `Start over` | Start over | unchanged |
| — | `Starts again from the camera` | Starts again from the camera | unchanged (hint) |
| `create.select.failedProducts`, `create.select.unpublishedProducts` | `Your cutout is saved. One product could not be rebuilt; try again later.`, `One product went back to draft because the new cutout is too small to print. Open My designs to fix it.` | — | unchanged (status line; used after Re-do the cutout) |
| `create.cutout.adjustCopy` | — | Fix the edges if you need to. Tap the photo to add or remove an area. | **removed** (board `2038:4092` "Your cutout · Adjust" is retired) |
| `create.select.backToPhoto` | `Fix the edges`, `Fix the edges of the cutout` | Fix the edges | **removed** |
| `create.select.modesLabel`, `modeAdd`, `modeRemove`, `modeBox` | `Add area`, `Remove area`, `Draw a box` | What a tap on the photo does / Add area / Remove area / Draw a box | **removed** |
| `create.select.instruction`, `instructionBoxNone` | `Tap the photo where the cutout should include more. Tap a mark again to remove it.`, `Draw a box around what should stay, then tap the parts to leave out.` | — | **removed** |
| `create.select.markAdded`, `markRemoved`, `marksLabel`, `maxMarks`, `clearMarks`, `needPiece`, `announceMark`, `announceUnmark`, `announceBox`, `announceCleared` | `You can add up to 10 marks. Tap a mark to remove it.`, `Clear marks` and the mark badge labels | — | **removed** |
| `create.select.apply` | `Apply cutout`, `Cuts it out again with your marks and shows it`, `Shows the picture so you can add marks or a box` | Apply cutout | **removed** |
| `create.select.showCutout` | — | Show the cutout | **removed** |
| — | `Uses this cutout and makes your product` | — | unchanged (hint on Use this) |

## Change it (buttons in one row, R4) · iOS `2012:387`, web `2027:3138`
Labels unchanged: "Make the change" (primary) and "Looks good as is" (secondary) sit in one row inside the change card; no pinned bar. Web `create.result.skip` "Looks good as is", iOS `Make the change`, `Looks good as is`, hint `Keeps your art as it is and goes on`: no copy change. At accessibility text sizes (iOS AX1+, web ≥ 200 % zoom) the two stack, "Make the change" first.

## Listing drafting state (R5) · iOS `Listing details · Drafting · Sky`, web `2030:3804`
| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.listing.drafting` | `Writing your listing…` (exists, today only the Improve button label) | Writing a title and price for you… | Writing your listing… (status label under the animation; announced when drafting starts) |
| `create.listing.draftingHint` **new** | `We'll show the name, price and description when it's ready.` | — | We'll show the name, price and description when it's ready. |
| `create.listing.draftingAlt` **new** | — | — | "" (the animation is decorative: `alt=""` / `aria-hidden`, the status label carries the meaning) |
| `create.listing.submit` | `Approve and list it` | Put it in the shop (web) / Approve and list it (iOS) | unchanged; **disabled** while drafting |
| — | `I wrote a listing called %@, for %@. You earn %@ per sale. Check it, then tap Approve and list it.` | — | unchanged (announced when the fields appear) |
| `create.listing.improving` | `Writing your listing…` | Improving… (web) | unchanged on web; iOS keeps "Writing your listing…" on the Improve button and shows the same drafting card while it runs |

The slow-work line after the usual wait is the existing `SlowWorkHint` text on both platforms (no new string).

## My story video (R6) · iOS row on `2015:783` / `4038:4389` + board `My story video · Sky`; web `/create` row + `/create/story-video?redo=1`
| Web key | iOS key | New |
|---|---|---|
| `create.myStory.row` **new** | `My story video` | My story video (row title on the Create tab; also the screen title) |
| `create.myStory.recorded` **new** | `Recorded %@` | Recorded {date} (row subtitle and under the player; date in the medium style, e.g. "Nov 2, 2026") |
| `create.myStory.none` **new** | `No story video yet` | No story video yet (row subtitle when there is no video; the row still opens the screen) |
| — | `Opens your story video` | iOS hint on the row (**PM default**) |
| `create.myStory.title` **new** | `My story video` | My story video (screen title) |
| `create.myStory.watch` **new** | `Watch` | Watch (play button label; the player's own controls follow the system) |
| `create.myStory.thumbAlt` **new** | — | "" (thumbnail is decorative; the row text names it) |
| `create.myStory.recordAgain` **new** | `Record again` | Record again (primary; opens Story video in redo mode and returns here) |
| `create.myStory.replaceNote` **new** | `Your new video replaces this one on all your products.` | Your new video replaces this one on all your products. (under Record again; **PM default**, states today's server behaviour) |
| `create.myStory.record` (reuse `create.story.record`) | `Record my video` (exists) | Record a video (web) / Record my video (iOS): primary on the empty screen |
| `create.story.mention`, `create.story.mentionHint` | `Mention my disability`, `Off means your story never says it. You can change this later.` | unchanged (toggle shown in its saved state) |
| `create.myStory.missing` **new** | `We couldn't load your video. Try again later.` | We couldn't load your video. Try again later. (player error; **PM default**) |

## iOS Welcome `21:4229` (item 1, iOS only)
| iOS key | Old | New |
|---|---|---|
| `Snap or upload your art. We make the sticker or tote.` | Snap or upload your art. We make the sticker or tote. | **removed** (the board has no subtitle). The combined VoiceOver label becomes "The 3rd Eye. Your art, on things people love." |

The web Welcome has no subtitle already (no change).

## Images (R7): alt text and labels
| Web key | iOS key | Where | New |
|---|---|---|---|
| `create.photo.mascotAlt` **new** | `Our green mascot holds up a drawing, with tote bags and stickers floating around.` | Take a photo / Upload a picture (`mascotCard`, replaces the Sky card; also the web Photo fallback) | Our green mascot holds up a drawing, with tote bags and stickers floating around. |
| `create.live.mascotAlt` **new** | `Our green mascot points at a shop page full of stickers and tote bags.` | You're live (`mascotShop`; iOS drops the tilted mockup card) | Our green mascot points at a shop page full of stickers and tote bags. |
| `create.making.animationAlt` (if a key exists for the loading MP4) | — | Making your cutout, Making your sticker / tote, Listing drafting | unchanged: decorative (`aria-hidden`), the status line carries the meaning |

If a reviewer prefers the two mascots decorative (they repeat no information on the screen), use `alt=""` / `.accessibilityHidden(true)` and keep these strings out of the catalogue; the PM default is to describe them, because they are the only picture on those screens.

## Sticker preview (R1): no new strings
Shop cards, product gallery slide 1, Listing details, Ready, My designs, Design detail and You're live show the bordered sticker preview; their existing alt texts (the artwork's description) stay. The product page's AI mockup slide keeps its current alt text.

## Strings with no board (PM defaults, flagged to the designer)
"We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it." · "Cuts out what is inside the frame" · "Puts the frame back around your drawing" · "Frame reset" · "Drag a corner or an edge to change the area. Swipe up or down for more actions." · "The frame is at the edge of the photo" · "The frame can't get smaller" · "Opens your story video" · "Your new video replaces this one on all your products." · "We couldn't load your video. Try again later." · the two mascot descriptions.
