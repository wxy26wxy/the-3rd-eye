# Copy diff v5 · feedback round 3 (iOS and web)

Source: rulings 1–7 of feedback round 3 (2026-11-03; ADR "Feedback round 3" in `docs/decisions.md`), the strings the web shipped in T135 (`web/messages/en.json` on main 1bda77a) and the boards edited in the designer's file (Changelog entry 14; node ids in `docs/design/screens.md`, "Feedback round 3"). One file for both platforms. The web column is the shipped copy and is the reference; the iOS column is the catalogue key as merged in T136 (`ios/App/Resources/Localizable.xcstrings` on main b4aa78a, key = the English string).

- iOS keys were checked against the catalogue after T136 merged (2026-11-03). Where the platforms differ it is noted with the ruling.
- "Old" is the string before round 3 (web `en.json` at 20e248b; the iOS catalogue on main). Delete an old key when no view uses it any more.
- The iOS UI tests find controls by label: change test labels in the same commit as the string.

## Finding (the upload step) · Photo · Finding your drawing · Web `2027:3207`, iOS Finding drawings `21:4390`

The photo is stored without detection (`POST /artworks {detect:false}`); the screen is a short upload step. The searching magnifier moves to Making your cutout.

| Board | Web key | iOS key | Old | New |
|---|---|---|---|---|
| Finding | `create.photo.finding` | `Getting your photo ready…` | Finding your drawing… (web) / `Finding your drawings…` (iOS) | Getting your photo ready… |
| Photo (no drawing) | `create.photo.drawBox` | — | Draw a box around your drawing | **removed** (no detection on upload, so no "no drawing" state here) |

## Choose a pattern (retired) · iOS `2013:408`, web `2027:3254`

The screen is removed on both platforms; its strings go.

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.select.title` | `Tap the one you want.` | Tap the one you want. | **removed** |
| `create.select.copyOne` | `We found one drawing in your photo. Use it to change and turn into a sticker.` (and the tote bag variant) | We found one drawing in your photo. Use it to change and turn into a {product}. | **removed** |
| `create.select.copyMany` | `We found %lld drawings in your photo. Pick one to change and turn into a sticker.` (and the tote bag variant) | We found {n} drawings in your photo. Pick one to change and turn into a {product}. | **removed** |
| `create.select.photoLabel` | `Your photo with the drawings we found` | Your photo with the pieces we found | **removed** |
| `create.select.photoMissing` | — | We couldn't show your photo. You can still pick pieces below. | **removed** (`create.select.photoMissingNone` stays) |

## Adjust the area · iOS `6004:4576`, web `6004:4689`

The screen opens on the stored photo with the frame at the whole photo; "Use this area" sends `detect {box}`.

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.adjust.copy` | `Drag the corners so the frame covers your drawing.` | unchanged | unchanged (now the only lead) |
| `create.adjust.copyNone` | `We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it.` | We couldn't find your drawing, so the frame covers the whole photo. Drag the corners around it. | **removed**: the frame always starts at the whole photo |
| `create.adjust.notFound` | `We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.` | unchanged | unchanged; now the answer to a detect `422 no_drawing_found` (web: focused and scrolled into view) |
| `create.adjust.reset` | `Reset` (hint `Puts the frame back around your drawing`) | Reset (puts the frame back on the piece) | Reset (text unchanged; it now always puts the frame back on the whole photo on the web). The iOS hint is unchanged (on a new photo Reset also goes back to the whole photo; on a saved design, to its piece). |
| — | — | — | **Parked (T135 review, ruling):** Adjust the area needs a "Take a new photo" secondary action to match "or use a bigger photo" in the resolution message. Today a bigger photo is reachable only through Back. A later round adds the action and its string. |

