import { requireCreator } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { getArtwork, getCreatorById, listProductsByCreator } from "@/lib/db/queries";

/**
 * Three talking points for the story video, personalised with the artwork the creator most
 * recently CHOSE: the newest product's artwork (status ready), not a random sibling variant.
 */
export const GET = route(async (req) => {
  const { creatorId } = requireCreator(req);
  const [creator, products] = await Promise.all([getCreatorById(creatorId), listProductsByCreator(creatorId)]);
  let chosen = null;
  for (const p of products.slice(0, 5)) {
    const a = await getArtwork(p.artworkId);
    if (a?.status === "ready" && a.creatorId === creatorId) { chosen = a; break; }
  }
  const piece = chosen?.altText ? `your ${chosen.altText.replace(/\.$/, "").toLowerCase()}` : "this piece";
  return json({
    prompts: [
      `Say hi! Tell buyers your name${creator?.studioName ? ` and that you make art at ${creator.studioName}` : ""}.`,
      `What is ${piece} about, and what made you want to make it?`,
      "What do you love most about making art?",
    ],
  });
});
