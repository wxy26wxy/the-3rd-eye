import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fmt, m } from "@/components/messages";
import type { ProductDetail, ShopProduct } from "@/lib/db/queries.contract";

// The order path is stubbed: placeOrder's only side effect is createOrder, then a redirect.
const hoisted = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/db/queries.contract", () => ({ createOrder: hoisted.createOrder }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));

const { Gallery } = await import("@/components/product/Gallery");
const { SizeOptions } = await import("@/components/product/SizeOptions");
const { QuantityStepper } = await import("@/components/product/QuantityStepper");
const { ProductBuy } = await import("@/components/product/ProductBuy");
const { Disclosures, MeetMakerCard, MoreFrom, PaysArtistNote } = await import("@/components/product/ProductParts");
const { ProductView, gallerySlides } = await import("@/components/product/ProductView");
const { SIZES, clampQuantity, sizesFor, unitCents } = await import("@/components/product/sizes");
const { placeOrder } = await import("@/app/(site)/p/[id]/actions");

const html = (el: ReactElement) => renderToStaticMarkup(el);

/** Every element in a rendered tree (component functions called, like a shallow render), for handlers. */
function walk(node: ReactNode, out: ReactElement<Record<string, unknown>>[] = []) {
  if (Array.isArray(node)) { node.forEach((n) => walk(n, out)); return out; }
  if (!isValidElement(node)) return out;
  const el = node as ReactElement<Record<string, unknown>>;
  out.push(el);
  walk(el.props.children as ReactNode, out);
  return out;
}

const creator = {
  id: "c1", slug: "leo", displayName: "Leo", studioName: "Sunrise Art Studio", avatarUrl: null, bioShort: "I draw.",
  storyText: "I drew him reading because that's my favorite thing.", storyVideoUrl: "creators/c1/story-video/a.mp4",
  storyVideoVtt: "WEBVTT", mentionDisability: false, split: { creator_bps: 5000 }, isExample: false, hidden: false,
} as unknown as ProductDetail["creator"];
const product = {
  id: "p1", type: "sticker", title: "Reading Buddy", description: "A monster who loves books.", priceCents: 600,
  mockupUrl: "https://blob.example/mock.png", artworkUrl: "https://blob.example/art.png", cutPathSvg: "M0 0Z",
  altText: "Green fuzzy monster reading a book", madeByVoice: true, tags: [], artworkId: "a1", spokenDescription: null, creator,
} as unknown as ProductDetail;
const other = { ...product, id: "p2", title: "Morning Fern", creator } as unknown as ShopProduct;