## Making your cutout (the detect job)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.cutout.makingCopyOriginal` | `Looking for your drawing in the frame and cutting it out. This takes a few seconds.` | Cutting out your art. (web) / `Cutting out your art. This takes a few seconds.` (iOS) | **Looking for your drawing in the frame and cutting it out. This takes a few seconds.** Ruling (PM, 2026-11-03): the iOS wording is canonical. **Web follow-up:** `create.cutout.makingCopyOriginal` in `web/messages/en.json` still says "Cutting out your art." and changes to this line in the next web task (not edited here). After a change both keep "Cutting out your art…" / `Cutting out your art. This takes a few seconds.` |

## Your cutout · candidate strip (iOS `2013:618`, web `2038:4233`)

Shows only when detection found two or more drawings inside the frame.

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.select.groupLabel` | — | Drawings found | Drawings found (unchanged; the strip's group label) |
| `create.select.candidate` | `Piece %lld` | Piece {n} | Piece {n} (unchanged; each is a button with `aria-pressed` on the web) |
| — | `We found %lld drawings in the frame. Tap the one you want.` | — | iOS line above the strip; the web has no such line (its group label "Drawings found" carries the meaning). PM default: keep; a web line is optional. |
| — | `Picks this drawing` | — | iOS hint on a piece that is not picked (value "Not selected") |

## Listing details · drafting (iOS `6004:4792`, web `2030:3804`)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.listing.redo` **new** | `Redo` | — | Redo (secondary, under the drafting card while the listing is written) |
| — | `Stops writing the listing and goes back to your cutout` | — | iOS hint on Redo |
| `create.listing.drafting` | `Writing your listing…` | unchanged | unchanged (the web board's old "Writing a title and price for you…" is aligned in Changelog 14) |

## Print check (Listing `2030:3752`, new board Listing · Print warning · Web `6006:4657`)

Contrast is a warning that "Use anyway" accepts; resolution is the only block.

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.listing.printWarnContrast` **new** | `Print check: the colors may look faint` | — | the colors may look faint (in "Print check: {status}") |
| `create.listing.printWarn` | `Print check: might print blurry` | might print blurry | might print blurry (now only for `print_check: "resolution"`) |
| `create.errors.printContrast` **new** | `Some colors in your art are close together, so it may look faint when printed. You can use it anyway or re-do the cutout.` | — (iOS showed "This picture won't print well yet. Re-do the cutout in My designs, or try a bigger, clearer photo." for every 409) | Some colors in your art are close together, so it may look faint when printed. You can use it anyway or re-do the cutout. |
| `create.errors.printResolution` **new** | `This picture is too small to print sharply. Re-do the cutout with more of the photo, or use a bigger photo.` | — | This picture is too small to print sharply. Re-do the cutout with more of the photo, or use a bigger photo. |
| `create.errors.useAnyway` **new** | `Use anyway` (hint `Lists it even though the colors may look faint when printed`) | — | Use anyway (contrast only; approve with `acceptPrintWarning: true`) |
| `create.errors.redoCutout` **new** | `Re-do the cutout` (exists; hint `Goes back to the frame on your photo`) | — | Re-do the cutout (web: contrast → Your cutout, resolution → Adjust the area; iOS shows it only for resolution → Adjust the area, and only "Use anyway" for contrast) |
| `create.errors.printCheck` | — | This won't print well yet: {reason} | unchanged; only for a 409 with no `check` |
| — | `This picture won't print well yet. Re-do the cutout in My designs, or try a bigger, clearer photo.` | (the one iOS message) | **replaced** by the two lines above (`APIError.approveMessage` by `check`) |

## Pictures (ruling 1; no copy change)
The sticker picture is the AI product photo everywhere (shop tile, gallery slide 1, Ready, Listing, Live; iOS Listing details, My designs, Design detail). Alt texts are unchanged (`create.ready.mockupAlt` "Your {product} preview"; the product's `altText` on the shop). Slide 2 is the bordered sticker preview.

## PM defaults and open items
- Making your cutout: the iOS line is canonical; the web follow-up is recorded above.
- The iOS strip line has no web counterpart (optional).
- Parked: "Take a new photo" on Adjust the area (copy and action in a later round).
