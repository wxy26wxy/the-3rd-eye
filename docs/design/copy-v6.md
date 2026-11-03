# Copy diff v6 · feedback round 4 (iOS and web)

Source: rulings 1–3 of feedback round 4 (2026-11-03; ADR "Feedback round 4" in `docs/decisions.md`), the strings the web shipped in T140 (`web/messages/en.json` on main bd6ac0f) and the iOS catalogue of T141 (`ios/App/Resources/Localizable.xcstrings` on `feat/ios-T140`, in review; key = the English string). Boards: Changelog entry 15 in the designer's file (node ids in `docs/design/screens.md`, "Feedback round 4"). One file for both platforms; the web column is the shipped copy.

- **iOS keys are from the T141 branch, to confirm at merge** (the review may still change a label; the PM says so before the merge). Old keys removed on the branch are listed so the catalogue can be checked after the merge.
- "Old" is the string at v0.9 (web `en.json` at 084ac4f; the iOS catalogue on main bd6ac0f).
- The iOS UI tests find controls by label: change test labels in the same commit as the string.

## Photo and Adjust the area (ruling 1: the frame is set on the device)

No upload before "Use this area", so the upload step and its line go.

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.photo.finding` | `Getting your photo ready…` | Getting your photo ready… | **removed** (no upload on the photo step) |
| `create.photo.uploading` | — | Uploading your picture… | **removed** |
| `create.photo.opening` **new** | `Opening your photo…` (existed) | — | Opening your photo… (while the file is read and turned upright; web only shows it on the photo step) |
| `create.photo.cannotOpen` **new** | — | — | We couldn't open that picture here. Try a JPEG or PNG picture, or take a new photo. (web: the browser cannot decode or crop the file; the whole file is never sent instead) |
| `create.photo.lost` **new** | — | — | Your photo was not kept when the page reloaded. Take or choose it again. (web only: the photo lives in memory; iOS keeps it for the creation) |
| `create.adjust.reset` | `Reset` (hint `Puts the frame back around the whole photo`) | Reset (iOS hint `Puts the frame back around your drawing`) | Reset; iOS hint now "Puts the frame back around the whole photo" |
| `create.adjust.newPhoto` | `Take a new photo` **new on iOS** (hint `Goes back to take or pick another photo`) | web: Take a new photo (T138); iOS: none | Take a new photo on both platforms. **PM ruling:** on iOS it becomes a **text link under the pinned bar** in the iOS fix round (at AX3 three pinned buttons leave only a strip of the photo); the T141 branch has it as a third secondary pill. |
| `create.adjust.notFound` | `We couldn't find a drawing in that area. Make the frame bigger or move it over your drawing, then try again.` | unchanged | unchanged; now the answer to `POST /artworks {framed:true}` → `422 no_drawing_found` |
| — | `Goes back to frame your photo again` **new** (iOS hint on Listing's "Re-do the cutout" after a resolution refusal) | `Goes back to the frame on your photo` | Goes back to frame your photo again (Adjust the area while the local photo is in the creation, else Your cutout with Take a new photo) |

## Making your cutout (one upload)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.cutout.makingCopyOriginal` | `Looking for your drawing in the frame and cutting it out. This takes a few seconds.` | unchanged | unchanged (the job is now crop → one upload → `POST /artworks {framed:true}`) |
| `create.cutout.makingCopy` | `Cutting out your art. This takes a few seconds.` | Cutting out your changed art. (web) | the change result is cut inside Changing on both platforms, so this line is no longer reached; iOS key **removed**; the web key is still referenced by `MakingCutoutView` (a cleanup candidate) |

## Your cutout (no frame outline)

| Web key | iOS key | Old | New |
|---|---|---|---|
| — | `Take a new photo` (hint `Starts again with another photo`) **new** | — | iOS: on Your cutout when the local photo is gone (Design detail › Re-do the cutout, or a listing redo after the creation ended). Web: `create.adjust.newPhoto` is reused there. |
| — | `Saves this cutout and goes back to your design` **new** (iOS hint on Use this from Design detail) | `Uses this cutout and makes your product` | Saves this cutout and goes back to your design (redo); in the creation: `Goes on to change it or keep it as it is` |
| — | `Fix the edges of your cutout` **new** (iOS hint on Design detail's "Re-do the cutout") | `Frame your art again and cut it out` | Fix the edges of your cutout (Design detail opens Your cutout on the stored crop) |

## Change it (ruling 2: the product is made before Change it)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.result.makingSticker` / `makingTote` **new** | `Making your sticker…` / `Making your tote bag…` **new** | Making your {product}… this can take a minute. (`create.result.making`, web); iOS `Making your sticker` (Making product title) | Making your sticker… / Making your tote bag… (status in the picture area while `POST /products` runs) |
| `create.result.beingMadeSticker` / `beingMadeTote` **new** | `Your sticker is being made` / `Your tote bag is being made` **new** | — | the hint under "Make the change" and "Looks good as is" while they wait (web `aria-describedby`; iOS their VoiceOver hint) |
| `create.result.readySticker` / `readyTote` **new** | `Your sticker is ready!` / `Your tote bag is ready!` (existed) | — (web); iOS on the removed Making product screen | announced when the product photo arrives. The web has no "!", iOS keeps it: align in a later pass (PM default: keep both). |
| `create.speak.artLabel` | `Your sticker` / `Your tote bag` **new** | Your art | **PM ruling: "Your sticker" / "Your tote bag" on both platforms** (the picture is the product now). iOS done on the branch; **web follow-up**: the web Change it still shows "Your art" (shown in capitals; key `create.speak.artLabel`) above the product photo. |
| `create.result.productAlt` **new** | — | — | Your {product} with your art (web alt of the product photo; on Before and after followed by ": " and what the image shows) |
| `create.result.fixCutout` **new** | `Fix the cutout` **new** (hint `Opens your cutout to add or remove areas`) | — | Fix the cutout (text link under the two buttons; web hides it while the product is made, iOS dims it) |
| — | `Keeps your art as it is and goes on` | unchanged | unchanged ("Looks good as is" now goes to Listing with no call) |

## Changing (three status lines)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.drawing.stepChange` **new** | `Changing your art…` **new** | iOS `Changing your art now. This can take up to a minute.` | Changing your art… |
| `create.drawing.stepCutout` **new** | `Cutting it out…` **new** | — | Cutting it out… |
| `create.result.makingSticker` / `makingTote` | `Making your sticker…` / `Making your tote bag…` | — | the third line |
| `create.drawing.copy` | — | This takes about a minute. Tag is working on it. | unchanged (web, under the status line) |

## Before and after (two product photos)

| Web key | iOS key | Old | New |
|---|---|---|---|
| `create.result.subtitleSticker` / `subtitleTote` **new** | `Your sticker, before and after` / `Your tote bag, before and after` **new** | — | subtitle under "Here's the change" |
| `create.result.use` | `Use this` (hint `Keeps the change`) | iOS hint `Keeps the change and makes the cutout` | Use this → Change it on the change (its product already exists); iOS hint "Keeps the change" |
| `create.result.fixCutout` | `Fix the cutout` (hint `Opens the cutout of the change to add or remove areas`) **new** | — | Fix the cutout |

## Retired with the Making product screen

| Web key | iOS key | Old |
|---|---|---|
| `create.making.titleSticker` / `titleTote` | `Making your sticker` / `Making your tote bag` | Making your sticker / Making your tote bag |
| `create.making.copySticker` / `copyTote` | `Adding the white border and getting it ready to print.` / `Placing your art on the bag and getting it ready to print.` | (same) |
| — | `Uses this cutout and makes your product`, `This takes a few seconds…` | (iOS hints and the Finding line) |

## Follow-ups (PM rulings, 2026-11-03)
1. **Web Change it label:** "Your art" (shown in capitals) → "Your sticker" / "Your tote bag" (`create.speak.artLabel` → two keys by product). iOS already says so.
2. **iOS "Take a new photo" on Adjust the area:** a text link under the pinned bar instead of a third pill (iOS fix round).
3. "Your sticker is ready" (web) vs "Your sticker is ready!" (iOS): optional alignment.
