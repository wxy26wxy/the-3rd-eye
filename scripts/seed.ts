/**
 * Seeds 3 clearly fictional example creators and 6 products (4 stickers, 2 totes).
 * Idempotent by slug: creators are upserted; a creator who already has its products is skipped.
 * With META_API_KEY: real pipelines (Spark shapes, Muse Image generates, SAM cuts, the listing
 * agent writes the listing), createdByTask "T010-seed". Without it: the offline fixture
 * registry (procedural placeholder art, no model calls), createdByTask "T010-seed-offline".
 * Login codes are random (10 characters, no look-alikes), kept across runs in the git-ignored
 * file web/.creator-codes.local (`slug=CODE` per line); they are never written to the repository.
 * Repair (T050): a published product without a print file, or whose print check did not pass,
 * gets its print file built and the listing agent re-run; if it still cannot be approved it is
 * archived and regenerated below.
 * Portraits (T147): a creator with scripts/seed-assets/avatars/<slug>.jpg gets it (480 px centre crop,
 * public storage) only while its avatar_url is null, so a re-run never replaces a photo set with
 * `pnpm avatar`. Leo has none.
 * Run from the repo root:
 *   pnpm --filter web exec dotenv -e .env.local -- tsx --conditions=react-server ../scripts/seed.ts
 */
const ONLINE = Boolean(process.env.META_API_KEY) && process.env.SEED_OFFLINE !== "1";
if (!ONLINE) process.env.AI_FIXTURES = "1";
const TASK = ONLINE ? "T010-seed" : "T010-seed-offline";

/** `listing`: fixed copy used when the agent's listing for this item failed moderation (applied through approve, which moderates it again). */
type Item = { type: "sticker" | "tote"; idea: string; via: "voice" | "canvas"; listing?: { title: string; description: string } };
type Seed = {
  slug: string; displayName: string; studioName: string; bioShort: string; storyText: string;
  mentionDisability: boolean; items: Item[];
};

const CREATORS: Seed[] = [
  {
    slug: "leo", displayName: "Leo", studioName: "Sunrise Art Studio",
    bioShort: "I draw buses every day. I love their colors and the people inside.",
    storyText: "I'm Leo. I draw buses every day at Sunrise Art Studio. I know every route in my city, and I love the bright paint and the people looking out of the windows. When I draw a bus, I think about where everyone is going. (Example artist: Leo and this story are fictional.)",
    mentionDisability: false,
    items: [
      { type: "sticker", via: "canvas", idea: "a bright red double-decker bus drawn with thick markers" },
      {
        type: "tote", via: "canvas", idea: "a yellow city bus with happy passengers waving from the windows, drawn with markers",
        listing: {
          title: "Yellow City Bus Tote by Leo",
          description: "Leo's marker drawing of a yellow city bus, with happy passengers waving from every window. Bright colors on a sturdy tote for groceries, books and everyday trips.",
        },
      },
    ],
  },
  {
    slug: "maya-ortiz", displayName: "Maya Ortiz", studioName: "Riverbend Creative Arts",
    bioShort: "I'm blind, and I make art by describing it out loud.",
    storyText: "I'm Maya. I have never needed my eyes to imagine things. I describe my ideas out loud, the app draws them, and it reads the picture back to me until it matches what I see in my head. My cat Biscuit shows up in a lot of my work. (Example artist: Maya and this story are fictional.)",
    mentionDisability: true,
    items: [
      { type: "sticker", via: "voice", idea: "a sleepy orange cat curled up on a round blue cushion" },
      { type: "sticker", via: "voice", idea: "a lighthouse at night with a big warm yellow beam over the waves" },
    ],
  },
  {
    slug: "june-park", displayName: "June Park", studioName: "Open Door Art Collective",
    bioShort: "Plants, birds and bright colors. Everything I make is meant to make you smile.",
    storyText: "I'm June. I paint at Open Door Art Collective three days a week. I like plants that are a little bit grumpy and birds that are a little bit loud. I want my art to make someone's day better. (Example artist: June and this story are fictional.)",
    mentionDisability: false,
    items: [
      { type: "sticker", via: "voice", idea: "a smiling cactus in a pink flower pot" },
      { type: "tote", via: "voice", idea: "three colorful birds sitting together on a branch" },
    ],
  },
];

async function loadCodes(file: string): Promise<Map<string, string>> {
  const { readFile } = await import("node:fs/promises");
  const codes = new Map<string, string>();
  try {
    for (const line of (await readFile(file, "utf8")).split("\n")) {
      const m = /^([a-z0-9-]+)=([A-Z0-9]{10})$/.exec(line.trim());
      if (m) codes.set(m[1], m[2]);
    }
  } catch { /* first run: no file yet */ }
  return codes;
}

