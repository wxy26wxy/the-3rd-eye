# Print and NFC checklist

How to turn one order into a physical sticker with a working story tag, and how to verify the tap end to end. Needs: sticker paper, a printer, an NTAG213 (or any NDEF-capable) NFC tag, an iPhone or Android phone with an NFC writer app such as NFC Tools.

## 1. Make an order

1. Open the shop, pick a product, enter a buyer name and buy. Payments are staged; nothing is charged.
2. The confirmation page shows **Open the story tag**. That link is the tag URL for this order.

## 2. Get the files and the URL

1. Open `/admin` (user `admin`, password from `ADMIN_PASSWORD`).
2. Find the order (newest first). Download **Print PNG** (300 dpi, 3 mm white border, 1.5 mm bleed) and **Die SVG** (the cut line, magenta stroke).
3. The **Story tag** column shows the URL and a QR code. Press **Copy** to copy the URL. It has the form:

```
https://<site>/t/<TOKEN>
```

The token is 12 characters and unique per order. Never reuse a token across orders.

## 3. Print and cut

1. Print the PNG at 100 % scale (no "fit to page") on sticker paper.
2. Cut along the outline. A cutting machine takes the SVG; by hand, follow the white border.

## 4. Write the tag

1. In the NFC writer app: Write → Add a record → **URL/URI** → paste the story-tag URL → Write.
2. Hold the tag against the top edge of the phone until the app confirms the write.
3. Optional: lock the tag (write-protect) so a buyer cannot overwrite it. Locking is permanent.
4. Attach the tag to the back of the sticker or to the packaging.

Write a plain URL record only. No app-launch records, no text records: a locked iPhone only shows the banner for URL records.

## 5. Test the tap

1. Lock the iPhone and hold the tag near its top edge. A banner appears; tap it. Safari opens the story page with the artist's video, captions, bio and the **Send a note** form.
2. On Android the page opens directly on tap.
3. If no banner appears: check the tag was written as a URL record, that the phone has NFC on (Android) and try again with the tag flat against the top centimetre of the phone.

## 6. Verify in admin

1. Reload `/admin`. The order's tap count goes from 0 to 1 and increments on every tap.
2. Send a note from the phone. It appears under the order in `/admin` and in the creator's Messages tab in the app.

## What to record after a physical test

- Did the banner show on the first tap, and how many tries did it take?
- Page load time on mobile data.
- Does the video play with captions on?
- Print quality: border width, colour, edge cleanliness.
- File the result in `docs/progress.md` under the day's entry.
