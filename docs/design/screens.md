# Screens · web

Board names follow the design canvas (Direction A, green and playful), baseline version `1793328546-ac11`. From the rename (T085) the wordmark on every board reads "THE 3RD EYE" instead of "maker story" (logo board, welcome and story headers, Web-Green nav, hero and footer); the canvas still shows the old name until the next version, and the code follows the rename, not the board. Every screen uses tokens from `web/app/tokens.css` through the primitives in `web/components/ui/*`; copy is in `web/messages/en.json`.

## Public site

| Board | Route | Component |
|---|---|---|
| Web-Green · Shop (hero, collection, how, meet the artist) | `/` | `components/shop/{Hero,Collection,HowSteps,MeetArtist}` |
| Web-Green · Product | `/p/[id]` | `components/product/ProductView`, `BuyForm` (action `app/(site)/p/[id]/actions.ts#placeOrder`) |
| Order confirmation | `/buy/success?order=…` | `components/product/OrderSuccess` |
| Artists | `/artists` | `components/site/CreatorCard` |
| Artist profile | `/c/[slug]` | `components/pages/CreatorProfile` |
| Story tag (mobile) | `/t/[token]` | `components/storytag/StoryTagView` (actions `tap`, `sendReply`) |
| How it works | `/how-it-works` | `components/pages/StaticPage` + `HowSteps` |
| For studios | `/for-studios` | `components/pages/StaticPage` |
| Accessibility | `/accessibility` | `components/pages/StaticPage` |
| Admin · orders | `/admin` (basic auth) | `components/admin/OrdersTable` (action `app/admin/actions.ts#setOrderStatus`) |
| Admin · AI trace | `/admin/trace/[artworkId]` | `components/admin/TraceView` |

## Creator flow (mobile web)

| Board | Route | Component (`components/create/screens/*`) |
|---|---|---|
| E4 · Welcome | `/create` | `Welcome` |
| Sign in with code | `/create/code` → POST `/create/code/session` | `CodeSignIn` |
| E4 · Choose product (STEP 1 OF 3) | `/create/product` | `ChooseProduct` |
| E4 · Choose method (STEP 2 OF 3, NO PEN NEEDED!) | `/create/method` | `ChooseMethod` |
| E4 · Listening / Type instead / clarifying question | `/create/speak` | `Speak` |
| E4 · Drawing your idea | `/create/drawing` | `Drawing` |
| E4 · Result (YOU SAID, variants, hear, Change it / Use this) | `/create/result` | `Result`, `VariantPicker` |
| E4 · Take / upload a photo | `/create/photo?mode=camera|upload` | `Photo` |
| E4 · TAP THE ONE YOU WANT! | `/create/select` | `Select` |
| E4 · YOUR STICKER IS READY! | `/create/ready` | `Ready` |
| E4 · Listing (Improve with AI, trace toggle) | `/create/listing` | `Listing` |
| E4 · MAKE YOUR STORY VIDEO! | `/create/story-video` | `StoryVideo` |
| E4 · YOU'RE LIVE! | `/create/live` | `Live` |

Shared frame: `components/create/CreateScreen` (back button, step pill, display headline, scalloped cream bottom sheet with the actions). Mascot: `components/Tag.tsx` (`listening`, `cheering`, `waving`).

## Screens with no board yet

Built (or being built this week) from existing tokens and primitives. Mark them "no board yet" in reviews; they get a row above when the designer draws them.

| Screen | Where | One line |
|---|---|---|
| Adjust cutout | creator flow, after photo | Combine candidate drawings, add or remove area points, drag a box, preview the result. Replaces "Tap to select" (`/create/select`, board 4c). |
| Design detail | My designs, one design | Make a sticker or tote from it, edit the listing, re-do the cutout, see it in the shop, delete. |
| My designs status badges | My designs list | "Cutting out...", "Didn't work", "Draft", "In the shop". |
| Admin · Creators panel | `/admin` | Creator list with a one-time code card (QR and link). |
| Code prefill hint | web `/create/code?c=` | A hint line on the sign-in screen when the code arrives pre-filled from a link. |

## Removed elements (iOS, T081)

Accessibility settings sheet, helper-mode button, "Hear what the image shows" play bar, per-field mic icons. Voice remains only on "Say it out loud" and "Say what to change". The canvas still draws the helper-mode button (E4 Welcome) and a "Your helper can hold the phone" line (E4 Method); web keeps the "Hear the question again" button on the clarifying question.

## Canvas intake log

| Canvas version | Date | Boards | Result |
|---|---|---|---|
| `1793328546-ac11` | 2026-10-29 | 27 board files (9 prototype, 15 E4 creator flow, Logo, Mascot, Web-Green) | Baseline (dry run). 4 colours without a token: `#FBF4DF`, `#3C4A3D`, `#CFE0A0`, `#56705A`. All other colours, font sizes and the grain match `design/tokens.json`. Wordmark still "maker story". Procedure: `docs/handoffs/design.md`. |

## Accessibility deviations from the design

- **Display headlines on green**: cream fill on `ground` is about 1.9:1. The 2 px ink stroke and 5 px ink shadow carry the letterforms, and every display headline is also real text. On cream surfaces display text uses ink fill instead of cream (`tone="onCream"`).
- **Nav links on phones** are cream pills on green instead of bare text, so each is a 44 px target with readable contrast; the desktop nav keeps the bare-text style.
- **Selected state** is shown by the lime background *and* a filled check circle, so it does not rely on colour alone. Every choice is a native radio.
- **Starburst badge** text is part of the choice's accessible name ("Say it out loud … No pen needed!").
- **Focus**: a 3 px ink outline with a 3 px offset everywhere (the design has no focus state).
- **Motion**: Tag's waving and hopping, the listening bars and the loading dots stop under `prefers-reduced-motion`.
- **High contrast**: the generated tokens switch under `prefers-contrast: more`; the grain overlay turns off.
- **Mic screens** always offer "Type instead"; the clarifying question is spoken *and* shown, with a "Hear the question again" button.
- **File pickers** are native inputs (visually hidden over a pill face), so they work with VoiceOver and the keyboard.
