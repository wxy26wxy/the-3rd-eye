# Copy diff v3 · web (`web/messages/en.json`)

Source: Figma file key `WVJuvNJnfcNaAqOW6jWeWi`, Changelog frame `2043:4304` (entries 1–12, 2026-11-01), and the text read from each board on 2026-11-01 (T110). Apply these rows verbatim. "Old" is the string in `en.json` today (it can differ from the old board; the board is what changed). Keys marked **new** are proposed names; rename them if a component needs a different shape, but keep the English text. Names, prices, quotes and transcripts on the boards are sample data, not copy (Leo, Sunrise Art Studio, $6, "Make the book red", …).

Conventions: `/` in a board string is a forced line break in the design (render as two lines on wide screens, wrap freely on phones; the accessible name has no break). `{…}` are ICU placeholders. **PM default** = not on a board; the intake chose it so the implementer is not blocked (listed again at the end).

## Entry 1–2 · Shop `2018:1789` (redesigned) and Product page `2019:2004` (redesigned)

Entry 1 (scrim hero card) is superseded by entry 2: the hero is copy on `color/page` beside a rounded photo card (`4006:4382`, radius 40, image = `ASSETS.heroSky`, the same file). The phone boards `2018:1970` and `2019:2098` were not rebuilt (only entry 3's voice wording changed on them); the 1440 boards win, so the copy below applies at every width.

### Shop · hero (`2018:1805`)
| Key | Old | New |
|---|---|---|
| `shop.heroEyebrow` | Art with | Stickers & totes by disabled artists |
| `shop.heroTitle` | A story you can hold. | Art with a story / in every piece. |
| `shop.heroCopy` | Stickers and tote bags made from original art. Every piece comes with a story tag. Tap it to meet the artist. | Every sticker and tote comes with a story tag. Tap it with your phone to meet the artist who made it, in their own words. |
| `shop.ctaShop` | Shop the collection | Shop new arrivals |
| `shop.ctaHow` | How story tags work | How story tags work (unchanged) |
| `shop.heroPays` **new** | — | Every purchase pays the artist directly. |
| `shop.heroChipTitle` **new** | — | Tap the tag |
| `shop.heroChipMeta` **new** | — | Meet {name} · {duration} (board: "Meet Leo · 0:30"; design history: since round 5 Leo is hidden and the chip features June Park, `FEATURED_CREATOR_SLUG`) |
| `shop.heroBurst` | Tap to meet the artist! | removed (no burst on the board) |
| `shop.metaTitle`, `shop.metaDescription` | (unchanged) | unchanged (not on a board) |

### Shop · collection (`2018:1821`)
| Key | Old | New |
|---|---|---|
| `shop.collectionTitle` | The collection | New this week |
| `shop.viewAll` **new** | — | View all → (the arrow is decorative: `aria-hidden`, accessible name "View all") |
| `shop.filterAll` / `shop.filterStickers` / `shop.filterTotes` | All / Stickers / Tote bags | unchanged |
| `shop.filterVoice` | Made by voice | **removed** (entry 3: tab and variant deleted from Filter tabs `2010:570`) |
| `common.madeByVoice` | Made by voice | **removed** (entry 3: chip and property deleted from Web product card `2035:4130`) |
| `shop.tileTag` **new** | — | Story tag (pill on the tile, card variant Size=Tile `4006:4357`) |
| `shop.tileMeta` **new** | — | {type} · {name} · {studio} (board: "STICKER · Leo · Sunrise Art Studio"; caps by CSS, not in the string; without a studio: "{type} · {name}") |
| `shop.empty` | New pieces are on their way. Check back soon. | unchanged (`2025:2929`) |

`2025:2929` Shop · Empty collection still shows the old heading "The collection" and "Meet the artist"; use the new headings there too (one component).

### Shop · story tags band (`2018:1922`, green band)
| Key | Old | New |
|---|---|---|
| `shop.howEyebrow` **new** | — | Story tags |
| `shop.howTitle` | How a story tag works | Every piece / talks. |
| `shop.step1Title` | An artist draws or speaks | Tap the tag |
| `shop.step1Copy` | Artists snap a photo of a drawing, or describe their idea out loud and hear it read back until it feels right. | Hold your phone near the tag sewn on the tote or printed on the sticker card. |
| `shop.step2Title` | We print it when you order | Meet the artist |
| `shop.step2Copy` | Each sticker or tote is printed for you, so one artwork can be sold again and again. | A short video plays: who they are and why they made it. |
| `shop.step3Title` | You tap to meet them | Say thanks |
| `shop.step3Copy` | Hold your phone to the story tag. A short video of the artist plays, with captions. | Send a note or follow them. They see every message. |
| `shop.stepLabel` | Step {n} | unchanged (the board shows the number only; keep "Step {n}" as the visually hidden prefix) |
| `shop.howCta` **new** | — | See a story tag in action |
| `shop.phoneEyebrow` **new** | — | Story tag · {studio} |
| `shop.phoneHi` **new** | — | Hi, I'm {name}. (same text as `tag.hi` without "!"; reuse `tag.hi` if the designer agrees, PM default: new key, board wording) |
| `shop.phoneProduct` **new** | — | {type} · came with this story tag (board: "Sticker · came with this story tag") |

Phone preview body on the board ("I make art at Sunrise Art Studio. I drew this fern on a rainy afternoon and kept refining it until it felt right.") is sample data: render the featured creator's bio. Entry 3 replaced "I described this fern out loud and kept refining it…" there; the seed bio must not mention describing out loud (T113/T115 check).

The phone-board step copy from entry 3 ("An artist draws" / "Artists snap a photo of their drawing or upload it, then fine-tune it until it feels right.") is superseded by the three new steps above.

### Shop · Meet the makers (`2018:1937`)
| Key | Old | New |
|---|---|---|
| `shop.meetTitle` | Meet the artist | Meet the makers |
| `shop.meetCopy` **new** | — | Every piece starts as the maker's own drawing. All of it is theirs. |
| `shop.meetAll` **new** | — | All makers → (arrow decorative, as above) |
| `shop.watchStory` **new** | — | Watch story · {duration} (board: "Watch story · 0:42") |
| `shop.meetCta` | See {name}'s work | removed from the shop (the card itself links to the profile; keep the key if `/artists` still uses it) |
| `shop.meetEmpty` | Our first artists are getting ready. Meet them soon. | unchanged |

Method chips on maker cards ("Draws by hand", "Paints by hand"; entry 3 changed Priya's "Makes by voice" → "Paints by hand") are per-maker data. There is no field for them today: **PM default** omit the chip until a creator field exists; never show a voice method.

### Product page (`2019:2019` Main)
| Key | Old | New |
|---|---|---|
| `product.backToShop` | Back to the shop | **replaced** by the breadcrumb below |
| `product.breadcrumbLabel` **new** | — | Breadcrumb |
| `product.breadcrumbShop` **new** | — | Shop |
| `product.breadcrumbType` **new** | — | Stickers / Tote bags (reuse `shop.filterStickers` / `shop.filterTotes`) |
| `product.galleryTag` **new** | — | Comes with a story tag |
| `product.tagPill` **new** | — | Story tag |
| `product.eyebrowSticker` **new** | — | Sticker · die-cut · waterproof |
| `product.eyebrowTote` **new** | — | Tote bag · natural canvas (**PM default**, no tote product board; wording from the iOS product option "Natural canvas") |
| `product.artistLine` **new** | — | {studio} (board: "Sunrise Art Studio · draws by hand"; method suffix omitted until the field exists, see above) |
| `common.by` | by {name} | unchanged |
| `product.sizeLabel` **new** | — | Size |
| `product.size3in` **new** | — | 3 in |
| `product.size4in` **new** | — | 4 in |
| `product.sizeSheet` **new** | — | Sticker sheet |
| `product.quantityLabel` **new** | — | Quantity (**PM default**: the stepper shows only the number; these three are its accessible names) |
| `product.quantityLess` **new** | — | Fewer (accessible name of −) |
| `product.quantityMore` **new** | — | More (accessible name of +) |
| `product.buySubmit` | Buy for {price} | **Add to bag** (key renamed `product.addToBag`; the price is shown above it) |
| `product.artistShare` | {percent}% goes to the artist | {name} earns from every sticker sold. (tote: `product.artistShareTote` **new** "{name} earns from every tote sold.", PM default) |
| `product.meetMaker` **new** | — | Meet the maker · {duration} (board: "Meet the maker · 0:30") |
| `product.meetMakerNote` **new** | — | Scan the tag on your sticker card to watch it anytime. (tote: `product.meetMakerNoteTote` **new** "Scan the tag on your tote to watch it anytime.", PM default) |
| `product.detailsTitle` **new** | — | Details & size |
| `product.shippingTitle` **new** | — | Shipping & returns |
| `product.altTitle` **new** | — | Image description (alt text) |
| `product.moreFrom` **new** | — | More from {name} |
| `product.visitStudio` **new** | — | Visit {studio} → (arrow decorative) |
| `product.dieCutTitle` | Die-cut preview | **removed** |
| `product.dieCutCaption` | The dashed line shows where the sticker is cut. | **removed** |
| `product.storyTitle` | The story behind it | **removed** |
| `product.seeWork` | See {name}'s work | removed from the product page ("Visit {studio} →" replaces it) |
| `product.buyTitle` | Buy this piece | moves into the Add-to-bag sheet (ruling R1); keep the text as the sheet title |
| `product.buyName`, `buyEmail`, `buyEmailHint`, `buyNote`, `buyPending`, `buyStaged`, `buyError`, `nameRequired`, `noteRejected`, `noteUnavailable` | (as today) | unchanged, used inside the Add-to-bag sheet (R1). The sheet's submit: `product.placeOrder` **new** "Place order" (PM default; the board has no sheet) |

Quote ("I drew him reading because that's my favorite thing to do on rainy days."), the disclosure bodies and thumbnails are data. "Image description (alt text)" opens the artwork's `altText`.

## Entry 3 · voice removed from the public site
| Board | Key | Old | New |
|---|---|---|---|
| How it works `2025:2713` | `how.speak` | Artists who cannot draw describe their idea out loud. The app makes the image, then reads a description back so they can change it. | Artists photograph or upload their own drawing, then fine-tune it until it looks right. A written description shows what the finished image looks like. |
| For studios `2025:2778` | `studios.point2` | Artists approve every listing themselves, by voice or by tap. | Artists approve every listing themselves. |
| For studios `2025:2784` | `studios.point4` | Artists who cannot draw can still create, by describing their idea out loud. | **removed** (the page lists points 1–3) |
| Accessibility `2025:2835` | `a11y.voiceFirst` | Voice first: every creation step can be done by speaking, with a typing option on every screen. | Typing works everywhere: every creation step has a text option, and works with a keyboard or screen reader. (key may be renamed `a11y.typing`) |
| Accessibility `2025:2840` | `a11y.spoken` | Spoken descriptions: after an image is made, a written description is read aloud on your device, so you know what it shows. | Image descriptions: after an image is made, you get a written description of what it shows, which your screen reader can announce. |
| Shop tiles `2018:1900`, `4008:4412`; Product `4012:4469` | (product card chip) | "… · made by voice" | removed |
| Product · Mobile `2019:2135` | `common.madeByVoice` chip | Made by voice | removed |
| Product · Mobile `2019:2098` | (story text, seed data) | Rosa described a monster… | Rosa drew a monster… (sample story text, not an `en.json` string: the seed / demo story must not say "described"; T113/T115 check, like the fern bio above) |

Kept on purpose (entry 3): `common.readAloud` / `common.stopReading` on Story tag `2024:2451` and Artist profile `2024:2714` (buyer text-to-speech).

## Entry 4 · creator flow, Change it (web boards `2026:3067` … `2038:4060`)

### Choose method `2026:2998`
| Key | Old | New |
|---|---|---|
| `create.method.title` | How do you want to make it? | How do you want to add your art? |
| `create.method.speak` | Say it out loud | **removed** (option `2026:3046` deleted) |
| `create.method.speakCopy` | Describe your idea. We'll draw it. | **removed** |
| `create.method.badge` | No pen needed! | **removed** |
| `create.method.photo`, `photoCopy`, `upload`, `uploadCopy` | Take a photo / Snap a drawing on paper. / Upload a picture / Pick a picture from your phone. | unchanged |

### Change it · Listening `2026:3067`, Question `2026:3098`, Microphone off `2026:3135` (route `/create/speak` → the Change it screen)
| Key | Old | New |
|---|---|---|
| `create.speak.title` | Tell me your idea | Change your art |
| `create.speak.hint` | Press the big button and describe what you want to see. | Press the big button and say what to change, or type it. Your original stays safe. |
| `create.speak.hintMicOff` **new** | — | We can't use the microphone, so type what to change. Your original stays safe. |
| `create.speak.micDenied` | We can't use the microphone. You can type instead. | unchanged (notice on `2026:3135`) |
| `create.speak.textLabel` | Describe your idea | What should change? |
| `create.speak.textPlaceholder` | A happy frog sitting in the sun | Make the book red (sample, used as the placeholder example) |
| `create.speak.done` | Done | Make the change |
| `create.speak.youSaid` | You said | unchanged on Question `2026:3098` |
| `create.speak.questionTitle`, `hearAgain`, `answerSpeak`, `listening`, `listeningHint`, `seconds`, `stop`, `start` | (as today) | unchanged |
| `create.speak.artLabel` **new** | — | Your art (Art preview label chip, component `4021:4470`) |
| `create.speak.shaping` | Thinking about your idea… | Thinking about your change… (**PM default**; no board shows this state) |
| `create.speak.redo` | Say it again | Say it again (unchanged on the speak screen; the error action is below) |

### Change it (entry) `2027:3138` = Result · Change it renamed
| Key | Old | New |
|---|---|---|
| `create.result.titleEntry` **new** | — | Change your art? |
| `create.result.shows` | What the image shows | unchanged |
| `create.result.changeLabel` | What should change? | unchanged |
| `create.result.changePlaceholder` | Make the frog bigger | Make the book red (sample) |
| `create.result.changeSubmit` | Change it | Make the change |
| `create.speak.start` | Start talking | unchanged (mic button on the entry board) |
| `create.result.skip` **new** | — | Looks good as is (goes to Making your cutout; changelog: web "Back" → "Looks good as is") |

### Changing your art `2027:3042`, Error `2027:3062`; Change it · Changing `2038:4035`
| Key | Old | New |
|---|---|---|
| `create.drawing.title` | Drawing your idea | Changing your art |
| `create.drawing.copy` | This takes about a minute. Tag is working on it. | unchanged (board `2027:3042`) |
| `create.drawing.spoken` | Drawing your idea now. | Changing your art now. (PM default, follows the title) |
| `create.drawing.error` | The drawing did not work this time. | The change did not work this time. |
| `create.drawing.back` **new** (replaces the "Say it again" action) | Say it again | Back to my art |
| `create.result.changing` | Changing it… | unchanged (`2038:4035`) |
| `create.result.making` | Making your {product}… this can take a minute. | This can take a minute. (on `2038:4035`; the product line moves to Making your sticker, below) |

### Change it · Before and after `2027:3091` = Result renamed
| Key | Old | New |
|---|---|---|
| `create.result.title` | Here's what I made | Here's the change |
| `create.result.youSaid` | You said | You asked |
| `create.result.before` **new** | — | Before |
| `create.result.after` **new** | — | After |
| `create.result.hear` | Hear what the image shows | unchanged |
| `create.result.use` | Use this | unchanged |
| `create.result.change` | Change it | Change it again |
| `create.result.backToPictures` | Back to the pictures | Back to my original |
| `create.result.groupLabel` | Choose a picture | **removed** (no 3-picture chooser) |
| `create.result.variant` | Picture {n} | **removed** |
| `create.result.selected` | Selected | **removed** |

### Change it · Error `2038:4060`
| Key | Old | New |
|---|---|---|
| `create.errorGeneric` | Something went wrong. Please try again. | unchanged |
| `create.errors.retry` | Try again | unchanged |
| `create.result.skip` | — | Looks good as is |
| `create.result.tryDifferent` **new** | — | Try a different change |

### Welcome (from entry 4, superseded by entry 5)
Entry 4 rewrote the promises ("Turn your art into…", "1. Snap a photo or upload a picture of your art.", "2. Say or type what to change. We read every result out loud, so you always know what it shows."); entry 5 then removed the promises. Apply entry 5 only.

## Entry 5–6 · Welcome · Web `2026:2865` (sky photo, no panels)
| Key | Old | New |
|---|---|---|
| `create.welcome.title` | Let's make something! | Your art, / on things / people love. |
| `create.welcome.copy` | Turn your art or your idea into stickers and tote bags people can buy. | **removed** from the web Welcome (not on the board; see below) |
| `create.welcome.promise1` | You can speak, snap a photo, or upload a picture. | **removed** |
| `create.welcome.promise2` | We read every result out loud, so you always know what it shows. | **removed** |
| `create.welcome.promise3` | Nothing goes on sale until you say yes. | **removed** |
| `create.welcome.cta` | Start creating | unchanged |
| `create.welcome.haveAccount` | I already have an account | unchanged; the text action (was "Sign out" for a signed-in creator) is now this, colour `ink` |
| `create.signOut` on Welcome | Sign out | not on Welcome any more (keep the key for other screens) |

`create.welcome.copy` is not rendered on the web Welcome: the board (`2026:2865`) shows only the title, "Start creating" and "I already have an account", and the boards win (PM ruling, T110 fix round 1). The Changelog (entry 5) names a sentence, "Snap or upload your art. We make the sticker or tote.", that the board does not show; it is a question for the designer (`docs/handoffs/design.md`). Delete the key from `en.json` unless another screen uses it. White text on the bare sky (the title only) is the accepted exception (R5, `docs/accessibility.md`).

## Entry 7 · Choose a pattern, Your cutout, Making your cutout (web)

### Choose a pattern `2027:3254` (was Select (Adjust cutout))
| Key | Old | New |
|---|---|---|
| `create.select.title` | Pick your art | Tap the one you want. |
| `create.select.copyMany` | We found {n} pieces. Pick one, or several to combine them. | We found {n} drawings in your photo. Pick one to change and turn into a {product}. (board: "…turn into a sticker."; `{product}` = sticker / tote bag) |
| `create.select.copyOne` | We found one piece. Change the cutout with the tools below. | We found one drawing in your photo. Use it to change and turn into a {product}. (**PM default**, no single-piece board) |
| `create.select.candidate` | Piece {n} | unchanged |
| `create.select.groupLabel` | Pieces found | Drawings found (PM default, matches the new body) |
| `create.select.use` / `create.select.retake` | Use this / Retake | unchanged on this screen |
| `create.select.boxAround`, `addAround`, `modesLabel`, `modeAdd`, `modeRemove`, `modeBox`, `instructionAdd`, `instructionRemove`, `instructionBox`, `keyboardHint`, `clearMarks`, `apply` | (tools) | removed from Choose a pattern (single pick, no tools); the edge tools move to Your cutout · Adjust |

### Your cutout · Adjust `2038:4092` (was Select · Marks)
| Key | Old | New |
|---|---|---|
| `create.cutout.title` **new** | — | Your cutout |
| `create.cutout.adjustCopy` **new** | — | Fix the edges if you need to. Tap the photo to add or remove an area. |
| `create.select.modeAdd` / `modeRemove` / `modeBox` | Add area / Remove area / Draw a box | unchanged |
| `create.select.instruction` **new** (replaces `instructionAdd` / `instructionRemove` / `instructionBox`) | Tap the photo where the cutout should include more… / Tap a piece to leave it out… / Drag a box around the whole drawing. | Tap where the cutout should include more, or pick Remove area and tap what to leave out. To trim an edge, draw a box. |
| `create.select.marksLabel`, `markAdded`, `markRemoved`, `maxMarks`, `clearMarks`, `apply` | (as today) | unchanged |
| `create.select.needPiece` | Pick a piece, draw a box or add an area first. Remove area only leaves out pieces you picked. | Add or remove an area, or draw a box, before you apply the cutout. |
| `create.select.retake` (on cutout screens) | Retake | Start over (`common.startOver` exists: reuse it) |

### Your cutout `2038:4233` (was Select · Applied)
| Key | Old | New |
|---|---|---|
| `create.cutout.copy` **new** | — | Here's the cutout of your changed art. |
| `create.select.applied` | Your cutout is saved. Here it is. | Your cutout is ready. Here it is. |
| `create.select.backToPhoto` | Back to photo | Fix the edges |
| `create.select.failedProducts` | Your cutout is saved. One product could not be rebuilt; try again later. | unchanged |
| `create.select.use` | Use this | unchanged |
| `common.startOver` | Start over | unchanged (secondary) |

For "Looks good as is" (R2/R3: the original piece's cutout, nothing was changed) the body "Here's the cutout of your changed art." is not true. **PM default:** `create.cutout.copyOriginal` **new** "Here's the cutout of your art." on that path.

### Making your cutout `2038:4369` (was Select · Saving)
| Key | Old | New |
|---|---|---|
| `create.cutout.makingTitle` **new** | — | Making your cutout |
| `create.cutout.makingCopy` **new** | — | Cutting out your changed art. (original path: "Cutting out your art.", PM default) |
| `create.select.applying` | Saving the cutout… | Cutting out your art… |

## Entry 8 · Making your sticker · Web `4031:4378` (new board)
| Key | Old | New |
|---|---|---|
| `create.making.titleSticker` **new** | — | Making your sticker |
| `create.making.copySticker` **new** | — | Adding the white border and getting it ready to print. |
| `create.result.making` | Making your {product}… this can take a minute. | stays for this screen: "Making your sticker… this can take a minute." (`{product}` = sticker / tote bag) |
| `mascot.loading` **new** | — | Alt for the loading animation: decorative (empty `alt`); the status line above carries the meaning. |

Flow: Your cutout › Use this → Making your sticker → Ready.

## Entry 9–10 · font and loading animation
No copy. Outfit replaces Inter (layout instruction in `docs/handoffs/design.md`); the animation is `ASSETS.stickerLoading` / `ASSETS.stickerLoadingVideo` (play the MP4, muted, looped; under `prefers-reduced-motion` show the first frame, no autoplay). Slot 342×342, radius 24.

## Entry 11 · tote bag boards
| Board | Key | Old | New |
|---|---|---|---|
| Choose product · Tote bag selected `4038:4573` | `create.product.*` | (as today) | unchanged |
| Making your tote bag `4038:4628` | `create.making.titleTote` **new** | — | Making your tote bag |
| Making your tote bag `4038:4628` | `create.making.copyTote` **new** | — | Placing your art on the bag and getting it ready to print. |
| Making your tote bag `4038:4628` | `create.result.making` | — | Making your tote bag… this can take a minute. |
| Ready · Tote bag `4038:4644` | `create.ready.titleTote` | Your tote bag is ready! | unchanged |
| Listing · Tote bag `4038:4662` | `create.listing.*` | (as today) | unchanged |
| Live · Tote bag `4038:4713` | `create.live.copy` | {title} is now in the shop. | unchanged |
| Choose a pattern (tote) | `create.select.copyMany` | — | "…turn into a tote bag." via `{product}` |

## Entry 7 (B5) · Admin · AI trace `2034:3995`
| Key | Old | New |
|---|---|---|
| `admin.tracePhotoMask` **new** | — | Photo and mask |
| `admin.traceOriginal` / `traceMask` / `traceOpenMask` | Original photo / Mask / Open mask | unchanged |
| `admin.traceTranscript` | Transcript | Change request |
| `admin.traceSaid` **new** | — | (said out loud) — appended after the request text; a typed request shows `admin.traceTyped` |
| `admin.traceTyped` **new** | — | typed |
| `admin.tracePrompt` | Shaped prompt | Edit instruction |
| `admin.traceVariants` | Variants | Before and after |
| `admin.traceBefore` / `admin.traceAfter` **new** | — | Before / After |
| `admin.traceChosen` | Chosen | unchanged (on After) |
| `admin.traceDescription` | Description | unchanged |
| `admin.traceDifferences` | Differences from the prompt | Differences from the request |
| `admin.traceNoDifferences` **new** | — | None noted. |
| `admin.traceSelection` | Selection | Decision |
| `admin.traceChosenVariant` | Picture {n} was chosen. | The maker kept the After picture. The original is saved and can be restored. |
| `admin.traceKeptOriginal` **new** | — | The maker kept the original picture. (PM default, the other decision) |
| `admin.traceSticker`, `traceOtherCalls`, `traceRequest`, `traceResponse`, `backToOrders` | (as today) | unchanged |

Step order on the board: Photo and mask → Change request → Edit instruction → Before and after (Picture 3 removed) → Description → Decision → Sticker; Other model calls after. The model-call lines ("transcribe · speech model · 1240 ms", "edit · Muse Image · 18400 ms") are data.

## Entry 2 / 12 (B3 note) · Note · Hero motion (frame `2035:4133`, text `2035:4134`)
Not product copy: "Hero text sits on color/page beside the photo, never on it." Recorded in `docs/accessibility.md`.

## Entry 12
Layout only (sections restacked); no copy.

## Strings with no board (PM defaults, flagged to the designer)
`create.speak.shaping` · `create.drawing.spoken` · `create.select.copyOne` · `create.select.groupLabel` · `create.cutout.copyOriginal` · `create.cutout.makingCopy` (original path) · `product.eyebrowTote` · `product.artistShareTote` · `product.meetMakerNoteTote` · `product.quantity*` · `product.placeOrder` · `admin.traceKeptOriginal` · maker method chips omitted.