async function main() {
  const path = await import("node:path");
  const { generateLoginCode } = await import("@/lib/codes"); // alphabet without 0/O, 1/I/L
  const { writeFile } = await import("node:fs/promises");
  const codesFile = path.resolve(process.cwd().endsWith("/web") ? "." : "web", ".creator-codes.local");
  const codes = await loadCodes(codesFile);
  for (const c of CREATORS) if (!codes.has(c.slug)) codes.set(c.slug, generateLoginCode());
  await writeFile(codesFile, `# Creator login codes for this database (written by scripts/seed.ts; never commit)\n${[...codes].map(([k, v]) => `${k}=${v}`).join("\n")}\n`, { mode: 0o600 });
  console.log(`seed: login codes written to ${codesFile}`);

  const q = await import("@/lib/db/queries");
  const { ai } = await import("@/lib/ai/registry");
  const { createFromText, createFromImage } = await import("@/lib/pipeline/artworks");
  const { createProduct, ensurePrintFile, runListingAgent, approveListing } = await import("@/lib/pipeline/products");
  const { storage, creatorPath } = await import("@/lib/storage");
  const { seedAvatar } = await import("@/lib/pipeline/avatar");
  const { readFile } = await import("node:fs/promises");
  const avatarsDir = path.resolve(process.cwd().endsWith("/web") ? ".." : ".", "scripts/seed-assets/avatars");
  const registry = await ai();
  console.log(`seed: ${ONLINE ? "online (real models)" : "offline (fixtures)"}, task ${TASK}`);

  for (const c of CREATORS) {
    const creator = await q.upsertCreatorBySlug({
      slug: c.slug, displayName: c.displayName, studioName: c.studioName, loginCode: codes.get(c.slug)!,
      bioShort: c.bioShort, storyText: c.storyText, mentionDisability: c.mentionDisability,
      isExample: true, createdByTask: TASK,
    });
    const avatar = await seedAvatar({
      readFile: (slug) => readFile(path.join(avatarsDir, `${slug}.jpg`)).catch(() => null),
      put: async (id, jpeg) => (await storage().putPublic(creatorPath(id, "avatar", "jpg"), jpeg, "image/jpeg")).url,
      setIfMissing: q.setCreatorAvatarIfMissing,
    }, creator);
    if (avatar === "set") console.log(`  ${c.slug}: portrait set`);
    let existing = (await q.listProductsByCreator(creator.id)).filter((p) => p.status === "published");
    // Repair (T050): every published product needs a print file and a passing print check from the server's tools.
    for (const p of existing) {
      const l = await q.getListing(p.id);
      const printOk = (l?.printCheck as { print_ok?: boolean } | null)?.print_ok === true;
      if (p.printPngUrl && printOk && !l?.draftCopy) continue;
      const artwork = await q.getArtwork(p.artworkId);
      if (!artwork || !l) continue;
      const fixed = p.printPngUrl ? p : await ensurePrintFile(p, artwork, "T050");
      await runListingAgent(fixed, artwork, "T050"); // published: lands in draftCopy until approved
      try {
        // Keep the live copy that was approved before; only the print check is new.
        await approveListing(fixed, { approvedVia: l.approvedVia ?? "tap", edits: { title: l.title, description: l.description ?? undefined, priceCents: p.priceCents } }, "T050");
        console.log(`  ${c.slug}: ${p.type} ${p.id} repaired (print file + server print check)`);
      } catch (err) {
        await q.updateProduct(p.id, { status: "archived" });
        console.log(`  ${c.slug}: ${p.type} ${p.id} archived, regenerating (${err instanceof Error ? err.message : err})`);
      }
    }
    existing = (await q.listProductsByCreator(creator.id)).filter((p) => p.status === "published");
    // Repair: a published listing whose text failed moderation gets the item's fixed copy (moderated again on approve).
    for (const item of c.items.filter((i) => i.listing)) {
      for (const p of existing.filter((x) => x.type === item.type)) {
        const l = await q.getListing(p.id);
        const ok = (l?.moderation as { ok?: boolean } | null)?.ok === true;
        if (!l || ok) continue;
        await approveListing(p, { approvedVia: l.approvedVia ?? "tap", edits: { ...item.listing!, priceCents: p.priceCents } }, "T040");
        console.log(`  ${c.slug}: ${item.type} listing copy set to "${item.listing!.title}"`);
      }
    }
    if (existing.length >= c.items.length) {
      console.log(`  ${c.slug}: already has ${existing.length} products, skipping`);
      continue;
    }
    for (const item of c.items.slice(existing.length)) {
      const t0 = Date.now();
      let artwork;
      if (item.via === "voice") {
        const shaped = await registry.shaper.shape(item.idea, { product: item.type, trace: { stage: "shape", task: TASK } });
        [artwork] = await createFromText(creator.id, { prompt: shaped.prompt, transcript: item.idea, n: 1, product: item.type }, TASK);
      } else {
        // Canvas example: a marker drawing on white paper, uploaded like the canvas flow would.
        const [img] = await registry.image.generate(
          `${item.idea}, simple hand-drawn marker drawing by an adult artist, on plain white paper, no text`, { n: 1, trace: { stage: "generate", task: TASK } });
        const upload = await storage().putPublic(creatorPath(creator.id, "canvas", "png"), img.png, "image/png");
        const res = await createFromImage(creator.id, { source: "canvas", imageUrl: upload.url, product: item.type }, TASK);
        artwork = res.artwork.status === "ready" ? res.artwork : await (await import("@/lib/pipeline/artworks")).selectCandidate(res.artwork, res.candidates[0].id, TASK);
        await q.updateArtwork(artwork.id, { transcript: item.idea });
      }
      const product = await createProduct(artwork, item.type, TASK);
      const { listing } = await runListingAgent(product, artwork, TASK);
      await approveListing(product, { approvedVia: "tap" }, TASK);
      console.log(`  ${c.slug}: ${item.type} "${listing.title}" ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  console.log("seed: done");
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
