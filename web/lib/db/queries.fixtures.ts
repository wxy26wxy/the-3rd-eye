/**
 * Example data for local visual checks only (loaded when WEB_FIXTURES=1).
 * Every creator here is fictional and flagged `isExample`.
 */
import "server-only";
import type {
  AdminOrder, ArtworkTrace, CreatorProfile, ProductDetail, PublicCreator, ShopProduct, StoryTagView,
} from "./queries.contract";

const split = { creator_bps: 5000, org_bps: 3000, production_bps: 2000 };
const vtt = `WEBVTT

00:00.000 --> 00:04.000
Hi, I'm Mira. I make bright, happy animals.

00:04.000 --> 00:08.000
This frog is sitting in the sun, just like me on Saturdays.
`;

export const FIXTURE_CREATORS: PublicCreator[] = [
  {
    id: "11111111-1111-4111-8111-111111111111", slug: "mira", displayName: "Mira", studioName: "Sunny Side Studio",
    avatarUrl: null, bioShort: "Mira paints bright animals in thick, happy lines. Example artist.",
    storyText: "Mira has painted at Sunny Side Studio for six years. She loves frogs, sunshine and the colour yellow. This is an example profile.",
    storyVideoUrl: null, storyVideoVtt: vtt, mentionDisability: false, split, isExample: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222", slug: "theo", displayName: "Theo", studioName: "Riverbend Arts",
    avatarUrl: null, bioShort: "Theo describes his ideas out loud and turns them into stickers. Example artist.",
    storyText: "Theo is blind and has big visual ideas. He says them out loud, listens to the description, and changes it until it feels right. This is an example profile.",
    storyVideoUrl: null, storyVideoVtt: null, mentionDisability: false, split, isExample: true,
  },
];
const summary = (c: PublicCreator) => ({
  id: c.id, slug: c.slug, displayName: c.displayName, studioName: c.studioName, avatarUrl: c.avatarUrl, split: c.split, isExample: c.isExample, bioShort: c.bioShort,
});
const [mira, theo] = FIXTURE_CREATORS;

export const FIXTURE_PRODUCTS: ShopProduct[] = [
  { id: "p-frog", type: "sticker", title: "Sunny Frog", description: "A round green frog sunbathing on a lily pad.", priceCents: 500, mockupUrl: "/examples/frog.svg", artworkUrl: "/examples/frog.svg", cutPathSvg: "M10 50 C10 20 90 20 90 50 C90 80 10 80 10 50 Z", altText: "A smiling green frog with big eyes sitting on a lily pad.", madeByVoice: false, tags: ["frog", "sun"], creator: summary(mira) },
  { id: "p-sun", type: "tote", title: "Morning Sun Tote", description: "A big yellow sun with wavy rays on a cream tote bag.", priceCents: 2400, mockupUrl: "/examples/sun.svg", artworkUrl: "/examples/sun.svg", cutPathSvg: null, altText: "A yellow sun with wavy rays and a calm smiling face.", madeByVoice: false, tags: ["sun"], creator: summary(mira) },
  { id: "p-cat", type: "sticker", title: "Moon Cat", description: "A sleepy cat curled on a crescent moon. Made by voice.", priceCents: 500, mockupUrl: "/examples/cat.svg", artworkUrl: "/examples/cat.svg", cutPathSvg: "M12 50 C12 15 88 15 88 50 C88 85 12 85 12 50 Z", altText: "A sleepy grey cat curled up on a yellow crescent moon.", madeByVoice: true, tags: ["cat", "moon"], creator: summary(theo) },
  { id: "p-flower", type: "tote", title: "Loud Flowers Tote", description: "Three tall flowers in bold colours. Made by voice.", priceCents: 2400, mockupUrl: "/examples/flower.svg", artworkUrl: "/examples/flower.svg", cutPathSvg: null, altText: "Three tall flowers, one pink, one orange and one purple, with long green stems.", madeByVoice: true, tags: ["flowers"], creator: summary(theo) },
];

export function fixtureProductDetail(id: string): ProductDetail | null {
  const p = FIXTURE_PRODUCTS.find((x) => x.id === id);
  if (!p) return null;
  const creator = FIXTURE_CREATORS.find((c) => c.id === p.creator.id)!;
  return { ...p, artworkId: `a-${p.id}`, spokenDescription: p.altText, creator };
}