describe("Product page v3 (board 2019:2004)", () => {
  it("reading order: breadcrumb → gallery → eyebrow → h1 → maker → price → Size → Quantity → Add to bag → pays note → Meet the maker → disclosures → More from", () => {
    const out = html(createElement(ProductView, { product, more: [product as unknown as ShopProduct, other] }));
    const order = [
      `aria-label="${m.product.breadcrumbLabel}"`, `aria-label="${m.product.galleryLabel}"`, m.product.eyebrowSticker, "<h1",
      fmt(m.common.by, { name: "Leo" }), "$6.00", m.product.sizeLabel, m.product.decrease, m.product.addToBag,
      fmt(m.product.paysSticker, { name: "Leo" }), m.product.meetMaker, m.product.detailsTitle, m.product.shippingTitle,
      m.product.altTitle, fmt(m.product.moreFrom, { name: "Leo" }),
    ].map((t) => out.indexOf(t.replace("&", "&amp;")));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Removed in v3: the die-cut preview, the voice chip, "The story behind it".
    expect(out).not.toMatch(/Die-cut preview|Made by voice|The story behind it/);
    // More from excludes the piece on the page.
    expect(out.match(/href="\/p\/p2"/g)).toHaveLength(1);
    expect(out).not.toMatch(/href="\/p\/p1"/);
  });

  it("breadcrumb: Shop is the back link, the type links to its filter, the name is the current page", () => {
    const out = html(createElement(ProductView, { product }));
    expect(out).toMatch(new RegExp(`<a[^>]*href="/"[^>]*><svg[^>]*aria-hidden="true".*</svg>${m.product.breadcrumbShop}</a>`));
    expect(out).toContain(`href="/?type=sticker#collection"`);
    expect(out).toMatch(/<li aria-current="page"[^>]*>Reading Buddy<\/li>/);
  });

  it("gallery: main picture with the product alt, thumbnails are buttons Show image n of N, the first pressed", () => {
    const slides = gallerySlides(product);
    expect(slides.map((s) => s.kind)).toEqual(["image", "image", "image", "tag"]);
    const out = html(createElement(Gallery, { slides, alt: product.altText! }));
    expect(out).toContain(`alt="${product.altText}"`);
    const buttons = out.match(/<button[^>]*>/g)!;
    expect(buttons).toHaveLength(4);
    expect(buttons[0]).toContain(`aria-label="${fmt(m.product.showImage, { n: 1, total: 4 })}"`);
    expect(buttons[0]).toContain('aria-pressed="true"');
    expect(buttons.slice(1).every((b) => b.includes('aria-pressed="false"'))).toBe(true);
    // Thumbnail images are decorative inside their labelled buttons.
    expect(out.match(/<img[^>]*alt=""/g)!.length).toBe(3);
  });

  it("gallery without pictures still shows the story tag card; a tote leads with its mockup", () => {
    expect(gallerySlides({ ...product, artworkUrl: null, mockupUrl: null }).map((s) => s.kind)).toEqual(["tag"]);
    const tote = gallerySlides({ ...product, type: "tote" });
    expect(tote[0]).toMatchObject({ kind: "image", src: product.mockupUrl, fit: "cover" });
  });

  it("size options: a labelled radio group named size, the first checked; a tote has none", () => {
    const out = html(createElement(SizeOptions, { sizes: SIZES.sticker, value: "3in", onChange: () => {} }));
    expect(out).toMatch(new RegExp(`<fieldset[^>]*><legend[^>]*>${m.product.sizeLabel}</legend>`));
    expect(out.match(/<input type="radio"[^>]*name="size"/g)).toHaveLength(3);
    expect(out).toMatch(/<input type="radio"[^>]*name="size" checked="" value="3in"/);
    for (const s of Object.values(m.product.sizes)) expect(out).toContain(s);
    expect(sizesFor("tote")).toEqual([]);
  });

  it("size prices: 3 in = listed, 4 in = +$2, sheet = +$6 (R1)", () => {
    const sticker = { type: "sticker" as const, priceCents: 600 };
    expect(unitCents(sticker, "3in")).toBe(600);
    expect(unitCents(sticker, "4in")).toBe(800);
    expect(unitCents(sticker, "sheet")).toBe(1200);
    expect(unitCents({ type: "tote", priceCents: 2400 }, null)).toBe(2400);
  });

  it("quantity stepper: labelled group, Decrease disabled at 1, value announced, hidden quantity field; buttons step within 1–10", () => {
    const out = html(createElement(QuantityStepper, { value: 1, onChange: () => {} }));
    expect(out).toMatch(/role="group" aria-labelledby="qty-label"/);
    expect(out).toMatch(new RegExp(`<button type="button"[^>]*aria-label="${m.product.decrease}"[^>]*disabled=""`));
    expect(out).toMatch(/<output[^>]*aria-live="polite"[^>]*>1<\/output>/);
    expect(out).toContain('<input type="hidden" name="quantity" value="1"/>');
    const onChange = vi.fn();
    const buttons = walk(QuantityStepper({ value: 3, onChange })).filter((e) => e.type === "button");
    (buttons[0].props.onClick as () => void)();
    (buttons[1].props.onClick as () => void)();
    expect(onChange.mock.calls).toEqual([[2], [4]]);
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(99)).toBe(10);
  });

  it("Add to bag opens the checkout sheet: one form holds size, quantity and the buy fields inside a labelled dialog", () => {
    const out = html(createElement(ProductBuy, { action: async () => ({}), type: "sticker", title: "Reading Buddy", priceCents: 600 }));
    const form = out.slice(out.indexOf("<form"), out.indexOf("</form>"));
    expect(form).toMatch(new RegExp(`<button type="button"[^>]*aria-haspopup="dialog"[^>]*aria-controls="checkout"[^>]*>.*${m.product.addToBag}`));
    const dialog = form.slice(form.indexOf("<dialog"));
    expect(dialog).toMatch(/<dialog id="checkout"[^>]*aria-labelledby="checkout-title"/);
    expect(dialog).toContain(fmt(m.product.orderSummary, { title: "Reading Buddy", size: m.product.sizes["3in"], quantity: 1 }));
    for (const name of ["buyerName", "buyerEmail", "shipNote"]) expect(dialog).toContain(`name="${name}"`);
    expect(dialog).toContain(m.product.buyStaged);
    expect(dialog).toMatch(/<button type="submit"[^>]*>.*Place order · \$6\.00/);
    expect(fmt(m.product.buySubmit, { price: "$6.00" })).toBe("Place order · $6.00");
    expect(dialog).toContain(`aria-label="${m.common.close}"`);
    expect(form).toContain('name="size" checked="" value="3in"');
    expect(form).toContain('name="quantity" value="1"');
  });

  it("a tote has no size: the summary says only the quantity", () => {
    const out = html(createElement(ProductBuy, { action: async () => ({}), type: "tote", title: "Road Trip", priceCents: 2400 }));
    expect(out).not.toContain('name="size"');
    expect(out).toContain(fmt(m.product.orderSummaryNoSize, { title: "Road Trip", quantity: 1 }));
  });

  it("disclosures: three native details/summary rows; details carry the description and the artist share; alt text falls back", () => {
    const out = html(createElement(Disclosures, { product }));
    expect(out.match(/<details/g)).toHaveLength(3);
    expect(out.match(/<summary/g)).toHaveLength(3);
    expect(out).toContain(product.description!);
    expect(out).toContain(fmt(m.product.artistShare, { percent: 50 }));
    expect(out).toContain(m.product.shippingCopy);
    expect(out).toContain(product.altText!);
    expect(out).toMatch(/<span class="[^"]*expand[^"]*" aria-hidden="true">/);
    const noAlt = html(createElement(Disclosures, { product: { ...product, altText: null, spokenDescription: null } }));
    expect(noAlt).toContain(m.product.altMissing);
  });

  it("pays note, Meet the maker (captions, quote), More from with Visit {studio}", () => {
    expect(html(createElement(PaysArtistNote, { name: "Leo", type: "sticker" }))).toContain(fmt(m.product.paysSticker, { name: "Leo" }));
    expect(html(createElement(PaysArtistNote, { name: "Leo", type: "tote" }))).toContain(fmt(m.product.paysTote, { name: "Leo" }));
    const maker = html(createElement(MeetMakerCard, { product }));
    expect(maker).toContain('<track kind="captions"');
    expect(maker).toMatch(/<blockquote[^>]*><p>“I drew him reading/);
    expect(maker).toContain(m.product.scanSticker);
    const more = html(createElement(MoreFrom, { creator, products: [other] }));
    expect(more).toMatch(new RegExp(`<a[^>]*href="/c/leo"[^>]*>${fmt(m.product.visitStudio, { studio: "Sunrise Art Studio" })}<span aria-hidden="true"> →</span></a>`));
    expect(html(createElement(MoreFrom, { creator, products: [] }))).toBe("");
  });
});