export function fixtureCreatorProfile(slug: string): CreatorProfile | null {
  const c = FIXTURE_CREATORS.find((x) => x.slug === slug);
  if (!c) return null;
  return { ...c, products: FIXTURE_PRODUCTS.filter((p) => p.creator.id === c.id) };
}

export function fixtureStoryTag(token: string): StoryTagView | null {
  const product = FIXTURE_PRODUCTS[0];
  return { token, tapCount: 3, productTitle: product.title, product, creator: mira, moreFromStudio: FIXTURE_PRODUCTS.filter((p) => p.creator.id === mira.id && p.id !== product.id) };
}

export const FIXTURE_ORDERS: AdminOrder[] = [
  {
    id: "00000000-0000-4000-8000-000000000001", status: "placed", buyerName: "Sam Rivera", buyerEmail: "sam@example.com", shipNote: "Gift, please no receipt.",
    amountCents: 500, creatorShareCents: 250, createdAt: new Date("2026-10-28T20:00:00Z"),
    product: { id: "p-frog", title: "Sunny Frog", type: "sticker", mockupUrl: "/examples/frog.svg", printPngUrl: "creators/mira/print/frog.png", printSvgUrl: "creators/mira/print/frog.svg", artworkId: "a-p-frog" },
    creator: { displayName: "Mira", slug: "mira" }, token: "EXAMPLETAG01", tapCount: 3,
  },
  {
    id: "00000000-0000-4000-8000-000000000002", status: "printing", buyerName: "Ada Okafor", buyerEmail: null, shipNote: null,
    amountCents: 2400, creatorShareCents: 1200, createdAt: new Date("2026-10-28T21:10:00Z"),
    product: { id: "p-flower", title: "Loud Flowers Tote", type: "tote", mockupUrl: "/examples/flower.svg", printPngUrl: null, printSvgUrl: null, artworkId: "a-p-flower" },
    creator: { displayName: "Theo", slug: "theo" }, token: "EXAMPLETAG02", tapCount: 0,
  },
];

export function fixtureTrace(artworkId: string): ArtworkTrace {
  const at = new Date("2026-10-28T19:00:00Z");
  const call = (stage: string, model: string, req: unknown, res: unknown, i: number) => ({
    id: `call-${i}`, jobId: "job-1", stage, provider: "fixture", model, requestHash: `h${i}`, requestJson: req, responseId: `r${i}`, responseJson: res,
    latencyMs: 800 + i * 100, costEstimateCents: 1, artworkId, listingId: null, error: null, createdAt: new Date(at.getTime() + i * 4000), createdByTask: "T010",
  });
  return {
    variants: [
      { id: artworkId, url: "/examples/cat.svg", altText: "A sleepy grey cat curled up on a yellow crescent moon.", chosen: true },
      { id: "v-2", url: "/examples/sun.svg", altText: "A yellow sun.", chosen: false },
    ],
    candidates: [],
    artwork: { id: artworkId, source: "text2image", transcript: "a sleepy cat on the moon", shapedPrompt: "A sleepy grey cat curled on a yellow crescent moon, thick outlines, flat colours, white background.", originalUrl: null, maskUrl: null, cutPathSvg: "M12 50 C12 15 88 15 88 50 C88 85 12 85 12 50 Z", cleanedUrl: "/examples/cat.svg", altText: "A sleepy grey cat curled up on a yellow crescent moon.", spokenDescription: "A grey cat is curled up asleep on a big yellow moon.", differencesFromPrompt: "None.", parentArtworkId: null, createdAt: at },
    calls: [
      call("transcribe", "muse-voice-transcribe-1.0", { file: "[audio redacted]" }, { text: "a sleepy cat on the moon" }, 0),
      call("shape", "muse-spark-1.3", { transcript: "a sleepy cat on the moon" }, { prompt: "A sleepy grey cat curled on a yellow crescent moon..." }, 1),
      call("generate", "muse-image-1.0", { n: 4 }, { variants: 4 }, 2),
      call("describe", "muse-spark-1.3", { image: "[image]" }, { spoken: "A grey cat is curled up asleep on a big yellow moon." }, 3),
      call("segment", "sam-3.1", { phrase: "cat on moon" }, { instances: 1 }, 4),
      call("sticker", "sam-3.1", { outline: true }, { svgPath: "M12 50 ..." }, 5),
    ],
  };
}