describe("Checkout → placeOrder (stubbed createOrder)", () => {
  beforeEach(() => hoisted.createOrder.mockReset());

  it("the form's fields reach the action: buyer fields go to createOrder, size and quantity ride along until T111", async () => {
    hoisted.createOrder.mockResolvedValueOnce({ orderId: "o1", token: "t" });
    const fd = new FormData();
    for (const [k, v] of Object.entries({ size: "4in", quantity: "2", buyerName: "Ann", buyerEmail: "ann@example.com", shipNote: "" })) fd.set(k, v);
    await expect(placeOrder("p1", {}, fd)).rejects.toThrow("NEXT_REDIRECT");
    expect(hoisted.createOrder).toHaveBeenCalledTimes(1);
    expect(hoisted.createOrder.mock.calls[0][0]).toBe("p1");
    expect(hoisted.createOrder.mock.calls[0][1]).toMatchObject({ buyerName: "Ann", buyerEmail: "ann@example.com" });
  });

  it("a refused order returns the field so the sheet shows it", async () => {
    const fd = new FormData();
    fd.set("buyerName", " ");
    expect(await placeOrder("p1", {}, fd)).toMatchObject({ field: "name", error: m.product.nameRequired });
    expect(hoisted.createOrder).not.toHaveBeenCalled();
  });
});
